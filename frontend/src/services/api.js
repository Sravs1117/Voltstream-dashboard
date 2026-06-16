import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://voltstream-api-883519779329.us-central1.run.app/api/v1'
    : 'http://127.0.0.1:8000/api/v1');

// console.log('[api.js] env debug', {
//   href: window.location.href,
//   origin: window.location.origin,
//   prod: import.meta.env.PROD,
//   dev: import.meta.env.DEV,
//   viteApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
//   resolvedBaseURL: baseURL,
// });

const apiClient = axios.create({
  baseURL: baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Add an interceptor to help debug the actual URL requested
apiClient.interceptors.request.use(request => {
  // console.log('[api.js] axios request', {
  //   method: request.method,
  //   baseURL: request.baseURL,
  //   url: request.url,
  //   fullURL: `${request.baseURL || ''}${request.url || ''}`,
  // });
  return request;
});

export const api = {
  // Dashboard
  getLivePower: () => apiClient.get('/dashboard/live'),

  // Analytics
  getAnalyticsHistory: (period = 'daily') =>
    apiClient.get(`/analytics/history?period=${period}`),

  // Devices
  getDevices: () => apiClient.get('/devices'),
  toggleDevice: (id, isOn) =>
    apiClient.patch(`/devices/${id}`, { is_on: isOn }),
  addDevice: (device) =>
    apiClient.post('/devices', device),

  // Billing
  getBillingSummary: () => apiClient.get('/billing/summary'),

  // Chat
  sendMessage: (message, pdfFile = null) => {
    const formData = new FormData();
    formData.append('message', message);
    if (pdfFile) {
      formData.append('pdf', pdfFile);
    }
    return apiClient.post('/chat/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Multi-Agent Insights (Usage History page)
  runInsights: (prompt, period = 'weekly') =>
    apiClient.post('/insights', { prompt, period, session_id: 'insights_session' }),
};

export default api;
