/**
 * Utilidades de formateo y cálculo compartidas en Edu-Verse.
 */

import { API_URL } from '../config';

// Paleta categórica segura para daltónicos usada para asignaturas y etiquetas
export const TONOS_MATERIA = [
  { fondo: 'from-blue-500 to-indigo-600', chip: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300', punto: '#3b82f6' },
  { fondo: 'from-violet-500 to-purple-600', chip: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300', punto: '#8b5cf6' },
  { fondo: 'from-emerald-500 to-teal-600', chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', punto: '#10b981' },
  { fondo: 'from-amber-500 to-orange-600', chip: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300', punto: '#f59e0b' },
  { fondo: 'from-rose-500 to-red-600', chip: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300', punto: '#ec4899' },
  { fondo: 'from-cyan-500 to-sky-600', chip: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', punto: '#06b6d4' },
];

export const TONO_NEUTRO = {
  fondo: 'from-slate-500 to-slate-600',
  chip: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  punto: '#64748b',
};

/**
 * Hash determinista estable a partir de una cadena
 */
export const hashCadena = (texto = '') => {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) % 9973;
  }
  return h;
};

/**
 * Obtiene el esquema de color para una materia o etiqueta
 */
export const tonoDesdeMateria = (materia = '') => {
  const base = (!materia || materia === '__otras__') ? TONO_NEUTRO : TONOS_MATERIA[hashCadena(materia) % TONOS_MATERIA.length];
  return {
    ...base,
    f: base.fondo,
    c: base.chip,
    p: base.punto,
  };
};

/**
 * Genera iniciales en mayúscula (ej: "Juan Pérez" -> "JP")
 */
export const iniciales = (nombre = '') => {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
};

/**
 * Normaliza `usuarios.foto_url` a una URL utilizable.
 *
 * En la BD conviven dos formatos distintos:
 *   - "/uploads/perfiles/123.png"  (lo que guarda el backend al subir foto)
 *   - "default-avatar.png"         (nombre suelto, sin barra inicial)
 *
 * Concatenar `${API_URL}${foto}` a pelo producía "http://localhost:4000default-avatar.png"
 * en el segundo caso. Aquí se resuelve la barra, y si no hay nada se devuelve
 * null para que el llamador use su avatar de iniciales.
 *
 * OJO: `default-avatar.png` no existe en el repo, así que las filas que lo
 * apuntan igual dan 404. El <img> debe traer onError como respaldo.
 */
export const urlFoto = (foto) => {
  if (!foto) return null;
  const valor = String(foto).trim();
  if (!valor) return null;
  // Absolute wins: si algún día se guardan URLs de otro origen.
  if (/^https?:\/\//i.test(valor)) return valor;
  const ruta = valor.startsWith('/') ? valor : `/${valor}`;
  return `${API_URL}${ruta}`;
};

/**
 * Retorna fecha en formato relativo amigable ("Hoy", "Ayer", "Hace 3 días")
 */
export const tiempoRelativo = (fecha) => {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} sem`;
  return `Hace ${Math.floor(dias / 30)} mes${Math.floor(dias / 30) > 1 ? 'es' : ''}`;
};

/**
 * Formatea bytes a KB o MB
 */
export const formatoBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Trunca un texto largo agregando elipsis
 */
export const truncar = (texto = '', max = 60) => {
  if (!texto) return '';
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
};
