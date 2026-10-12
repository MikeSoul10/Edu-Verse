import React from 'react';

/**
 * Componente SVG de iconos vectoriales unificado para Edu-Verse.
 * Evita la duplicación masiva de paths SVG en múltiples vistas.
 */
const ICON_PATHS = {
  tablero: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="14" rx="1.5" />
    </>
  ),
  grafica: (
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
  ),
  chat: (
    <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8z" strokeLinejoin="round" />
  ),
  mas: (
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  ),
  filtro: (
    <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </>
  ),
  volver: (
    <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cerrar: (
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  ),
  check: (
    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  ),
  circulo: (
    <circle cx="12" cy="12" r="9" />
  ),
  alerta: (
    <>
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  enviar: (
    <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z" strokeLinejoin="round" />
  ),
  usuarios: (
    <>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M17 4.2a3.5 3.5 0 0 1 0 6.6M22 20v-1.5a4 4 0 0 0-3-3.9" strokeLinecap="round" />
    </>
  ),
  copiar: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15V5.5A2.5 2.5 0 0 1 7.5 3H15" strokeLinecap="round" />
    </>
  ),
  basura: (
    <>
      <path d="M4 7h16M10 4h4M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  spinner: (
    <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" strokeLinecap="round" />
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" strokeLinecap="round" />
    </>
  ),
  editar: (
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" strokeLinejoin="round" />
  ),
  salir: (
    <>
      <path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  menu: (
    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
  ),
  documento: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" strokeLinecap="round" />
    </>
  ),
  subir: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
    </>
  ),
  capas: (
    <>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" strokeLinejoin="round" />
      <path d="m3 12.5 9 4.5 9-4.5" strokeLinejoin="round" />
      <path d="m3 17 9 4.5 9-4.5" strokeLinejoin="round" />
    </>
  ),
  estrella: (
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" strokeLinejoin="round" />
  ),
  estrellaLlena: (
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
  ),
  izquierda: (
    <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  derecha: (
    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
  ),
};

const Icono = ({ nombre, className = 'w-5 h-5', relleno = false }) => {
  const path = ICON_PATHS[nombre];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
};

export default Icono;
