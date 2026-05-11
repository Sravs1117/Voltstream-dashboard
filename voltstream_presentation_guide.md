# 🎤 VoltStream Dashboard — Manager Presentation Guide
### How to Explain Your Code Step-by-Step, Clearly and Confidently

---

> [!IMPORTANT]
> **Before you start:** Open VS Code with the project, have the app running in the browser, and keep this guide beside you. Walk through each section in the exact order below.

---

## 🗂️ SECTION 1 — Start With the Big Picture (30 seconds)

**Say this first — before showing any code:**

> *"I built VoltStream, a full-stack energy monitoring dashboard. It has two parts — a Python backend that serves live data through APIs, and a React frontend that displays that data in real time. Let me walk you through both, starting from the backend and then the frontend."*

**Show:** A simple diagram you can draw on a whiteboard:
```
Browser (React) ──── HTTP Requests ────► FastAPI (Python) ──► Returns JSON Data
```

---

## 🏗️ SECTION 2 — Project Structure (1 minute)

**Open your file explorer or VS Code sidebar. Point to these folders and say:**

```
voltstream-dashboard/
├── backend/          ◄── "This is the server — Python FastAPI"
│   ├── main.py       ◄── "All API logic lives here"
│   ├── requirements.txt  ◄── "Lists the Python packages needed"
│   └── Dockerfile    ◄── "Used to deploy to the cloud"
│
└── frontend/         ◄── "This is the UI — React + Vite"
    └── src/
        ├── main.jsx      ◄── "Entry point — starts the React app"
        ├── App.jsx       ◄── "Sets up all the page routes"
        ├── components/   ◄── "Reusable UI pieces — Layout, Sidebar"
        ├── pages/        ◄── "Each screen the user sees"
        ├── services/     ◄── "How frontend talks to backend"
        └── hooks/        ◄── "Custom reusable React logic"
```

> *"This separation keeps things clean — backend handles data, frontend handles display."*

---

## 🐍 SECTION 3 — The Backend: `backend/main.py` (4 minutes)

**Open `main.py`. This is the most important file to show first.**

### Step 3.1 — App Initialization (Lines 1–10)
```python
from fastapi import FastAPI
app = FastAPI(title="VoltStream API", version="2.0.0")
```
> *"I used FastAPI — a modern Python framework that automatically creates documentation and validates data. This single line creates the whole server."*

---

### Step 3.2 — CORS Middleware (Lines 12–19)
```python
app.add_middleware(CORSMiddleware, allow_origins=[...], ...)
```
> *"CORS is a browser security rule. Without this, the browser would block the frontend from talking to the backend. I've allowed both the local development URL and the live deployed URL."*

---

### Step 3.3 — Data Models / Pydantic (Lines 21–51)
```python
class LivePowerStatus(BaseModel):
    grid_draw_kw: float
    solar_gen_kw: float
    net_usage_kw: float
```
> *"These are Pydantic models — they act as a contract. They define exactly what shape the data must be in. FastAPI uses these to automatically validate inputs and outputs. If the data doesn't match, it returns an error automatically."*

**Point to a few models:**
- `LivePowerStatus` → for the live dashboard
- `DeviceResponse` → for smart control page
- `BillingSummary` → for billing page

---

### Step 3.4 — Mock Device Database (Lines 52–63)
```python
mock_devices = {
    "dev_01": {"name": "Living Room AC", "is_on": True, "power_w": 1450.0},
    ...
}
```
> *"Since this is a demo, I'm using an in-memory dictionary as the database. In production, this would be replaced with a real database like PostgreSQL."*

---

### Step 3.5 — API Endpoints (Lines 65–145)

**Walk through each endpoint one by one:**

#### 🟢 Endpoint 1 — Live Power Status
```python
@app.get("/api/v1/dashboard/live", response_model=LivePowerStatus)
def get_live_power():
    solar = round(random.uniform(2.5, 6.0), 2)
    grid  = round(random.uniform(0.8, 3.5), 2)
    net   = round(grid - solar, 2)
    return LivePowerStatus(grid_draw_kw=grid, solar_gen_kw=solar, net_usage_kw=net)
```
> *"Every time someone visits the live dashboard, this endpoint generates realistic random power values — simulating real sensor data. It returns three values: solar generation, grid draw, and net usage."*

#### 🟢 Endpoint 2 — Analytics History
```python
@app.get("/api/v1/analytics/history")
def get_analytics_history(period: str = "daily"):
```
> *"This endpoint accepts a query parameter — 'daily', 'weekly', or 'monthly'. Based on that, it returns different time labels and random usage data. This powers the Usage History charts."*

#### 🟢 Endpoint 3 — Get All Devices
```python
@app.get("/api/v1/devices")
async def get_all_devices():
    await asyncio.sleep(0.4)  # Small delay to show loading states
```
> *"This returns all smart devices. Notice I added a small async delay — this is intentional, so the frontend can show a loading spinner. It makes the UI feel more realistic and professional."*

#### 🟢 Endpoint 4 — Toggle Device
```python
@app.patch("/api/v1/devices/{device_id}", response_model=DeviceResponse)
def toggle_device(device_id: str, update: DeviceUpdate):
    if device_id not in mock_devices:
        raise HTTPException(status_code=404, detail="Device not found")
```
> *"This is a PATCH endpoint — used to partially update a resource. When you flip a switch on the Smart Control page, this runs. It validates the device ID, updates the on/off state, and returns a 404 error if the device doesn't exist."*

#### 🟢 Endpoint 5 — Billing Summary
```python
@app.get("/api/v1/billing/summary", response_model=BillingSummary)
def get_billing_summary():
    return BillingSummary(current_balance=247.60, projected_bill=318.90, budget_limit=280.00)
```
> *"Simple endpoint returning hardcoded billing numbers. In a real app, this would query user billing records from a database."*

---

## ⚛️ SECTION 4 — The Frontend: How React Starts (2 minutes)

**Open `frontend/src/main.jsx`**

```jsx
const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```
> *"This is the entry point. `main.jsx` finds the `<div id='root'>` in `index.html` and mounts the entire React app into it. `BrowserRouter` enables navigation between pages without page reloads."*

---

**Open `frontend/src/App.jsx`**

```jsx
<Routes>
  <Route path='/' element={<Layout />}>
    <Route index element={<LiveDashboard />} />
    <Route path='history' element={<UsageHistory />} />
    <Route path='control' element={<SmartControl />} />
    <Route path='billing' element={<Invoices />} />
    <Route path='*' element={<NotFound />} />
  </Route>
</Routes>
```
> *"App.jsx defines all the routes — think of it as the table of contents. `Layout` wraps every page (provides the sidebar and header). Each child route renders inside the `<Outlet />` in Layout."*

**Draw this on the whiteboard:**
```
App.jsx
  └── Layout (sidebar + header)
        ├── /           → LiveDashboard
        ├── /history    → UsageHistory
        ├── /control    → SmartControl
        ├── /billing    → Invoices
        └── /*          → NotFound (404)
```

---

## 🧩 SECTION 5 — The Shared Layout: `components/Layout.jsx` (2 minutes)

**Open `Layout.jsx`**

> *"The Layout component renders the left sidebar and the top header. It appears on every page."*

**Point to key parts:**

### Sidebar Navigation
```jsx
const navItems = [
  { path: '/', label: 'Live Dashboard', icon: LayoutDashboard },
  { path: '/history', label: 'Usage History', icon: BarChart3 },
  { path: '/control', label: 'Smart Control', icon: SlidersHorizontal },
  { path: '/billing', label: 'Billing', icon: FileText },
];
```
> *"This array drives the navigation. I loop over it using `.map()` to create each nav link. Using `NavLink` from React Router, the active page link automatically gets a highlighted style — no manual CSS needed."*

### The Search Bar
```jsx
const handleSearch = (e) => {
  if (e.key === 'Enter' && searchQuery.trim()) {
    navigate(`/control?q=${encodeURIComponent(searchQuery.trim())}`);
  }
};
```
> *"When you type a device name and press Enter, it navigates to the Smart Control page and passes the search term as a URL query parameter. The Smart Control page then reads that parameter and filters the device list."*

### The `<Outlet />` Component
```jsx
<div className='p-10'>
  <Outlet />
</div>
```
> *"This is the most important line in Layout. `Outlet` is a React Router concept — it's a placeholder that renders whichever page route is currently active. This is how the same sidebar shows on every page."*

---

## 🔗 SECTION 6 — The API Service Layer: `services/api.js` (2 minutes)

**Open `services/api.js`**

```javascript
const baseURL = isProd 
  ? 'https://voltstream-api-883519779329.us-central1.run.app/api/v1'  // Cloud
  : 'http://127.0.0.1:8000/api/v1';                                   // Local
```
> *"I have one place that handles ALL communication with the backend. This is the Service Layer pattern — it keeps API logic out of the UI components. When running locally it hits `localhost:8000`. In production, it automatically switches to the deployed cloud URL."*

```javascript
export const api = {
  getLivePower:         () => apiClient.get('/dashboard/live'),
  getAnalyticsHistory:  (period) => apiClient.get(`/analytics/history?period=${period}`),
  getDevices:           () => apiClient.get('/devices'),
  toggleDevice:         (id, isOn) => apiClient.patch(`/devices/${id}`, { is_on: isOn }),
  getBillingSummary:    () => apiClient.get('/billing/summary'),
};
```
> *"Each function maps directly to one backend endpoint. The pages import these functions and call them — they never write raw URLs themselves."*

---

## 🪝 SECTION 7 — Custom Hook: `hooks/useApi.js` (2 minutes)

**Open `hooks/useApi.js`**

```javascript
export function useApi(apiFunction, autoFetch = true) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setIsLoading(true);
    try {
      const response = await apiFunction(...args);
      setData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiFunction]);
  
  return { data, isLoading, error, execute };
}
```

> *"This is a custom React Hook — reusable logic I wrote once, used in every page. It handles three states that every API call needs: `data` (what came back), `isLoading` (show spinner?), and `error` (something went wrong?).*
>
> *Without this hook, I'd have to repeat this logic in every component. Instead, any page can write just one line:*"

```javascript
const { data, isLoading, error, execute } = useApi(api.getDevices);
```

---

## 📄 SECTION 8 — Walk Through Each Page (5 minutes)

### Page 1: Live Dashboard — `pages/LiveDashboard.jsx`
**Navigate to `/` in the browser while explaining:**

> *"The Live Dashboard is the home page. It shows 4 KPI cards at the top — Solar Generated, Grid Imported, Battery Efficiency, and Total Consumption. Each card has an icon, a value, and a trend indicator showing whether usage went up or down."*

**Point to the chart:**
> *"The main area chart uses Recharts — a React charting library. It plots two lines — Grid Draw (blue) and Solar Generation (yellow) over 24 hours. I use gradient fills under each line to make it visually rich. The data animates in on load using `animationDuration`."*

**Point to the bottom stats bar:**
> *"The bottom section shows Peak Usage Time, Lowest Consumption, Efficiency Score, and Carbon Savings — all static display values in this demo."*

---

### Page 2: Usage History — `pages/UsageHistory.jsx`
**Navigate to `/history`:**

> *"This page calls the `getAnalyticsHistory` API. At the top, there are three toggle buttons — Daily, Weekly, Monthly. When you click one, it updates the `period` state, which triggers a new API call with that period as a parameter, and the chart updates."*

**Point to the bar chart:**
> *"The bar chart shows Consumption vs Solar Production side by side using Recharts' `BarChart`. Below it, there's an Area chart showing estimated daily cost — calculated by multiplying consumption by ₹0.28 per kWh."*

**Point to the stat cards:**
> *"These three cards compute totals dynamically using `.reduce()` on the chart data — so they always match whatever period is selected."*

---

### Page 3: Smart Control — `pages/SmartControl.jsx`
**Navigate to `/control`:**

> *"Smart Control shows all 8 connected devices fetched from the `/api/v1/devices` endpoint. Each device card shows its name, type, current power draw in kW, and an on/off toggle."*

**Click a toggle in the browser:**
> *"When I flip that toggle, it calls `api.toggleDevice(id, newState)` — sending a PATCH request to the backend. The backend updates the device state in memory, and then `execute()` is called again to refresh the list."*

**Point to the search feature:**
> *"The search bar in the top header is connected here via URL parameters. If I type 'AC' and press Enter, the URL changes to `/control?q=AC`, and this page reads that query param and filters the device list — without any API call."*

**Point to Automation button:**
> *"Clicking Automation opens a modal form where you pick a device, an action (on/off), and a time. The app then runs a `setInterval` every 5 seconds to check if the current time matches — and if it does, it automatically toggles that device."*

---

### Page 4: Billing & Invoices — `pages/Invoices.jsx`
**Navigate to `/billing`:**

> *"The billing page fetches the summary from the backend — current balance, projected bill, and budget limit. The third card dynamically changes color: if the projected bill exceeds the budget limit, it turns red and says 'Over Budget'."*

**Point to the invoice table:**
> *"Past invoices are listed here. Each row has a Download button. Clicking it generates a real PDF using the `jsPDF` library — it renders the invoice ID, date, amount, payment method, and a VoltStream header into a formatted PDF and downloads it."*

---

## 🐳 SECTION 9 — Deployment (1 minute)

**Open `backend/Dockerfile` in VS Code:**

> *"The backend is containerized using Docker. I wrote a `Dockerfile` that packages the FastAPI app so it can run anywhere without worrying about Python version differences."*

> *"I deployed the backend to **Google Cloud Run** and the frontend to **Firebase Hosting** — both are free-tier cloud services. The `api.js` file automatically switches the API URL to the cloud endpoint when running in production mode."*

---

## ✅ SECTION 10 — Summary / Closing (1 minute)

**Say this at the end:**

> *"To summarize — VoltStream is a full-stack project that demonstrates:*
> - *FastAPI for building a REST API with data validation*
> - *React + React Router for a multi-page SPA*
> - *Custom hooks for clean, reusable async logic*
> - *Recharts for interactive data visualization*
> - *Docker for containerization*
> - *Cloud deployment on Google Cloud Run and Firebase"*

---

## 🎯 TIPS FOR DELIVERY

| Do | Don't |
|---|---|
| ✅ Show the running app first, then go to code | ❌ Open code immediately without context |
| ✅ Point your cursor while explaining | ❌ Just read lines out loud |
| ✅ Use words like "this is where...", "notice here..." | ❌ Say "basically" or "kind of" repeatedly |
| ✅ Demo clicking things in the browser | ❌ Only talk, never show |
| ✅ Say "I chose X because Y" for decisions | ❌ Explain every single line |
| ✅ Keep it to 15–20 minutes total | ❌ Go longer than 20 minutes |

---

## 📋 SUGGESTED ORDER TO OPEN FILES

1. 🌐 **Browser** — Show the live app running first
2. 📁 **VS Code Sidebar** — Show the folder structure
3. `backend/main.py` — Backend API (Sections 3)
4. `frontend/src/main.jsx` — React entry point (Section 4)
5. `frontend/src/App.jsx` — Routing setup (Section 4)
6. `frontend/src/components/Layout.jsx` — Shared layout (Section 5)
7. `frontend/src/services/api.js` — API layer (Section 6)
8. `frontend/src/hooks/useApi.js` — Custom hook (Section 7)
9. `frontend/src/pages/LiveDashboard.jsx` — Page 1
10. `frontend/src/pages/UsageHistory.jsx` — Page 2
11. `frontend/src/pages/SmartControl.jsx` — Page 3
12. `frontend/src/pages/Invoices.jsx` — Page 4

---

> [!TIP]
> **Practice tip:** Do one full dry run alone the night before. Time yourself. The whole explanation should be 15–20 minutes. If you go over, cut page explanations shorter.
