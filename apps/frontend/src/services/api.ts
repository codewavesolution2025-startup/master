import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// ── Tokens en mémoire (jamais en localStorage) ────────────────────────────────
let accessToken: string | null = null;
let refreshToken: string | null = null;

accessToken = localStorage.getItem('sc_access_token');
refreshToken = localStorage.getItem('sc_refresh_token');
(window as any).__accessToken = accessToken;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  (window as any).__accessToken = access;
  localStorage.setItem('sc_access_token', access);   // ← ajouter
  localStorage.setItem('sc_refresh_token', refresh);  // ← ajouter
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('sc_access_token');   // ← ajouter
  localStorage.removeItem('sc_refresh_token');  // ← ajouter
};

export const getAccessToken = () => accessToken;

// ── Instance Axios principale ─────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Intercepteur requête : injecter le token ──────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Intercepteur réponse : refresh automatique si 401 ────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post('/api/v1/auth/refresh', {
          refreshToken,
        });

        accessToken = data.accessToken;
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
