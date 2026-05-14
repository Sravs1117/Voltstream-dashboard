from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from services.gemini_service import gemini_service
from schemas.chat import ChatResponse

router = APIRouter()

@router.post("/", response_model=ChatResponse, summary="Chat with Gemini (Optional PDF)")
async def chat_with_gemini(
    message: str = Form(...),
    pdf: Optional[UploadFile] = File(None)
):
    """
    Sends a query to Gemini. If a PDF is provided, its content is used as context.
    """
    try:
        pdf_context = None
        if pdf:
            # Validate file type
            if not pdf.filename.endswith('.pdf'):
                raise HTTPException(status_code=400, detail="Only PDF files are supported.")
            
            # Read and extract text
            pdf_bytes = await pdf.read()
            pdf_context = gemini_service.extract_text_from_pdf(pdf_bytes)
            
            if not pdf_context:
                raise HTTPException(status_code=400, detail="Could not extract text from the provided PDF.")

        # Get response from Gemini
        answer = gemini_service.chat(message, pdf_context)
        
        return ChatResponse(answer=answer)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")
