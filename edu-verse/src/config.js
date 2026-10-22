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
    // Una cuenta suspendida responde 403 en todas sus peticiones: sin esto el
    // usuario seguiría con la sesión "viva" en la interfaz, sin poder hacer nada.
    const cuentaSuspendida = error.response?.status === 403 &&
      typeof msg === 'string' && msg.toLowerCase().includes('suspendid');
    if (teniaSesion && (sesionExpirada || cuentaSuspendida)) {
      ['token', 'usuario_id', 'usuario', 'foto_url', 'rol'].forEach((clave) => localStorage.removeItem(clave));
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
