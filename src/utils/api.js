import axios from 'axios';
import { supabase } from '../config/supabaseClient';
import { isJwtSegmentToken, readTokenFromStorageValue } from './tokenGuards';

const trimTrailingSlashes = (value) => String(value || '').replace(/\/+$/, '');
const stripApiSuffix = (value) => trimTrailingSlashes(value).replace(/\/api$/i, '');
const PRODUCTION_FRONTEND_HOST = 'yogidesk-ai.com';
const PRODUCTION_API_URL = 'https://api.yogidesk-ai.com';

const resolveApiUrl = () => {
  const configuredUrl = stripApiSuffix(
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || PRODUCTION_API_URL
  );

  if (typeof window === 'undefined') return configuredUrl;

  const frontendHost = window.location.hostname.replace(/^www\./i, '');
  let configuredHost = '';
  try {
    configuredHost = new URL(configuredUrl).hostname.replace(/^www\./i, '');
  } catch {
    return PRODUCTION_API_URL;
  }

  if (frontendHost === PRODUCTION_FRONTEND_HOST && configuredHost === PRODUCTION_FRONTEND_HOST) {
    return PRODUCTION_API_URL;
  }

  return configuredUrl;
};

const API_URL = resolveApiUrl();
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
  return readTokenFromStorageValue(localStorage.getItem('sb-access-token'));
};

// Add request interceptor to include auth token
api.interceptors.request.use(
  async (config) => {
    const { data } = await supabase.auth.getSession();
    const token = readStoredSessionToken()
      || data?.session?.access_token;

    if (typeof config.url === 'string' && trimTrailingSlashes(config.baseURL).endsWith('/api')) {
      config.url = config.url.replace(/^\/api(?=\/|$)/, '');
    }
    if (isJwtSegmentToken(token)) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    } else if (token) {
      console.error('Blocked malformed JWT before Authorization injection:', token);
      localStorage.removeItem('sb-access-token');
    }
    const sessionEmail = localStorage.getItem('user_email') || sessionStorage.getItem('user_email');
    if (sessionEmail) {
      config.headers = config.headers || {};
      config.headers['X-YogiDesk-User-Email'] = sessionEmail;
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
    const requestUrl = String(error.config?.url || '');
    const isSessionValidationRequest = requestUrl.includes('/auth/check-session');
    if ((status === 401 || status === 403) && isSessionValidationRequest) {
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
