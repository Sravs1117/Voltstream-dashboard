import axios from 'axios';

// HARDCODED logic to absolutely guarantee it uses the deployed backend
const isProd = import.meta.env.PROD;
const baseURL = isProd 
  ? 'https://voltstream-api-883519779329.us-central1.run.app/api/v1' 
  : 'http://127.0.0.1:8000/api/v1';

const apiClient = axios.create({
  baseURL: baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Add an interceptor to help debug the actual URL requested
apiClient.interceptors.request.use(request => {
  console.log('Sending API Request to:', request.baseURL + request.url);
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
};

export default api;
