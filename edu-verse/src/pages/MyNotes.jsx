import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { ApuntesAPI } from '../services/api';
import { tonoDesdeMateria } from '../utils/formatters';
import Icono from '../components/ui/Icono';

const MyNotes = () => {
  const { user } = useAuth();
  const [misApuntes, setMisApuntes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const usuarioId = user?.id;

  const cargarMisApuntes = useCallback(async () => {
    if (!usuarioId) {
      setCargando(false);
      return;
    }
    try {
      const res = await ApuntesAPI.getMisApuntes(usuarioId);
      setMisApuntes(Array.isArray(res.data) ? res.data : []);
      setFallo(false);
    } catch {
      setFallo(true);
      toast.error('No se pudieron cargar tus apuntes');
    } finally {
      setCargando(false);
    }
  }, [usuarioId]);

  const confirmarEliminar = async () => {
    if (!porEliminar) return;
    setBorrando(true);
    try {
      await ApuntesAPI.eliminar(porEliminar.apunte_id);
      setMisApuntes((prev) => prev.filter((a) => a.apunte_id !== porEliminar.apunte_id));
      toast.success('Apunte eliminado');
      setPorEliminar(null);
    } catch (err) {
      const mensaje = err.response?.data;
      toast.error(typeof mensaje === 'string' ? mensaje : 'No se pudo eliminar');
    } finally {
      setBorrando(false);
    }
  };

  useEffect(() => {
    cargarMisApuntes();
  }, [cargarMisApuntes]);

  // Escape cierra el modal de confirmacion.
  useEffect(() => {
    if (!porEliminar) return undefined;
    const alEsc = (e) => { if (e.key === 'Escape') setPorEliminar(null); };
    document.addEventListener('keydown', alEsc);
    return () => document.removeEventListener('keydown', alEsc);
  }, [porEliminar]);

  const Skeleton = () => (
    <div className="ev-panel-glass p-5" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
        <div className="flex-1">
          <div className="h-4 w-20 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mb-2" />
          <div className="h-5 w-3/4 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="ev-bg-nexo min-h-[calc(100vh-64px)] font-['Fredoka',sans-serif] relative">
      <div className="ev-gridfield absolute inset-0 pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-12">
        {/* ---------------- HEADER ---------------- */}
        <header className="ev-mesh relative overflow-hidden rounded-[2rem] text-white shadow-lg ev-enter ev-d-0">
          <div aria-hidden="true" className="pointer-events-none absolute -top-14 -left-14 h-48 w-48 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-amber-400/20 blur-2xl" />
          <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30 pointer-events-none" />

          <div className="relative flex flex-col gap-6 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-center lg:text-left">
              <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-white/12 ring-2 ring-white/25 lg:mx-0">
                <Icono nombre="capas" className="w-8 h-8 text-amber-200" />
              </span>
              <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight ev-enter ev-d-1">
                Mis apuntes
              </h1>
              <p className="mt-3 text-blue-100 text-base sm:text-xl ev-enter ev-d-2">
                Todo lo que compartiste con la comunidad de Edu-Verse.
              </p>
            </div>

            <Link
              to="/upload"
              className="ev-btn ev-shimmer ev-shimmer-claro ev-focusable inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-white px-7 py-4 text-xl font-bold text-blue-700 shadow-md"
            >
              <Icono nombre="mas" className="w-6 h-6" />
              Subir apunte
            </Link>
          </div>
        </header>

        {/* ---------------- LISTA ---------------- */}
        <section className="mt-8" aria-label="Mis apuntes">
          {!cargando && !fallo && misApuntes.length > 0 && (
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Compartidos
              </h2>
              <span className="rounded-full bg-blue-50 dark:bg-blue-500/15 px-4 py-1.5 text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                {misApuntes.length} {misApuntes.length === 1 ? 'apunte' : 'apuntes'}
              </span>
            </div>
          )}

          {cargando ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => <Skeleton key={n} />)}
            </div>
          ) : fallo ? (
            <div className="ev-panel-glass rounded-[2rem] px-6 py-14 text-center ev-enter">
              <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-red-50 text-red-400">
                <Icono nombre="alerta" className="w-8 h-8" />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold text-slate-900 dark:text-slate-100">No pudimos cargar tus apuntes</h2>
              <button
                type="button"
                onClick={cargarMisApuntes}
                className="ev-btn ev-focusable mt-6 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-lg font-bold text-white shadow-md hover:bg-blue-700"
              >
                Reintentar
              </button>
            </div>
          ) : misApuntes.length === 0 ? (
            <div className="ev-panel-glass relative overflow-hidden rounded-[2rem] px-6 py-14 text-center ev-enter">
              <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-12 h-44 w-44 rounded-full bg-blue-200/40 blur-2xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-14 h-56 w-56 rounded-full bg-amber-300/30 blur-2xl" />
              <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />

              <div className="relative">
                <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-blue-50 dark:bg-blue-500/15 text-blue-400">
                  <Icono nombre="capas" className="w-8 h-8" />
                </span>
                <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  Todavía no subiste nada
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg font-medium max-w-lg mx-auto">
                  Compartí tus apuntes y ayudá a tus compañeros a repasar más rápido.
                </p>
                <Link
                  to="/upload"
                  className="ev-btn ev-shimmer ev-focusable mt-6 inline-flex cursor-pointer items-center gap-2.5 rounded-2xl bg-blue-600 px-7 py-4 text-xl font-bold text-white shadow-md hover:bg-blue-700"
                >
                  <Icono nombre="mas" className="w-6 h-6" />
                  Subir mi primer apunte
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {misApuntes.map((apunte, i) => {
                const t = tonoDesdeMateria(apunte.materia);
                return (
                  <li
                    key={apunte.apunte_id}
                    className={`ev-panel-glass ev-card-dash flex flex-col gap-4 rounded-2xl p-5 ev-enter sm:flex-row sm:items-center ${['ev-d-0', 'ev-d-1', 'ev-d-2'][i % 3]}`}
                  >
                    <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${t.fondo} text-white`}>
                      <Icono nombre="documento" className="w-6 h-6" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${t.chip}`}>
                        {apunte.materia || 'Sin materia'}
                      </span>
                      <h3 className="mt-1.5 font-extrabold text-lg text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                        {apunte.titulo}
                      </h3>
                      {apunte.descripcion && (
                        <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{apunte.descripcion}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={`${API_URL}${apunte.archivo_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ev-btn inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 sm:flex-none"
                      >
                        Ver
                        <Icono nombre="derecha" className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setPorEliminar(apunte)}
                        aria-label={`Eliminar ${apunte.titulo}`}
                        className="ev-focusable grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-slate-400 dark:text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Icono nombre="basura" className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ---------------- MODAL DE CONFIRMACION ---------------- */}
      {porEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="ev-overlay absolute inset-0 bg-slate-900/50"
            onClick={() => !borrando && setPorEliminar(null)}
            aria-hidden="true"
          />

          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-borrar"
            className="ev-modal relative w-full max-w-md overflow-hidden rounded-2xl"
          >
            <div className="p-6">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-500">
                <Icono nombre="basura" className="w-7 h-7" />
              </span>
              <h2 id="titulo-borrar" className="mt-4 text-center text-xl font-extrabold text-slate-900 dark:text-slate-100">
                ¿Eliminar este apunte?
              </h2>
              <p className="mt-2 text-center text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200">{porEliminar.titulo}</span> va a desaparecer
                para todos. No se puede deshacer.
              </p>
            </div>

            <div className="flex gap-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-6 py-4">
              <button
                type="button"
                onClick={() => setPorEliminar(null)}
                disabled={borrando}
                className="ev-btn ev-focusable flex-1 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={borrando}
                className="ev-btn ev-focusable flex-1 cursor-pointer rounded-xl bg-red-600 py-3 font-bold text-white shadow-md hover:bg-red-700 disabled:opacity-60"
              >
                {borrando ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyNotes;
