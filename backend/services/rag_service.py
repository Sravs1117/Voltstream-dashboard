import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain.chains.retrieval import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

class RAGService:
    def __init__(self):
        # Determine absolute paths for data and db relative to this file
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.data_dir = os.path.join(base_dir, "data")
        self.db_dir = os.path.join(base_dir, "db", "chroma_db")
        self.pdf_path = os.path.join(self.data_dir, "solar.pdf")
        
        self.vector_store = None
        self.embedding_model = None
        self.llm = None
        
    def initialize(self):
        """
        Initializes the embeddings, loads the PDF, stores/loads chunks in ChromaDB,
        and sets up the Gemini model.
        """
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.db_dir, exist_ok=True)

        if not os.path.exists(self.pdf_path):
            print(f"Warning: PDF file not found at {self.pdf_path}. Please add it.")
            return

        print("Initializing Embedding Model...")
        # 3. Generate embeddings using sentence-transformers/all-MiniLM-L6-v2
        self.embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        print("Reading and Chunking PDF...")
        # 1. Read PDF using pypdf
        loader = PyPDFLoader(self.pdf_path)
        docs = loader.load()

        # 2. Chunk text using RecursiveCharacterTextSplitter
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(docs)

        print("Storing chunks in ChromaDB...")
        # 4. Store embeddings in ChromaDB
        self.vector_store = Chroma.from_documents(
            documents=chunks, 
            embedding=self.embedding_model, 
            persist_directory=self.db_dir
        )
        
        # 6. Initialize Gemini 1.5 Flash (requires GOOGLE_API_KEY in environment)
        print("Initializing Gemini LLM...")
        self.llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0)
        print("RAG Service successfully initialized.")

    def ask(self, query: str) -> str:
        """
        Retrieves context from ChromaDB and gets an answer from Gemini.
        """
        if not self.vector_store or not self.llm:
            return "I don't have that information. (Service not fully initialized or PDF missing)"
        
        # 5. Retrieve top-3 similar chunks
        retriever = self.vector_store.as_retriever(search_kwargs={"k": 3})
        
        # Return grounded answers only from PDF context
        template = """You are a helpful assistant for VoltStream. Answer the question based ONLY on the provided context.
If the answer is not found in the context, exactly return this text: "I don't have that information."
Do not try to make up an answer.

Context:
{context}

Question:
{input}

Answer:"""
        prompt = PromptTemplate.from_template(template)
        
        combine_docs_chain = create_stuff_documents_chain(self.llm, prompt)
        rag_chain = create_retrieval_chain(retriever, combine_docs_chain)
        
        # 6. Send retrieved context to Gemini 1.5 Flash
        response = rag_chain.invoke({"input": query})
        
        return response["answer"]

# Export a singleton instance
rag_service = RAGService()
