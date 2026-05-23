import axios from 'axios';
import { supabase } from '../config/supabaseClient';

const trimTrailingSlashes = (value) => String(value || '').replace(/\/+$/, '');
const stripApiSuffix = (value) => trimTrailingSlashes(value).replace(/\/api$/i, '');

const API_URL = stripApiSuffix(import.meta.env.VITE_API_URL || 'https://yogidesk-ai.com');
const API_BASE_URL = `${API_URL}/api`;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const readStoredSessionToken = () => {
  try {
    const session = JSON.parse(localStorage.getItem('sb-access-token') || '{}');
    return session?.access_token || null;
  } catch {
    return null;
  }
};

// Add request interceptor to include auth token
api.interceptors.request.use(
  async (config) => {
    const { data } = await supabase.auth.getSession();
    const token = readStoredSessionToken() || data?.session?.access_token || localStorage.getItem('token');

    if (typeof config.url === 'string' && trimTrailingSlashes(config.baseURL).endsWith('/api')) {
      config.url = config.url.replace(/^\/api(?=\/|$)/, '');
    }
    if (token) {
      config.headers = config.headers || {};
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
    const status = Number(error.response?.status);
    if (status === 401 || status === 403) {
      console.log("Session expired or invalid");
      localStorage.clear();
      alert("You have been logged out because you logged in on another device.");
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_URL, API_BASE_URL };
