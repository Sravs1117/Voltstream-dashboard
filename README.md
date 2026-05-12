# ⚡ VoltStream Dashboard

VoltStream is a modern, full-stack energy monitoring and smart home management dashboard. It provides real-time insights into solar vs. grid power usage, historical consumption analytics, remote control for smart devices, and billing predictions.

## ✨ Features

- **Live Power Monitoring**: Real-time visualization of grid draw, solar generation, and net usage using beautifully animated `Recharts`.
- **Usage History**: Daily, weekly, and monthly bar and area charts showing historical consumption alongside estimated monetary costs.
- **Smart Device Control**: Remotely toggle smart appliances (ACs, EV Chargers, server racks) with real-time status updates and instant search filtering.
- **Billing & Invoices**: Track budget limits, project monthly bills, and dynamically download historical invoices as formatted PDFs.

## 🛠️ Tech Stack

**Frontend:**
- **React + Vite:** Extremely fast UI rendering and build times.
- **TailwindCSS:** Custom "Obsidian Glass" styling with dark/neon aesthetics.
- **Recharts:** Interactive, responsive data visualizations.
- **React Router:** Seamless Single Page Application (SPA) navigation.

**Backend:**
- **Python + FastAPI:** High-performance asynchronous API server.
- **Pydantic:** Strict data validation and schema definitions.
- **Uvicorn:** Lightning-fast ASGI server.
- **Docker:** Containerized for easy cloud deployment.

## 🚀 Getting Started

Follow these steps to run the VoltStream dashboard locally on your machine.

### Prerequisites
- [Node.js](https://nodejs.org/) (for the frontend)
- [Python 3.10+](https://www.python.org/) (for the backend)

### 1. Run the Backend (FastAPI)

Open a terminal and navigate to the backend directory:
```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload
```
The API will be available at `http://127.0.0.1:8000`. You can view the automatic Swagger UI docs at `http://127.0.0.1:8000/docs`.

### 2. Run the Frontend (React/Vite)

Open a **new** terminal window and navigate to the frontend directory:
```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
The dashboard will be available at `http://localhost:5173`.

## ☁️ Deployment

- **Backend (Google Cloud Run):** Containerized via the provided `Dockerfile` and deployed as a scalable microservice.
- **Frontend (Firebase Hosting):** Built into static assets and hosted globally. *Note: The `api.js` service automatically detects the environment and switches to the live Cloud API URL when deployed in production.*

## 📄 Documentation

For an in-depth look at the architecture, the specific challenges solved during development, and the future scope of the project, please refer to the detailed [VoltStream Project Documentation](./VoltStream_Project_Documentation.md).

## 📄 License

This project is licensed under the MIT License.
