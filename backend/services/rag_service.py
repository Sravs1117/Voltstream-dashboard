"""
rag_service.py
--------------
Production-level RAG pipeline for VoltStream Q&A Chatbot.

Pipeline:
  PDF  →  Chunk  →  Embed (all-MiniLM-L6-v2)  →  ChromaDB
                                                       ↓
  User Query  →  Retrieve top-3 chunks  →  Gemini 2.5 Flash  →  Grounded Answer
"""

import os
import glob
import hashlib
import logging

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

logger = logging.getLogger(__name__)

# ─── RAG Prompt Template ──────────────────────────────────────────────────────
RAG_PROMPT_TEMPLATE = """You are VoltStream Bot, a helpful assistant.
Answer the user's question using the document context provided below.

RULES:
1. DYNAMIC BREVITY:
   - For simple greetings (hi, hello), answer in 1-2 lines.
   - For document questions, answer in maximum 5 lines.
   - NEVER exceed 5 lines total.
2. CONTEXT: Use the context for technical questions.
3. UNKNOWN: If not in context, say "I am VoltStream Bot. I don't have that information, but I can help you with questions about VoltStream Energy Efficiency." and answer only from context.
4. NO FILLER: Get straight to the point.


Context:
{context}

Question: {question}

Answer:"""


class RAGService:
    """
    Manages the full RAG lifecycle:
      - Embedding model initialization
      - PDF loading and chunking
      - ChromaDB vector store management
      - Gemini LLM integration
      - LCEL chain construction and querying
    """

    def __init__(self):
        # Resolve absolute paths relative to this file's location
        self._base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.data_dir = os.path.join(self._base_dir, "data")
        self.db_dir = os.path.join(self._base_dir, "db", "chroma_db")

        # Internal state
        self._vector_store: Chroma | None = None
        self._embedding_model: HuggingFaceEmbeddings | None = None
        self._llm: ChatGoogleGenerativeAI | None = None
        self._rag_chain = None
        self._initialized: bool = False

    # ── Public API ─────────────────────────────────────────────────────────────

    def initialize(self) -> None:
        """
        Initializes the full RAG pipeline on startup.
        Safe to call even if the PDF is not yet present.
        """
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            os.makedirs(self.db_dir, exist_ok=True)

            pdf_path = self._find_pdf()
            if not pdf_path:
                logger.warning(
                    "⚠️  No PDF found in '%s'. "
                    "Add a PDF file and restart the server.",
                    self.data_dir,
                )
                return

            logger.info("📄 PDF detected: %s", os.path.basename(pdf_path))
            self._init_embedding_model()
            self._build_vector_store(pdf_path)
            self._init_llm()
            self._build_rag_chain()

            self._initialized = True
            logger.info("✅ RAG Service initialized successfully.")

        except Exception as exc:
            logger.exception("❌ RAG Service initialization failed: %s", exc)

    def ask(self, query: str) -> dict:
        """
        Runs the RAG pipeline for a given user query.

        Returns:
            dict with keys:
                - "answer"  (str): grounded answer or fallback message
                - "sources" (list[str]): page-level source references
        """
        if not self._initialized or not self._rag_chain:
            return {
                "answer": "I don't have that information.",
                "sources": [],
            }

        try:
            retriever = self._vector_store.as_retriever(search_kwargs={"k": 4})
            source_docs = retriever.invoke(query)

            answer = self._rag_chain.invoke(query)

            # Don't show sources for simple greetings
            lowered_query = query.lower()
            is_greeting = any(g in lowered_query for g in ["hi", "hello", "how are you", "hey", "good morning"])
            
            final_sources = []
            if not is_greeting:
                final_sources = list(
                    {
                        f"{os.path.basename(doc.metadata.get('source', 'document'))} "
                        f"(page {doc.metadata.get('page', '?') + 1})"
                        for doc in source_docs
                        if doc.metadata
                    }
                )

            return {"answer": answer.strip(), "sources": final_sources}

        except Exception as exc:
            logger.exception("❌ RAG query failed: %s", exc)
            err_str = str(exc).lower()
            if "quota" in err_str or "429" in err_str:
                return {"answer": "⚠️ Gemini API quota exceeded. Please wait and try again.", "sources": []}
            if "not found" in err_str or "404" in err_str:
                return {"answer": "⚠️ Gemini model not available. Check the model name in rag_service.py.", "sources": []}
            # Catch-all: return the real error so we can debug
            return {
                "answer": f"⚠️ RAG error: {str(exc)[:200]}",
                "sources": [],
            }

    # ── Private Helpers ────────────────────────────────────────────────────────

    def _find_pdf(self) -> str | None:
        """Returns the path of the first PDF found in data_dir, or None."""
        pdfs = glob.glob(os.path.join(self.data_dir, "*.pdf"))
        return pdfs[0] if pdfs else None

    def _init_embedding_model(self) -> None:
        """Loads the sentence-transformers embedding model (cached locally)."""
        logger.info("🔢 Loading embedding model: sentence-transformers/all-MiniLM-L6-v2 ...")
        self._embedding_model = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        logger.info("✅ Embedding model loaded.")

    def _build_vector_store(self, pdf_path: str) -> None:
        """
        Loads and chunks the PDF, then persists embeddings to ChromaDB.
        Re-indexes on every startup to keep the store fresh.
        """
        logger.info("📖 Loading and chunking PDF ...")
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " ", ""],
        )
        chunks = splitter.split_documents(documents)
        logger.info("✂️  Created %d chunks from %d pages.", len(chunks), len(documents))

        logger.info("💾 Storing embeddings in ChromaDB at '%s' ...", self.db_dir)
        self._vector_store = Chroma.from_documents(
            documents=chunks,
            embedding=self._embedding_model,
            persist_directory=self.db_dir,
            collection_name="voltstream_rag",
        )
        logger.info("✅ ChromaDB populated with %d vectors.", len(chunks))

    def _init_llm(self) -> None:
        """Initializes the Gemini 2.5 Flash LLM via LangChain."""
        api_key = os.getenv("GOOGLE_API_KEY", "")
        if not api_key:
            raise EnvironmentError(
                "GOOGLE_API_KEY is not set. Add it to your .env file."
            )
        logger.info("🤖 Initializing Gemini 2.5 Flash...")
        
        # FIX: Updated model parameter to the current active 'gemini-2.5-flash'
        self._llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=api_key,
            temperature=0,
            convert_system_message_to_human=True,
        )
        logger.info("✅ Gemini LLM ready.")

    def _build_rag_chain(self) -> None:
        """Constructs the LCEL RAG chain: retriever → prompt → LLM → parser."""
        retriever = self._vector_store.as_retriever(search_kwargs={"k": 4})
        prompt = PromptTemplate.from_template(RAG_PROMPT_TEMPLATE)

        def _format_docs(docs) -> str:
            return "\n\n---\n\n".join(doc.page_content for doc in docs)

        self._rag_chain = (
            {"context": retriever | _format_docs, "question": RunnablePassthrough()}
            | prompt
            | self._llm
            | StrOutputParser()
        )
        logger.info("⛓️  RAG chain built successfully.")


# ── Singleton ─────────────────────────────────────────────────────────────────
rag_service = RAGService()