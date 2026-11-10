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
  salir: (equipoId) => api.post(`/equipos/${equipoId}/salir`),
  expulsarMiembro: (equipoId, usuarioId) =>
    api.delete(`/equipos/${equipoId}/miembros/${usuarioId}`),
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

export default api;
