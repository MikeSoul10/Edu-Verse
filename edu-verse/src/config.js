import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// Todas las llamadas REST comparten esta instancia para aplicar la misma base
// URL, autenticación y gestión de sesión expirada.
export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.mensaje || error.response?.data || '';
    const teniaSesion = Boolean(error.config?.headers?.Authorization);
    const sesionExpirada = error.response?.status === 401 ||
      (error.response?.status === 400 && typeof msg === 'string' && msg.includes('Token'));
    if (teniaSesion && sesionExpirada) {
      ['token', 'usuario_id', 'usuario', 'foto_url', 'rol'].forEach((clave) => localStorage.removeItem(clave));
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
