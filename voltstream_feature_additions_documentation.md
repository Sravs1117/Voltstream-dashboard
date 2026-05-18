# 🚀 VoltStream Dashboard — Feature Additions & Upgrades Documentation
### Focused Technical Guide on GenAI Bot, SQLite Layer, Asynchronous Telemetry, & UI Optimizations

---

> [!NOTE]
> This document details **exclusively the newly added and modified files** in the VoltStream Dashboard project, separating them from the original baseline repository (`Sravs1117/Voltstream-dashboard`). It highlights the database layers, background async threads, GenAI routers, and UX speed optimizations introduced during the recent development sprint.

---

## 🗂️ 1. Summary of Added & Modified Files
Below is the precise list of additions and modifications made to the original repository structure:

```
voltstream-dashboard/
├── backend/
│   ├── main.py                     ◄── [MODIFIED] Added Lifespan (DB creation, seed, telemetry, RAG startup)
│   ├── requirements.txt            ◄── [MODIFIED] Added google-genai, langchain, PyMuPDF, sentence-transformers
│   ├── api/
│   │   ├── api.py                  ◄── [MODIFIED] Registered `/chat` and `/qa` routers
│   │   ├── dashboard.py            ◄── [MODIFIED] Switched from mock metrics to SQLite telemetry
│   │   ├── devices.py              ◄── [MODIFIED] Switched from in-memory dictionaries to SQLite queries
│   │   └── qa.py                   ◄── [NEW] Strict grounded RAG search router
│   ├── db/                         ◄── [NEW FOLDER] Relational Storage & SQLAlchemy Layer
│   │   ├── database.py             ◄── [NEW] Engine creation, Session maker, and db session dependency
│   │   ├── models.py               ◄── [NEW] DB schemas (Device, PowerReading models)
│   │   ├── mock_db.py              ◄── [NEW] Startup seed records
│   │   └── crud.py                 ◄── [NEW] DB transaction functions (seeding, toggles, telemetry logging)
│   └── services/
│       ├── telemetry_service.py    ◄── [NEW] Async simulated sensor worker running on a 3s loop
│       ├── gemini_service.py       ◄── [MODIFIED] Upgraded to new google-genai SDK & PDF text extractor
│       └── rag_service.py          ◄── [MODIFIED] Implemented strict LangChain-ChromaDB RAG pipeline
│
└── frontend/
    └── src/
        ├── components/
        │   ├── Layout.jsx          ◄── [MODIFIED] Added chat widget integration
        │   └── FloatingChat.jsx    ◄── [NEW] Premium dual-engine glassmorphism chatbot UI
        └── pages/
            └── SmartControl.jsx    ◄── [MODIFIED] Integrated Optimistic UI updates with state rollbacks
```

---

## 💾 2. The SQLite Database Integration (`backend/db/`)
To replace the volatile, hardcoded mock responses of the baseline, a persistent SQLAlchemy-managed relational SQLite database layer was introduced.

### 🔌 Database Connection (`backend/db/database.py`)
Creates the engine pointing to `sqlite:///./voltstream.db` and exposes the thread-local database session:
```python
DATABASE_URL = "sqlite:///./voltstream.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```
*Note: `check_same_thread: False` was added to safely allow multi-threaded requests from the FastAPI server.*

### 📐 DB Schemas (`backend/db/models.py`)
Two tables are initialized on server startup:
1.  **`Device` Table**: Holds IoT smart appliances (`id`, `name`, `type`, `is_on`, `power_w`).
2.  **`PowerReading` Table**: Archives temporal telemetry metrics (`id`, `timestamp`, `grid_draw_kw`, `solar_gen_kw`, `net_usage_kw`).

### 🛠️ DB Transactions (`backend/db/crud.py`)
Provides database helper methods called by routers:
*   `seed_db(db)`: Runs in FastAPI lifespan; automatically populates initial devices and starting telemetry if tables are empty.
*   `get_devices(db)` / `get_device(db, device_id)`: Fetches records directly from SQLite.
*   `update_device_state(db, device_id, is_on)`: Updates the operating status of an appliance and dynamically applies load footprints (e.g., active AC consumes ~1.4kW, inactive consumes 0.0kW).
*   `add_power_reading(db, grid_draw_kw, solar_gen_kw)`: Archives a new telemetry row.
*   `fluctuate_active_devices_power(db)`: Slices dynamic noise into power draw values of active devices to make energy readings feel alive.

---

## 📡 3. Asynchronous Telemetry Service (`backend/services/`)
To simulate live household energy currents without blocking normal client operations, a non-blocking background simulation worker was engineered.

### 🔄 Simulation Worker Loop (`backend/services/telemetry_service.py`)
Runs on an asynchronous thread within the FastAPI lifecycle:
1.  **State Fluctuations**: Every 3 seconds, it triggers `fluctuate_active_devices_power` to introduce slight voltage noises for active appliances.
2.  **Summing Demands**: Queries the SQLite database to compute total load demands from active appliances:
    $$\text{total\_device\_kw} = \sum (\text{power\_w of active devices}) / 1000$$
3.  **Solar & Grid Modeling**: Simulates solar panels generating $2.0\text{ kW}$ to $5.5\text{ kW}$ of power. Computes grid draw as a baseline house load ($0.4\text{ kW}$) + total appliance load + noise.
4.  **Logging**: Writes a new record to the `PowerReading` database table.

---

## 🤖 4. Dual-Engine GenAI Bot Infrastructure

We added two distinct GenAI backends accessed through a single visual chat window in the React frontend.

```
                      ┌───────────────────────┐
                      │   FloatingChat.jsx    │
                      └───────────┬───────────┘
                                  │
                  User selects conversational mode
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
          [Normal AI Mode]               [Strict RAG Mode]
          Calls: /api/v1/chat            Calls: /api/v1/qa
          ┌───────┴───────┐              ┌───────┴───────┐
          │  Gemini SDK   │              │  LangChain    │
          │ (2.5-Flash)   │              │ (2.5-Flash)   │
          │               │              │               │
          │ System Manual │              │ Chroma Vector │
          │ Memory (10)   │              │ Retrieval     │
          │ Optional PDF  │              │               │
          └───────┬───────┘              └───────┬───────┘
                  │                               │
                  │                               ├─► Context Found?
                  │                               │     │ Yes: Generate Answer
                  │                               │     └─► No: Return Fallback
                  ▼                               ▼
        ┌───────────────────────────────────────────┐
        │           Final Rounded Response          │
        └───────────────────────────────────────────┘
```

### 🧠 Engine A: The Conversational AI (`backend/services/gemini_service.py`)
Uses the official **`google-genai`** SDK to build a versatile virtual assistant.
*   **VoltStream Manual Injections**: Instructed with a structured `SYSTEM_PROMPT` explaining all dashboard modules, analytics rules, IoT controls, and billing setups.
*   **Conversational Memory**: Receives client chat histories and maps the last 10 messages into standard Gemini conversational SDK parameters (`user` vs `model` turns).
*   **Optional PDF Reading**: Supports ad-hoc document queries. If the user attaches a file, PyMuPDF (`fitz`) extracts the text and injects it into the prompt context.
*   **Fallback Logic**: Answers any general-knowledge request (code debugging, quick facts, movies) without restrictions.

### 📚 Engine B: Grounded RAG Search (`backend/services/rag_service.py` & `api/qa.py`)
A highly strict, LangChain-driven vector Q&A pipeline targeting local knowledge bases.
*   **Text Ingestor**: Startup routines read PDFs in `backend/data/` (e.g., `energyefficient.pdf`) and segment content using `RecursiveCharacterTextSplitter` into $500$-character chunks.
*   **Vector Engine**: Converts text chunks into normalized 384-dimensional dense vectors via the HuggingFace `sentence-transformers/all-MiniLM-L6-v2` model and stores them inside local **ChromaDB** index pools.
*   **Grounded Search**: Retrieves the top-5 relevant document segments matching the query.
*   **Strict Fallback Policy**: If the vector documents do not contain the answer, it returns exactly: `"I don't have that information."` with zero hallucinations.
*   **Page Sources**: Dynamically reports back exactly which document and page number (e.g., `energyefficient.pdf (page 3)`) the answer was pulled from.

---

## ⚡ 5. Frontend UI & Latency Optimizations

We overhauled key frontend components to create an instantaneous, lag-free user experience.

### 🏎️ Latency Buster: Optimistic UI Toggles (`SmartControl.jsx`)
In the baseline, clicking an appliance switch caused a $0.4\text{s}$ latency lag while the app made a REST call, awaited the DB rewrite, and triggered a global skeleton fetch.

**We replaced this with Optimistic UI updates**:
1.  **Immediate Toggle**: Clicking a switch immediately updates the local React state (`localDevices`), causing the button to flip states instantly.
2.  **Silent Background Fetch**: Dispatches the `api.toggleDevice` PATCH request quietly in the background without launching global loading spinners.
3.  **Automatic Error Rollback**:
    ```javascript
    const handleToggle = async (id, newState) => {
      // 1. Instantly update UI optimistically
      setLocalDevices(prev => prev.map(d => d.id === id ? { ...d, is_on: newState } : d));
      try {
        // 2. Perform background API call
        await api.toggleDevice(id, newState);
      } catch (err) {
        // 3. Rollback on network/server failure
        setLocalDevices(prev => prev.map(d => d.id === id ? { ...d, is_on: !newState } : d));
        alert("Failed to update device. Rolling back.");
      }
    };
    ```

### 🎨 Refined Floating Chat Widget (`FloatingChat.jsx`)
A modern, floating glassmorphism assistant was added to the bottom-right corner:
*   **Clean Greeting**: Removed the large, distracting text box notification ("Ask VoltStream Bot"), replacing it with a neat and welcoming `"Hello 👋"` floating tooltip.
*   **High-Fidelity Animations**: Bouncing typing bubbles (`vsDotBounce`), pop-in widgets (`vsPopIn`), and message fade-up micro-animations (`vsFadeUp`) built purely with tailored HSL color frameworks.
*   **Mode Switcher Badge**: Integrated a button that lets users toggle between **Normal AI (Gemini)** and **RAG Q&A (ChromaDB)** modes, changing dynamic placeholders and badges in real-time.

---

## 📋 6. Endpoint Catalog of Additions
These are the new endpoints added to route chatbot operations and device registrations:

| API Pathway | Method | Payload Scheme | Response Model | Operation Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/chat/` | `POST` | Multipart/Form: `message`, `history` (JSON str), `pdf` (Optional File) | `ChatResponse` | Passes query to Gemini 2.5 Flash SDK, tracking conversation memory and parsing optional file attachments. |
| `/api/v1/qa/` | `POST` | JSON: `QARequest` | `QAResponse` | Performs dense vector searches against ChromaDB indices and returns grounded answers or strict fallbacks. |
| `/api/v1/devices` | `POST` | JSON: `DeviceCreate` | `DeviceResponse` | Registers a new smart appliance inside the relational SQLite database. Returns `400` if the device ID already exists. |

