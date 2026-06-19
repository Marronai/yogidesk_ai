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
let sessionExpiryRedirecting = false;

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const AUTH_LIFECYCLE_PUBLIC_PATHS = new Set([
  '/auth/request-email-otp',
  '/auth/verify-email-otp',
  '/auth/verify-phone-otp',
  '/auth/verify-login',
  '/auth/login',
]);

const normalizeRequestPath = (config = {}) => {
  const rawUrl = String(config.url || '');
  const rawPath = rawUrl.startsWith('http')
    ? new URL(rawUrl).pathname
    : rawUrl.split('?')[0];

  return rawPath
    .replace(/^\/api(?=\/|$)/, '')
    .replace(/\/+$/, '') || '/';
};

const readStoredSessionToken = () => {
  return readTokenFromStorageValue(localStorage.getItem('sb-access-token'))
    || readTokenFromStorageValue(sessionStorage.getItem('sb-access-token'));
};

const persistCurrentAccessToken = (token) => {
  if (!isJwtSegmentToken(token)) return;
  localStorage.setItem('sb-access-token', token);
  sessionStorage.setItem('sb-access-token', token);
};

const getFreshSupabaseSession = async () => {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  const expiresAtMs = Number(session?.expires_at || 0) * 1000;

  if (session?.access_token && (!expiresAtMs || expiresAtMs > Date.now() + 60000)) {
    persistCurrentAccessToken(session.access_token);
    return session;
  }

  if (session?.refresh_token || session?.access_token) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshedData?.session?.access_token) {
      persistCurrentAccessToken(refreshedData.session.access_token);
      return refreshedData.session;
    }
  }

  return session || null;
};

const clearStaleSupabaseSession = () => {
  localStorage.removeItem('sb-access-token');
  sessionStorage.removeItem('sb-access-token');
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  localStorage.removeItem('user_id');
  sessionStorage.removeItem('user_id');
  localStorage.removeItem('user_email');
  sessionStorage.removeItem('user_email');

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key);
  });
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) sessionStorage.removeItem(key);
  });
};

// Add request interceptor to include auth token
api.interceptors.request.use(
  async (config) => {
    if (typeof config.url === 'string' && trimTrailingSlashes(config.baseURL).endsWith('/api')) {
      config.url = config.url.replace(/^\/api(?=\/|$)/, '');
    }

    if (AUTH_LIFECYCLE_PUBLIC_PATHS.has(normalizeRequestPath(config))) {
      if (config.headers?.Authorization) delete config.headers.Authorization;
      return config;
    }

    const currentSession = await getFreshSupabaseSession();
    const token = currentSession?.access_token
      || readStoredSessionToken();

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
  async (error) => {
    const status = Number(error.response?.status);
    const payload = error.response?.data || {};
    const serializedPayload = JSON.stringify(payload).toUpperCase();
    const errorCode = String(payload.code || payload.error_code || '').toUpperCase();
    const isSessionExpired = status === 401 || errorCode === 'SESSION_EXPIRED' || serializedPayload.includes('SESSION_EXPIRED');
    const requestUrl = String(error.config?.url || '');
    const isSessionValidationRequest = requestUrl.includes('/auth/check-session');
    if (isSessionExpired && !(error.config?._yogideskRetriedAfterRefresh)) {
      const refreshedSession = await getFreshSupabaseSession().catch(() => null);
      if (refreshedSession?.access_token) {
        const retryConfig = {
          ...error.config,
          _yogideskRetriedAfterRefresh: true,
          headers: {
            ...(error.config?.headers || {}),
            Authorization: `Bearer ${refreshedSession.access_token}`,
          },
        };
        return api.request(retryConfig);
      }
    }

    if (isSessionExpired && !sessionExpiryRedirecting && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      sessionExpiryRedirecting = true;
      clearStaleSupabaseSession();
      window.location.href = '/login';
    } else if ((status === 401 || status === 403) && isSessionValidationRequest && !sessionExpiryRedirecting) {
      sessionExpiryRedirecting = true;
      clearStaleSupabaseSession();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_URL, API_BASE_URL };
