# ⚡ VoltStream Dashboard

VoltStream is a modern, full-stack energy monitoring and smart home management dashboard. It provides real-time insights into solar vs. grid power usage, historical consumption analytics, remote control for smart devices, and billing predictions, all coupled with a state-of-the-art Generative AI-powered RAG assistant.

---

## ✨ Features

- **Live Power Monitoring**: Real-time visualization of grid draw, solar generation, and net usage using beautifully animated `Recharts`.
- **Usage History**: Daily, weekly, and monthly bar and area charts showing historical consumption alongside estimated monetary costs.
- **Smart Device Control**: Remotely toggle smart appliances (ACs, EV Chargers, server racks) with real-time status updates, optimistic UI states, and instant search filtering.
- **Billing & Invoices**: Track budget limits, project monthly bills, and dynamically download historical invoices as formatted PDFs.
- **AI-Powered RAG Chatbot**: An intelligent, grounded assistant integrated into the dashboard to answer complex energy efficiency questions based on technical manuals. Features include:
  - **Context-Grounded Q&A**: Strict grounding rules ensuring zero LLM hallucinations.
  - **Dynamic Brevity**: Answers adjusted for readability (greetings in 1-2 lines, technical answers in under 5 lines).
  - **Source Attributions**: Displays direct source document page citations (e.g., *Manual.pdf (page 4)*) for transparent traceability.

---

## 🛠️ Tech Stack

### **Frontend:**
- **React + Vite:** Extremely fast UI rendering and build times.
- **TailwindCSS:** Custom "Obsidian Glass" styling with dark/neon aesthetics.
- **Recharts:** Interactive, responsive data visualizations.
- **React Router:** Seamless Single Page Application (SPA) navigation.

### **Backend:**
- **Python + FastAPI:** High-performance asynchronous API server.
- **Pydantic:** Strict data validation and schema definitions.
- **Uvicorn:** Lightning-fast ASGI server.
- **SQLite + SQLAlchemy:** Robust database layer for dashboard states.

### **Generative AI & RAG Pipeline:**
- **Google Gemini 2.5 Flash:** High-speed, context-aware reasoning model for grounded answering.
- **LangChain (LCEL):** Orchestrates the data flow (retriever → custom prompting → LLM → output parser).
- **ChromaDB:** Lightweight embedded vector database storing semantic representations.
- **HuggingFace Embeddings (`all-MiniLM-L6-v2`):** Runs locally on CPU to generate 384-dimensional vector coordinate embeddings of text chunks.

---

## 🚀 Getting Started

Follow these steps to run the VoltStream dashboard locally on your machine.

### Prerequisites
- [Node.js](https://nodejs.org/) (for the frontend)
- [Python 3.10+](https://www.python.org/) (for the backend)
- A **Google Gemini API Key** (get one from Google AI Studio)

---

### 1. Run the Backend (FastAPI)

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv

   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file in the `backend/` root directory and add your API key:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   ```

5. **Load technical PDFs:** Place any technical manuals or PDFs you want the chatbot to read under `backend/data/` (e.g., `backend/data/VoltStream_Manual.pdf`). The service will automatically chunk, embed, and index them into ChromaDB on startup.

6. Start the server:
   ```bash
   uvicorn main:app --reload
   ```

The API will be available at `http://127.0.0.1:8000`. You can view the interactive Swagger UI docs at `http://127.0.0.1:8000/docs`.

---

### 2. Run the Frontend (React/Vite)

1. Open a **new** terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

The dashboard will be available at `http://localhost:5173`.

---

## ☁️ Deployment

- **Backend (Google Cloud Run):** Containerized via the provided `Dockerfile` and deployed as a scalable microservice.
- **Frontend (Firebase Hosting):** Built into static assets and hosted globally. *Note: The `api.js` service automatically detects the environment and switches to the live Cloud API URL when deployed in production.*

---

## 📄 License

This project is licensed under the MIT License.
