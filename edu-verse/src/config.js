import axios from 'axios';

export const API_URL = '';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.mensaje || error.response?.data || '';
    if (error.response?.status === 401 || (error.response?.status === 400 && typeof msg === 'string' && msg.includes('Token'))) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario_id');
      localStorage.removeItem('usuario');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
