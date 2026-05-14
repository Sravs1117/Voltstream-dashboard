import fitz  # PyMuPDF
import google.generativeai as genai
from core.config import settings
from typing import Optional
import io

class GeminiService:
    def __init__(self):
        self.api_key = settings.google_api_key
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.model = None

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """
        Extracts text from PDF bytes using PyMuPDF.
        """
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text.strip()
        except Exception as e:
            raise ValueError(f"Failed to extract text from PDF: {str(e)}")

    def chat(self, message: str, pdf_context: Optional[str] = None) -> str:
        """
        Sends a message to Gemini, optionally with PDF context.
        """
        if not self.model:
            raise Exception("Gemini API key is not configured. Please set GOOGLE_API_KEY in your .env file.")
        
        try:
            if pdf_context:
                prompt = (
                    "You are a helpful AI assistant. Use the following PDF content as context to answer the user's question.\n"
                    "If the question is about the document, provide a detailed answer based on the text.\n"
                    "If the question is general and not related to the document, answer it normally while acknowledging the document context if appropriate.\n\n"
                    f"--- DOCUMENT CONTEXT ---\n{pdf_context}\n------------------------\n\n"
                    f"User Question: {message}"
                )
            else:
                prompt = message

            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")

gemini_service = GeminiService()
