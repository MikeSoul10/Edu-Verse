import React from 'react';
import { Link } from 'react-router-dom';

const Icono = ({ nombre, className = 'w-5 h-5' }) => {
  const paths = {
    volver: <><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></>,
    buscar: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></>,
    capas: <><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" strokeLinejoin="round" /><path d="m3 12.5 9 4.5 9-4.5" strokeLinejoin="round" /><path d="m3 17 9 4.5 9-4.5" strokeLinejoin="round" /></>,
    usuarios: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3.5" /><path d="M17 4.2a3.5 3.5 0 0 1 0 6.6M22 20v-1.5a4 4 0 0 0-3-3.9" strokeLinecap="round" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      {paths[nombre]}
    </svg>
  );
};

const ATAJOS = [
  { to: '/biblioteca', label: 'Biblioteca', icono: 'buscar', desc: 'Apuntes de tus compañeros' },
  { to: '/gestor-equipos', label: 'Gestor de equipos', icono: 'usuarios', desc: 'Tareas y tableros' },
  { to: '/mis-apuntes', label: 'Mis apuntes', icono: 'capas', desc: 'Lo que compartiste' },
];

const NotFound = () => {
  return (
    <div className="ev-bg-nexo min-h-[calc(100vh-64px)] flex items-center justify-center font-['Fredoka',sans-serif] relative overflow-hidden">
      <div className="ev-gridfield absolute inset-0 pointer-events-none" />
      <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-50 pointer-events-none" />

      <div className="relative w-full max-w-2xl px-4 sm:px-6 py-12 text-center">
        {/* El 404 con degradado de marca: antes era un h1 con opacity 0.2
            sobre blanco, que se leia como texto desvanecido y no como error. */}
        <p className="bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent text-8xl sm:text-9xl font-black tracking-tight ev-enter ev-d-0">
          404
        </p>

        <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 ev-enter ev-d-1">
          Te perdiste en el espacio
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-400 font-medium ev-enter ev-d-2">
          La página que buscás no existe o fue movida a otra galaxia.
        </p>

        <Link
          to="/"
          className="ev-btn ev-shimmer ev-focusable mt-7 inline-flex cursor-pointer items-center gap-2.5 rounded-2xl bg-blue-600 px-7 py-4 text-xl font-bold text-white shadow-md hover:bg-blue-700 ev-enter ev-d-3"
        >
          <Icono nombre="volver" className="w-6 h-6" />
          Volver al inicio
        </Link>

        {/* Atajos: un 404 es un dead end, darle salida evita el retroceso
            del navegador como unica opcion. */}
        <div className="mt-10 ev-enter ev-d-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">O seguí por acá</p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {ATAJOS.map((a) => (
              <li key={a.to}>
                <Link
                  to={a.to}
                  className="ev-panel-glass ev-card-dash group flex h-full flex-col items-center rounded-2xl p-5 text-center"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                    <Icono nombre={a.icono} className="w-6 h-6" />
                  </span>
                  <span className="mt-3 font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 transition-colors">
                    {a.label}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
