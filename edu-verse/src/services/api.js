import { api } from '../config';

// Reexporta la instancia configurada para mantener un solo cliente REST.
export { api };

export const ApuntesAPI = {
  getTodos: () => api.get('/apuntes'),
  getDetalle: (id) => api.get(`/apuntes/detalle/${id}`),
  getMisApuntes: (usuarioId) => api.get(`/apuntes/mis-apuntes/${usuarioId}`),
  eliminar: (id) => api.delete(`/apuntes/${id}`),
  crear: (formData, onProgress) =>
    api.post('/apuntes/upload', formData, {
      onUploadProgress: onProgress,
    }),
};

export const EquiposAPI = {
  getMisEquipos: (usuarioId) => api.get(`/equipos/mis-equipos/${usuarioId}`),
  getMiembros: (equipoId) => api.get(`/equipos/${equipoId}/miembros`),
  crearEquipo: (datos) => api.post('/equipos/crear', datos),
  unirse: (datos) => api.post('/equipos/unirse', datos),
  salir: (equipoId, usuarioId) => api.post(`/equipos/${equipoId}/salir`, { usuarioId }),
  getTareas: (equipoId) => api.get(`/tareas/equipo/${equipoId}`),
};

export const AdminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsuarios: () => api.get('/admin/usuarios'),
  getBaneados: () => api.get('/admin/baneados'),
  getLogs: () => api.get('/admin/logs'),
  banUsuario: (usuarioId, motivo) => api.post('/admin/ban', { usuario_id: usuarioId, motivo }),
  desbanUsuario: (email) => api.delete(`/admin/baneados/${encodeURIComponent(email)}`),
};

// Tutor IA. Las respuestas con búsqueda web tardan 30–60 s, de ahí el timeout.
const TIMEOUT_IA = 120000;
export const TutorAPI = {
  getSesiones: () => api.get('/api/tutor/sesiones'),
  getSesion: (id) => api.get(`/api/tutor/sesiones/${id}`),
  crearSesion: (datos) => api.post('/api/tutor/sesiones', datos, { timeout: TIMEOUT_IA }),
  preguntar: (id, datos) => api.post(`/api/tutor/sesiones/${id}/mensajes`, datos, { timeout: TIMEOUT_IA }),
  eliminarSesion: (id) => api.delete(`/api/tutor/sesiones/${id}`),
  generarFlashcards: (id) => api.post(`/api/tutor/sesiones/${id}/flashcards`, null, { timeout: TIMEOUT_IA }),
  getMazo: (id) => api.get(`/api/mazos/${id}`),
  editarTarjeta: (id, datos) => api.patch(`/api/flashcards/${id}`, datos),
  eliminarTarjeta: (id) => api.delete(`/api/flashcards/${id}`),
};

// Mensaje de error legible para cualquier fallo del Tutor IA.
export const mensajeErrorTutor = (err) => {
  if (err?.code === 'ECONNABORTED') return 'La IA tardó demasiado en responder. Intenta de nuevo.';
  if (!err?.response) {
    return typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'Sin conexión a internet. Revisa tu red e intenta de nuevo.'
      : 'No se pudo conectar con el servidor. Intenta de nuevo.';
  }
  const datos = err.response.data;
  if (datos?.mensaje) return datos.mensaje;
  if (err.response.status === 429) return 'Demasiadas peticiones. Espera un minuto e intenta de nuevo.';
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
};

export default api;
