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
import threading

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

from core.config import Settings
from core.prompts import RAG_PROMPT_TEMPLATE
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

logger = logging.getLogger(__name__)

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
        self._lock = threading.Lock()
        self.last_sources = []
        self.last_chunks = []
        self.last_context = ""

    # ── Public API ─────────────────────────────────────────────────────────────

    def initialize(self) -> None:
        """
        Initializes the full RAG pipeline on startup.
        Safe to call even if the PDF is not yet present.
        """
        with self._lock:
            if self._initialized:
                return
            try:
                os.makedirs(self.data_dir, exist_ok=True)
                os.makedirs(self.db_dir, exist_ok=True)

                pdf_paths = self._find_pdfs()
                if not pdf_paths:
                    logger.warning(
                        "⚠️  No PDFs found in '%s'. "
                        "Add PDF files and restart the server.",
                        self.data_dir,
                    )
                    return

                logger.info("📄 PDFs detected: %s", [os.path.basename(p) for p in pdf_paths])
                self._init_embedding_model()
                self._build_vector_store(pdf_paths)
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
        if not self._initialized:
            logger.info("Initializing RAG service on demand...")
            self.initialize()

        if not self._initialized or not self._rag_chain:
            return {
                "answer": "I don't have that information.",
                "sources": [],
                "context": "",
            }

        try:
            retriever = self._vector_store.as_retriever(search_kwargs={"k": 3})
            source_docs = retriever.invoke(query)

            answer = self._rag_chain.invoke(query)

            # Don't show sources for simple greetings
            lowered_query = query.lower()
            is_greeting = any(g in lowered_query for g in ["hi", "hello", "how are you", "hey", "good morning"])

            final_sources = []
            self.last_chunks = []
            if not is_greeting:
                for idx, doc in enumerate(source_docs):
                    meta = doc.metadata or {}
                    raw_source = meta.get('source')
                    if raw_source and isinstance(raw_source, str):
                        source_name = os.path.basename(raw_source)
                    else:
                        source_name = "document.pdf"
                    
                    page_num = meta.get('page', 0) + 1
                    
                    self.last_chunks.append({
                        "id": idx + 1,
                        "source": source_name,
                        "page": page_num,
                        "content": doc.page_content.strip() if doc.page_content else ""
                    })
                    
                    source_ref = f"{source_name} (page {page_num})"
                    if source_ref not in final_sources:
                        final_sources.append(source_ref)

            self.last_sources = final_sources
            self.last_context = "\n\n---\n\n".join(doc.page_content for doc in source_docs)
            return {
                "answer": answer.strip(),
                "sources": final_sources,
                "context": self.last_context
            }

        except Exception as exc:
            logger.exception("❌ RAG query failed: %s", exc)
            err_str = str(exc).lower()
            if "quota" in err_str or "429" in err_str:
                return {"answer": "⚠️ Gemini API quota exceeded. Please wait and try again.", "sources": [], "context": ""}
            if "not found" in err_str or "404" in err_str:
                return {"answer": "⚠️ Gemini model not available. Check the model name in rag_service.py.", "sources": [], "context": ""}
            # Catch-all: return the real error so we can debug
            return {
                "answer": f"⚠️ RAG error: {str(exc)[:200]}",
                "sources": [],
                "context": "",
            }

    # ── Private Helpers ────────────────────────────────────────────────────────

    def _find_pdfs(self) -> list[str]:
        """Returns the paths of all PDFs found in data_dir."""
        return glob.glob(os.path.join(self.data_dir, "*.pdf"))

    def _init_embedding_model(self) -> None:
        """Loads the sentence-transformers embedding model (cached locally)."""
        logger.info("🔢 Loading embedding model: sentence-transformers/all-MiniLM-L6-v2 ...")
        self._embedding_model = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        logger.info("✅ Embedding model loaded.")

    def _build_vector_store(self, pdf_paths: list[str]) -> None:
        """
        Loads and chunks all PDFs, then persists embeddings to ChromaDB.
        Loads existing store if present to avoid SQLite locks and speed up startup.
        """
        import chromadb

        # Try loading existing collection first to avoid SQLite locks when running multiple processes
        try:
            client = chromadb.PersistentClient(path=self.db_dir)
            collections = [c.name for c in client.list_collections()]
            if "voltstream_rag" in collections:
                col = client.get_collection("voltstream_rag")
                if col.count() > 0:
                    logger.info("💾 Loading existing ChromaDB collection 'voltstream_rag'...")
                    self._vector_store = Chroma(
                        persist_directory=self.db_dir,
                        embedding_function=self._embedding_model,
                        collection_name="voltstream_rag"
                    )
                    logger.info("✅ Existing ChromaDB collection loaded.")
                    return
        except Exception as e:
            logger.warning("Failed to load existing ChromaDB collection: %s. Rebuilding...", e)

        # Rebuild vector store from scratch
        try:
            client = chromadb.PersistentClient(path=self.db_dir)
            try:
                client.delete_collection("voltstream_rag")
                logger.info("Deleted existing Chroma collection 'voltstream_rag'")
            except Exception:
                pass # collection might not exist
        except Exception as e:
            logger.warning("Failed to clear ChromaDB collection: %s", e)

        logger.info("📖 Loading and chunking PDFs ...")
        all_chunks = []
        
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " ", ""],
        )

        for pdf_path in pdf_paths:
            logger.info("📖 Loading PDF: %s", os.path.basename(pdf_path))
            loader = PyPDFLoader(pdf_path)
            documents = loader.load()
            chunks = splitter.split_documents(documents)
            all_chunks.extend(chunks)
            logger.info("✂️  Created %d chunks from %d pages in %s.", len(chunks), len(documents), os.path.basename(pdf_path))

        logger.info("💾 Storing embeddings in ChromaDB at '%s' ...", self.db_dir)
        self._vector_store = Chroma.from_documents(
            documents=all_chunks,
            embedding=self._embedding_model,
            persist_directory=self.db_dir,
            collection_name="voltstream_rag",
        )
        logger.info("✅ ChromaDB populated with %d vectors.", len(all_chunks))

    def _init_llm(self) -> None:
        """Initializes the Gemini 2.5 Flash LLM via LangChain."""
        logger.info("🤖 Initializing Gemini 2.5 Flash using Vertex AI...")

        # FIX: Updated model parameter to the current active 'gemini-2.5-flash'
        self._llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            vertexai=True,
            project=Settings.gcp_project,
            location=Settings.gcp_location,
            temperature=0,
            convert_system_message_to_human=True,
        )
        logger.info("✅ Gemini LLM ready.")

    def _build_rag_chain(self) -> None:
        """Constructs the LCEL RAG chain: retriever → prompt → LLM → parser."""
        retriever = self._vector_store.as_retriever(search_kwargs={"k": 3})
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
def get_energy_recommendations(query: str) -> str:
    try:
        search_q = query.strip() if query else ""

        rag_result = rag_service.ask(search_q)
        answer     = rag_result.get("answer", "").strip()

        if not answer or "don't have that information" in answer.lower():
            return (
                "Here are some general tips:\n"
                "- Set AC temperature between 24°C and 26°C to reduce cooling costs by up to 20%\n"
                "- Reduce usage during peak hours (7 PM – 9 PM) — shift loads to off-peak\n"
                "- Schedule heavy appliances (washing machine, dishwasher) after 10 PM\n"
                "- Enable smart automation schedules to auto-shutoff idle devices\n"
                "- Monitor and reduce weekend consumption patterns"
            )

        return answer

    except Exception as e:
        logger.exception("[RAG Tool] error: %s", e)
        return (
            "Error accessing knowledge base. General tips:\n"
            "- Set AC to 24–26°C\n"
            "- Run appliances during off-peak hours (10 PM – 6 AM)\n"
            "- Switch to LED lighting\n"
            "- Use smart power strips to eliminate standby load\n"
            "- Enable device scheduling via VoltStream automation"
        )

def show_retrieved_chunks(query: str) -> None:
    """
    Retrieves the top 3 most relevant chunks and displays:
    - PDF filename
    - Page number
    - Chunk content
    """
    if not rag_service._initialized or not rag_service._vector_store:
        # Initialize if not already initialized
        rag_service.initialize()
        
    if not rag_service._initialized or not rag_service._vector_store:
        print("RAG Service not initialized.")
        return
        
    retriever = rag_service._vector_store.as_retriever(search_kwargs={"k": 3})
    source_docs = retriever.invoke(query)
    
    for i, doc in enumerate(source_docs, 1):
        source_file = os.path.basename(doc.metadata.get("source", "unknown.pdf"))
        page_num = doc.metadata.get("page", 0) + 1
        content = doc.page_content.strip()
        
        print(f"Retrieved Chunk #{i}")
        print(f"Source: {source_file}")
        print(f"Page: {page_num}\n")
        print(content)
        print("---")
