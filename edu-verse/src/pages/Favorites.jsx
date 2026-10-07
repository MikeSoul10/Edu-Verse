import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const PALETA = [
  { fondo: 'from-blue-500 to-indigo-600', chip: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { fondo: 'from-violet-500 to-purple-600', chip: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  { fondo: 'from-emerald-500 to-teal-600', chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { fondo: 'from-amber-500 to-orange-600', chip: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { fondo: 'from-rose-500 to-red-600', chip: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  { fondo: 'from-cyan-500 to-sky-600', chip: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300' },
];

const tono = (materia = '') => {
  let h = 0;
  for (let i = 0; i < materia.length; i++) h = (h * 31 + materia.charCodeAt(i)) % 9973;
  return PALETA[h % PALETA.length];
};

const esPdf = (url = '') => /\.pdf($|\?)/i.test(url);
const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';

const Icono = ({ nombre, className = 'w-5 h-5', relleno = false }) => {
  const paths = {
    documento: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" /><path d="M14 3v5h5" strokeLinejoin="round" /></>,
    estrella: <><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" strokeLinejoin="round" /></>,
    estrellaLlena: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />,
    cerrar: <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />,
    capas: <><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" strokeLinejoin="round" /><path d="m3 12.5 9 4.5 9-4.5" strokeLinejoin="round" /><path d="m3 17 9 4.5 9-4.5" strokeLinejoin="round" /></>,
    derecha: <><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></>,
    capasDoc: <><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" strokeLinejoin="round" /><path d="m3 12.5 9 4.5 9-4.5" strokeLinejoin="round" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill={relleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      {paths[nombre]}
    </svg>
  );
};

const Favorites = () => {
  const [favoritos, setFavoritos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  const usuarioId = localStorage.getItem('usuario_id');

  const cargarFavoritos = useCallback(async () => {
    if (!usuarioId) {
      setCargando(false);
      return;
    }
    try {
      const res = await axios.get(`${API_URL}/favoritos/${usuarioId}`);
      setFavoritos(Array.isArray(res.data) ? res.data : []);
      setFallo(false);
    } catch {
      setFallo(true);
      toast.error('No se pudieron cargar tus favoritos');
    } finally {
      setCargando(false);
    }
  }, [usuarioId]);

  // El DELETE toma el usuario del token (verificarToken), no del body.
  // Mandarlo igual es inofensivo pero sugiere que se usa, y no se usa.
  const quitarFavorito = async (apunte) => {
    const previo = favoritos;
    setFavoritos((prev) => prev.filter((f) => f.apunte_id !== apunte.apunte_id));
    try {
      await axios.delete(`${API_URL}/favoritos`, { data: { apunte_id: apunte.apunte_id } });
      toast.success('Quitado de favoritos');
    } catch {
      setFavoritos(previo);
      toast.error('No se pudo quitar de favoritos');
    }
  };

  useEffect(() => {
    cargarFavoritos();
  }, [cargarFavoritos]);

  const resumen = useMemo(() => {
    const autores = new Set(favoritos.map((a) => a.autor).filter(Boolean));
    return { autores: autores.size, materias: new Set(favoritos.map((a) => a.materia)).size };
  }, [favoritos]);

  const Skeleton = () => (
    <div className="ev-panel-glass overflow-hidden rounded-2xl" aria-hidden="true">
      <div className="h-28 bg-amber-100 dark:bg-amber-500/20 animate-pulse" />
      <div className="p-5">
        <div className="h-3 w-20 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mb-3" />
        <div className="h-5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mb-5" />
        <div className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
    </div>
  );

  return (
    <div className="ev-bg-nexo min-h-[calc(100vh-64px)] font-['Fredoka',sans-serif] relative">
      <div className="ev-gridfield absolute inset-0 pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        {/* ---------------- HEADER ---------------- */}
        <header className="ev-mesh relative overflow-hidden rounded-[2rem] text-white shadow-lg ev-enter ev-d-0">
          <div aria-hidden="true" className="pointer-events-none absolute -top-14 -left-14 h-48 w-48 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-amber-400/30 blur-2xl" />
          <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30 pointer-events-none" />

          <div className="relative p-8 text-center sm:p-12">
            <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-amber-400/25 ring-2 ring-amber-300/40">
              <Icono nombre="estrellaLlena" relleno className="w-8 h-8 text-amber-300" />
            </span>
            <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight ev-enter ev-d-1">
              Mis favoritos
            </h1>
            <p className="mt-3 text-blue-100 text-base sm:text-xl max-w-xl mx-auto ev-enter ev-d-2">
              Los apuntes que guardaste para tenerlos siempre a mano.
            </p>

            {!cargando && !fallo && favoritos.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2.5 ev-enter ev-d-3">
                {[
                  { t: `${favoritos.length} guardados`, i: 'estrella' },
                  { t: `${resumen.materias} materias`, i: 'documento' },
                  { t: `${resumen.autores} autores`, i: 'capas' },
                ].map((c) => (
                  <span key={c.t} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-sm sm:text-base font-semibold">
                    <Icono nombre={c.i} relleno className="w-4 h-4 text-amber-200" />
                    {c.t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* ---------------- LISTA ---------------- */}
        <section className="mt-8" aria-label="Mis favoritos">
          {cargando ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <Skeleton key={n} />)}
            </div>
          ) : fallo ? (
            <div className="ev-panel-glass rounded-[2rem] px-6 py-14 text-center ev-enter">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">No pudimos cargar tus favoritos</h2>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ev-btn ev-focusable mt-6 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-lg font-bold text-white shadow-md hover:bg-blue-700"
              >
                Reintentar
              </button>
            </div>
          ) : favoritos.length === 0 ? (
            <div className="ev-panel-glass relative overflow-hidden rounded-[2rem] px-6 py-14 text-center ev-enter">
              <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-12 h-44 w-44 rounded-full bg-amber-200/40 blur-2xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-14 h-56 w-56 rounded-full bg-blue-200/30 blur-2xl" />
              <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />

              <div className="relative">
                <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-amber-50 dark:bg-amber-500/15 text-amber-400">
                  <Icono nombre="estrella" className="w-8 h-8" />
                </span>
                <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  Todavía no guardaste ninguno
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg font-medium max-w-lg mx-auto">
                  Tocá la estrella de cualquier apunte y te lo guardamos acá.
                </p>
                <Link
                  to="/biblioteca"
                  className="ev-btn ev-shimmer ev-focusable mt-6 inline-flex cursor-pointer items-center gap-2.5 rounded-2xl bg-blue-600 px-7 py-4 text-xl font-bold text-white shadow-md hover:bg-blue-700"
                >
                  <Icono nombre="capasDoc" className="w-6 h-6" />
                  Ir a la biblioteca
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {favoritos.map((apunte, i) => {
                const t = tono(apunte.materia);
                return (
                  <article
                    key={apunte.apunte_id}
                    className={`ev-panel-glass ev-card-dash group flex flex-col overflow-hidden rounded-2xl ev-enter ${['ev-d-0', 'ev-d-1', 'ev-d-2', 'ev-d-3'][i % 4]}`}
                  >
                    <Link
                      to={`/apunte/${apunte.apunte_id}`}
                      className={`relative block overflow-hidden bg-gradient-to-br ${t.fondo} ev-focusable`}
                    >
                      <div aria-hidden="true" className="absolute inset-0 opacity-20 ev-dotfield" />
                      <div aria-hidden="true" className="absolute -top-8 -right-6 w-24 h-24 bg-white/20 rounded-full blur-2xl" />
                      <div className="relative grid h-28 place-items-center">
                        <Icono nombre="documento" className="w-10 h-10 text-white/95 transition-transform duration-300 group-hover:scale-110" />
                      </div>
                      <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-amber-400/90 text-white shadow-md">
                        <Icono nombre="estrellaLlena" relleno className="w-4 h-4" />
                      </span>
                    </Link>

                    <div className="flex flex-1 flex-col p-5">
                      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${t.chip}`}>
                        {apunte.materia || 'Sin materia'}
                      </span>

                      <h3 className="mt-2.5 font-extrabold leading-snug text-slate-900 dark:text-slate-100 group-hover:text-blue-700 transition-colors line-clamp-2">
                        <Link to={`/apunte/${apunte.apunte_id}`} className="ev-focusable">
                          {apunte.titulo}
                        </Link>
                      </h3>

                      <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`ev-avatar grid place-items-center w-8 h-8 shrink-0 rounded-full bg-gradient-to-br ${t.fondo} text-[11px] font-bold text-white`}>
                            {iniciales(apunte.autor)}
                          </span>
                          <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-400">{apunte.autor || 'Anónimo'}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => quitarFavorito(apunte)}
                          aria-label={`Quitar ${apunte.titulo} de favoritos`}
                          className="ev-focusable ev-favorito grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-amber-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Icono nombre="cerrar" className="w-4 h-4" />
                        </button>
                      </div>

                      <a
                        href={`${API_URL}${apunte.archivo_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ev-btn ev-focusable mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                      >
                        {esPdf(apunte.archivo_url) ? 'Abrir PDF' : 'Abrir archivo'}
                        <Icono nombre="derecha" className="w-4 h-4" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Favorites;
