import React, { useEffect, useState, useMemo } from 'react';
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

// Hash estable: la misma materia siempre toma el mismo color.
const tono = (materia = '') => {
  let h = 0;
  for (let i = 0; i < materia.length; i++) h = (h * 31 + materia.charCodeAt(i)) % 9973;
  return PALETA[h % PALETA.length];
};

const esPdf = (url = '') => /\.pdf($|\?)/i.test(url);
const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';

const Icono = ({ nombre, className = 'w-5 h-5' }) => {
  const paths = {
    documento: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" /><path d="M14 3v5h5" strokeLinejoin="round" /></>,
    buscar: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></>,
    reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></>,
    usuarios: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3.5" /><path d="M17 4.2a3.5 3.5 0 0 1 0 6.6M22 20v-1.5a4 4 0 0 0-3-3.9" strokeLinecap="round" /></>,
    capas: <><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" strokeLinejoin="round" /><path d="m3 12.5 9 4.5 9-4.5" strokeLinejoin="round" /><path d="m3 17 9 4.5 9-4.5" strokeLinejoin="round" /></>,
    derecha: <><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      {paths[nombre]}
    </svg>
  );
};

const tiempoRelativo = (fecha) => {
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

const Apuntes = () => {
  const [listaApuntes, setListaApuntes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [materiaActiva, setMateriaActiva] = useState('todas');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/apuntes`);
        if (Array.isArray(res.data)) setListaApuntes(res.data);
        setFallo(false);
      } catch {
        setFallo(true);
        toast.error('No se pudo cargar el repositorio');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // Materias ordenadas por cantidad: las mas usadas quedan a mano.
  const categorias = useMemo(() => {
    const conteo = new Map();
    listaApuntes.forEach((a) => {
      const m = a.materia || 'Sin materia';
      conteo.set(m, (conteo.get(m) || 0) + 1);
    });
    return [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  }, [listaApuntes]);

  const resumen = useMemo(() => {
    const autores = new Set(listaApuntes.map((a) => a.autor).filter(Boolean));
    return { total: listaApuntes.length, autores: autores.size, materias: categorias.length };
  }, [listaApuntes, categorias]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return listaApuntes.filter((a) => {
      if (materiaActiva !== 'todas' && (a.materia || 'Sin materia') !== materiaActiva) return false;
      if (q && !`${a.titulo} ${a.materia || ''} ${a.autor || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [listaApuntes, materiaActiva, busqueda]);

  const Skeleton = () => (
    <div className="ev-panel-glass overflow-hidden rounded-2xl" aria-hidden="true">
      <div className="h-28 bg-slate-200/70 dark:bg-slate-700/70 animate-pulse" />
      <div className="p-5">
        <div className="h-3 w-20 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mb-3" />
        <div className="h-5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mb-2" />
        <div className="h-3 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
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
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-amber-400/20 blur-2xl" />
          <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30 pointer-events-none" />

          <div className="relative p-8 text-center sm:p-12">
            <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-white/12 ring-2 ring-white/25">
              <Icono nombre="capas" className="w-8 h-8 text-amber-200" />
            </span>
            <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight ev-enter ev-d-1">
              Repositorio de apuntes
            </h1>
            <p className="mt-3 text-blue-100 text-base sm:text-xl max-w-xl mx-auto ev-enter ev-d-2">
              Todo lo que la comunidad de Edu-Verse ha compartido, en un solo lugar.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2.5 ev-enter ev-d-3">
              {[
                { t: `${resumen.total} apuntes`, i: 'capas' },
                { t: `${resumen.materias} materias`, i: 'documento' },
                { t: `${resumen.autores} autores`, i: 'usuarios' },
              ].map((c) => (
                <span key={c.t} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-sm sm:text-base font-semibold">
                  <Icono nombre={c.i} className="w-4 h-4 text-amber-200" />
                  {c.t}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* ---------------- BUSCADOR Y FILTROS ---------------- */}
        {!cargando && !fallo && listaApuntes.length > 0 && (
          <div className="ev-panel-glass ev-card-dash relative mt-6 overflow-hidden rounded-2xl p-4 sm:p-5 ev-enter ev-d-2">
            <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />

            <div className="relative flex flex-col gap-3 sm:flex-row">
              <div className="ev-field relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400">
                  <Icono nombre="buscar" className="w-5 h-5" />
                </span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por título, materia o autor..."
                  aria-label="Buscar apuntes"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-3.5 sm:py-4 pl-11 sm:pl-12 pr-4 text-base sm:text-lg text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {categorias.length > 1 && (
              <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/60 dark:border-slate-700/60 pt-4">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Materia</span>

                <button
                  type="button"
                  onClick={() => setMateriaActiva('todas')}
                  aria-pressed={materiaActiva === 'todas'}
                  className={`ev-chip ev-focusable cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    materiaActiva === 'todas'
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  Todas
                </button>

                {categorias.slice(0, 8).map(([materia, n]) => (
                  <button
                    key={materia}
                    type="button"
                    onClick={() => setMateriaActiva(materia)}
                    aria-pressed={materiaActiva === materia}
                    className={`ev-chip ev-focusable inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      materiaActiva === materia
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-blue-300 hover:text-blue-700'
                    }`}
                  >
                    {materia.length > 20 ? `${materia.slice(0, 20)}…` : materia}
                    <span className="tabular-nums opacity-70">{n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- GRID ---------------- */}
        <section className="mt-8" aria-label="Apuntes">
          {!cargando && !fallo && listaApuntes.length > 0 && (
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {materiaActiva === 'todas' ? 'Todos los apuntes' : materiaActiva}
              </h2>
              <span className="rounded-full bg-blue-50 dark:bg-blue-500/15 px-4 py-1.5 text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                {filtrados.length} {filtrados.length === 1 ? 'archivo' : 'archivos'}
              </span>
            </div>
          )}

          {cargando ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <Skeleton key={n} />)}
            </div>
          ) : fallo ? (
            <div className="ev-panel-glass relative overflow-hidden rounded-[2rem] px-6 py-14 text-center ev-enter">
              <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-12 h-44 w-44 rounded-full bg-red-200/40 blur-2xl" />
              <div className="relative">
                <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-red-50 text-red-400">
                  <Icono nombre="documento" className="w-8 h-8" />
                </span>
                <h2 className="mt-5 text-2xl font-extrabold text-slate-900 dark:text-slate-100">No pudimos cargar el repositorio</h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg font-medium">
                  Revisá tu conexión o intentá de nuevo en un momento.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="ev-btn ev-focusable mt-6 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-lg font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Reintentar
                </button>
              </div>
            </div>
          ) : listaApuntes.length === 0 ? (
            <div className="ev-panel-glass relative overflow-hidden rounded-[2rem] px-6 py-14 text-center ev-enter">
              <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-12 h-44 w-44 rounded-full bg-blue-200/40 blur-2xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-14 h-56 w-56 rounded-full bg-amber-300/30 blur-2xl" />
              <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />

              <div className="relative">
                <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-blue-50 dark:bg-blue-500/15 text-blue-400">
                  <Icono nombre="capas" className="w-8 h-8" />
                </span>
                <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  Todavía no hay apuntes
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg font-medium max-w-lg mx-auto">
                  Sé la primera persona en compartir material con la comunidad.
                </p>
                <Link
                  to="/upload"
                  className="ev-btn ev-shimmer ev-focusable mt-6 inline-flex cursor-pointer items-center gap-2.5 rounded-2xl bg-blue-600 px-7 py-4 text-xl font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Subir el primero
                </Link>
              </div>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="ev-panel-glass rounded-2xl px-6 py-12 text-center ev-view">
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Sin resultados</p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">Probá con otro término o quitá los filtros.</p>
              <button
                type="button"
                onClick={() => { setBusqueda(''); setMateriaActiva('todas'); }}
                className="ev-btn ev-focusable mt-5 cursor-pointer rounded-xl border border-blue-200 dark:border-blue-500/35 bg-white px-5 py-2.5 font-bold text-blue-700 hover:bg-blue-50"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtrados.map((item, i) => {
                const t = tono(item.materia);
                const tiempo = tiempoRelativo(item.fecha_subida);
                return (
                  <article
                    key={item.apunte_id}
                    className={`ev-panel-glass ev-card-dash group flex flex-col overflow-hidden rounded-2xl ev-enter ${['ev-d-0', 'ev-d-1', 'ev-d-2', 'ev-d-3'][i % 4]}`}
                  >
                    <Link
                      to={`/apunte/${item.apunte_id}`}
                      className={`relative block overflow-hidden bg-gradient-to-br ${t.fondo} ev-focusable`}
                    >
                      <div aria-hidden="true" className="absolute inset-0 opacity-20 ev-dotfield" />
                      <div aria-hidden="true" className="absolute -top-8 -right-6 w-24 h-24 bg-white/20 rounded-full blur-2xl" />
                      <div className="relative grid h-28 place-items-center">
                        <span className="text-white/95 transition-transform duration-300 group-hover:scale-110">
                          <Icono nombre="documento" className="w-10 h-10" />
                        </span>
                      </div>
                      {tiempo && (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                          <Icono nombre="reloj" className="w-3 h-3" />
                          {tiempo}
                        </span>
                      )}
                    </Link>

                    <div className="flex flex-1 flex-col p-5">
                      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${t.chip}`}>
                        {item.materia || 'Sin materia'}
                      </span>

                      <h3 className="mt-2.5 font-extrabold leading-snug text-slate-900 dark:text-slate-100 group-hover:text-blue-700 transition-colors line-clamp-2">
                        <Link to={`/apunte/${item.apunte_id}`} className="ev-focusable">
                          {item.titulo}
                        </Link>
                      </h3>

                      <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`ev-avatar grid place-items-center w-8 h-8 shrink-0 rounded-full bg-gradient-to-br ${t.fondo} text-[11px] font-bold text-white`}>
                            {iniciales(item.autor)}
                          </span>
                          <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-400">{item.autor || 'Anónimo'}</span>
                        </span>

                        <a
                          href={`${API_URL}${item.archivo_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Abrir ${esPdf(item.archivo_url) ? 'PDF' : 'archivo'} de ${item.titulo}`}
                          className="ev-btn ev-shimmer ev-shimmer-claro inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                        >
                          {esPdf(item.archivo_url) ? 'PDF' : 'Abrir'}
                          <Icono nombre="derecha" className="w-3.5 h-3.5" />
                        </a>
                      </div>
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

export default Apuntes;
