import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://yogidesk-ai.com/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log("Session expired or invalid");
      localStorage.clear();
      alert("You have been logged out because you logged in on another device.");
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_URL };