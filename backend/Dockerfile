# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies required by the application
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download and cache the SentenceTransformers embedding model to avoid runtime downloads
RUN python -c "from langchain_community.embeddings import HuggingFaceEmbeddings; HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')"

# Copy the rest of the backend application code
COPY . .

# Expose port 8080 natively for Google Cloud Run
EXPOSE 8080

# Command to run the application using uvicorn (Cloud Run expects 8080 by default)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
