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

    # ── Greeting / Small-talk patterns ─────────────────────────────────────────
    _GREETING_RESPONSES = {
        frozenset(["hi", "hello", "hey", "hiya", "howdy"]): "Hey there! 👋 I'm VoltStream Bot. Ask me anything about energy saving, solar, or your VoltStream platform!",
        frozenset(["how are you", "how r u", "how are u", "how do you do"]): "I'm doing great and ready to help! 😊 What energy question can I answer for you?",
        frozenset(["good morning", "good afternoon", "good evening", "good night"]): "Good day! 🌟 How can I assist you with your energy needs today?",
        frozenset(["thanks", "thank you", "thx", "ty", "thank u"]): "You're welcome! 😊 Feel free to ask if you have more questions.",
        frozenset(["bye", "goodbye", "see you", "see ya", "cya"]): "Goodbye! 👋 Come back anytime you have energy questions!",
        frozenset(["ok", "okay", "alright", "sure", "got it", "noted"]): "Got it! Let me know if there's anything else you need.",
    }

    def _get_greeting_response(self, query: str) -> str | None:
        """Returns a canned response if query is a greeting/small-talk, else None."""
        q = query.strip().lower().rstrip("!?.,'")
        for keywords, response in self._GREETING_RESPONSES.items():
            if q in keywords:
                return response
        return None

    def ask(self, query: str) -> dict:
        """
        Runs the RAG pipeline for a given user query.

        Returns:
            dict with keys:
                - "answer"  (str): grounded answer or fallback message
                - "sources" (list[str]): page-level source references
        """
        # ── Handle greetings & small talk before hitting the PDF ───────────────
        greeting = self._get_greeting_response(query)
        if greeting:
            return {"answer": greeting, "sources": []}

        if not self._initialized or not self._rag_chain:
            return {
                "answer": "I am the VoltStream Assistant. I don't have that information. I can only assist with energy efficiency document-related information.",
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
        from core.config import settings
        logger.info("🤖 Initializing Gemini 2.5 Flash using Vertex AI...")

        self._llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            vertexai=True,
            project=settings.gcp_project,
            location=settings.gcp_location,
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
def get_energy_recommendations(query: str) -> list:
    try:
        search_q = query.strip() if query else ""

        general_keywords = ["ac", "air conditioner", "fridge", "refrigerator", "washing", "machine", "geyser", "heater", "light", "tv", "television"]
        is_specific = any(k in search_q.lower() for k in general_keywords)

        if not is_specific:
            search_q += " energy saving tips reduce electricity consumption peak hours bill reduction"

        rag_result = rag_service.ask(search_q)
        answer     = rag_result.get("answer", "").strip()

        if not answer or "don't have that information" in answer.lower():
            return [
                "Set AC temperature between 24°C and 26°C to reduce cooling costs by up to 20%",
                "Reduce usage during peak hours (7 PM – 9 PM) — shift loads to off-peak",
                "Schedule heavy appliances (washing machine, dishwasher) after 10 PM",
                "Enable smart automation schedules to auto-shutoff idle devices",
                "Monitor and reduce weekend consumption patterns",
            ]

        lines = [l.strip() for l in answer.split("\n") if l.strip() and len(l.strip()) > 10]
        recommendations = [l.lstrip("•-*1234567890.) ") for l in lines]
        return recommendations[:7]

    except Exception as e:
        logger.exception("[RAG Tool] error: %s", e)
        return [
            "Set AC to 24–26°C",
            "Run appliances during off-peak hours (10 PM – 6 AM)",
            "Switch to LED lighting",
            "Use smart power strips to eliminate standby load",
            "Enable device scheduling via VoltStream automation",
        ]
