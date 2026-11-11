import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { exportarAnki } from './utilidades';

/* Mazo de flashcards de una sesión.
   - Estudiar: tarjeta con volteo 3D. "Lo sabía" la saca de la ronda,
     "Repasar" la manda al final. Atajos: Espacio/Enter voltea, ←/→ navega,
     1 = Lo sabía, 2 = Repasar, Esc cierra.
   - Editar: lista con edición y borrado de cada tarjeta.
   - Exportar: archivo de texto separado por tabuladores que Anki importa. */

function TarjetaEditable({ tarjeta, onGuardar, onEliminar }) {
  const [editando, setEditando] = useState(false);
  const [frente, setFrente] = useState(tarjeta.frente);
  const [reverso, setReverso] = useState(tarjeta.reverso);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!frente.trim() || !reverso.trim()) return;
    setGuardando(true);
    const ok = await onGuardar(tarjeta.id, { frente: frente.trim(), reverso: reverso.trim() });
    setGuardando(false);
    if (ok) setEditando(false);
  };

  const campo = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white';

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      {editando ? (
        <div className="space-y-2">
          <textarea value={frente} onChange={(e) => setFrente(e.target.value)} rows={2} maxLength={300} className={campo} aria-label="Frente" />
          <textarea value={reverso} onChange={(e) => setReverso(e.target.value)} rows={3} maxLength={1000} className={campo} aria-label="Reverso" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditando(false); setFrente(tarjeta.frente); setReverso(tarjeta.reverso); }} className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando || !frente.trim() || !reverso.trim()} className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-800 dark:text-slate-100">{tarjeta.frente}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{tarjeta.reverso}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button type="button" onClick={() => setEditando(true)} className="cursor-pointer rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-700" aria-label="Editar tarjeta" title="Editar">✏️</button>
            <button type="button" onClick={() => onEliminar(tarjeta.id)} className="cursor-pointer rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700" aria-label="Eliminar tarjeta" title="Eliminar">🗑</button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Flashcards({ mazo, onCerrar, onRegenerar, regenerando, onEditar, onEliminar }) {
  const [modo, setModo] = useState('estudiar');
  // Cola de ids pendientes en esta ronda de repaso.
  const [cola, setCola] = useState(() => mazo.tarjetas.map((t) => t.id));
  const [posicion, setPosicion] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const [sabidas, setSabidas] = useState(0);

  const porId = useMemo(() => new Map(mazo.tarjetas.map((t) => [t.id, t])), [mazo.tarjetas]);
  const colaValida = useMemo(() => cola.filter((id) => porId.has(id)), [cola, porId]);
  const actual = porId.get(colaValida[Math.min(posicion, colaValida.length - 1)]);
  const terminado = colaValida.length === 0;

  const reiniciar = useCallback(() => {
    setCola(mazo.tarjetas.map((t) => t.id));
    setPosicion(0);
    setVolteada(false);
    setSabidas(0);
  }, [mazo.tarjetas]);

  const mover = useCallback((delta) => {
    setVolteada(false);
    setPosicion((p) => (colaValida.length ? (p + delta + colaValida.length) % colaValida.length : 0));
  }, [colaValida.length]);

  const responder = useCallback((loSabia) => {
    if (!actual) return;
    setVolteada(false);
    setCola((c) => {
      const resto = c.filter((id) => id !== actual.id);
      return loSabia ? resto : [...resto, actual.id];
    });
    if (loSabia) setSabidas((n) => n + 1);
    setPosicion((p) => {
      const largo = loSabia ? colaValida.length - 1 : colaValida.length;
      return largo > 0 ? Math.min(p, largo - 1) : 0;
    });
  }, [actual, colaValida.length]);

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape') { onCerrar(); return; }
      if (modo !== 'estudiar' || terminado) return;
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setVolteada((v) => !v); }
      else if (e.key === 'ArrowRight') mover(1);
      else if (e.key === 'ArrowLeft') mover(-1);
      else if (e.key === '1') responder(true);
      else if (e.key === '2') responder(false);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [modo, terminado, mover, responder, onCerrar]);

  const pestaña = (valor, etiqueta) => (
    <button
      type="button"
      onClick={() => setModo(valor)}
      aria-pressed={modo === valor}
      className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${modo === valor ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
    >
      {etiqueta}
    </button>
  );

  const cara = 'absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-2xl p-6 text-center shadow-lg sm:p-10';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="flashcards-titulo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="ev-enter-pop flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl dark:bg-slate-900">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <h2 id="flashcards-titulo" className="truncate text-lg font-black text-slate-900 dark:text-white">🃏 {mazo.tema}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{mazo.tarjetas.length} tarjetas</p>
          </div>
          <div className="flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            {pestaña('estudiar', 'Estudiar')}
            {pestaña('editar', 'Editar')}
          </div>
          <button type="button" onClick={onCerrar} className="ev-focusable grid h-9 w-9 cursor-pointer place-items-center rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Cerrar flashcards">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {mazo.tarjetas.length === 0 ? (
            <p className="py-10 text-center text-slate-500">El mazo está vacío. Vuelve a generarlo.</p>
          ) : modo === 'estudiar' ? (
            terminado ? (
              <div className="py-8 text-center">
                <p className="text-5xl" aria-hidden="true">🎉</p>
                <p className="mt-3 text-xl font-black text-slate-900 dark:text-white">¡Ronda terminada!</p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">Dominaste las {sabidas} tarjetas.</p>
                <button type="button" onClick={reiniciar} className="mt-5 cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">Repasar otra vez</button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                  <span>Tarjeta {Math.min(posicion, colaValida.length - 1) + 1} de {colaValida.length} pendientes</span>
                  <span>✅ {sabidas} sabidas</span>
                </div>
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${(sabidas / mazo.tarjetas.length) * 100}%` }} />
                </div>

                <button
                  type="button"
                  onClick={() => setVolteada((v) => !v)}
                  className="ev-focusable relative block h-72 w-full cursor-pointer rounded-2xl sm:h-80"
                  style={{ perspective: '1200px' }}
                  aria-label={volteada ? 'Mostrar el frente' : 'Mostrar la respuesta'}
                >
                  <span
                    className="relative block h-full w-full transition-transform duration-500"
                    style={{ transformStyle: 'preserve-3d', transform: volteada ? 'rotateY(180deg)' : 'none' }}
                  >
                    <span className={`${cara} bg-white dark:bg-slate-800`} style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                      <span className="mb-3 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">{actual?.tipo}</span>
                      <span className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{actual?.frente}</span>
                      <span className="mt-4 text-xs text-slate-400">Toca o pulsa Espacio para voltear</span>
                    </span>
                    <span className={`${cara} bg-gradient-to-br from-indigo-600 to-violet-600 text-white`} style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <span className="text-lg leading-relaxed sm:text-xl">{actual?.reverso}</span>
                    </span>
                  </span>
                </button>

                <div className="mt-5 grid grid-cols-[auto_1fr_1fr_auto] gap-2">
                  <button type="button" onClick={() => mover(-1)} className="cursor-pointer rounded-xl border border-slate-300 px-3 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Anterior">←</button>
                  <button type="button" onClick={() => responder(false)} className="cursor-pointer rounded-xl bg-amber-100 py-3 font-bold text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200">🔁 Repasar <kbd className="ml-1 hidden text-xs opacity-60 sm:inline">2</kbd></button>
                  <button type="button" onClick={() => responder(true)} className="cursor-pointer rounded-xl bg-emerald-100 py-3 font-bold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200">✅ Lo sabía <kbd className="ml-1 hidden text-xs opacity-60 sm:inline">1</kbd></button>
                  <button type="button" onClick={() => mover(1)} className="cursor-pointer rounded-xl border border-slate-300 px-3 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Siguiente">→</button>
                </div>
                <p className="mt-3 hidden text-center text-xs text-slate-400 sm:block">Atajos: Espacio voltear · ← → navegar · 1 lo sabía · 2 repasar · Esc cerrar</p>
              </>
            )
          ) : (
            <ul className="space-y-3">
              {mazo.tarjetas.map((t) => (
                <TarjetaEditable key={t.id} tarjeta={t} onGuardar={onEditar} onEliminar={onEliminar} />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <button
            type="button"
            onClick={onRegenerar}
            disabled={regenerando}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Genera un mazo nuevo con todo lo investigado (reemplaza el actual)"
          >
            {regenerando ? 'Generando…' : '↻ Regenerar mazo'}
          </button>
          <button
            type="button"
            onClick={() => exportarAnki(mazo)}
            disabled={mazo.tarjetas.length === 0}
            className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Archivo de texto que se importa en Anki (Archivo → Importar)"
          >
            ⬇ Exportar a Anki
          </button>
        </footer>
      </div>
    </div>
  );
}
