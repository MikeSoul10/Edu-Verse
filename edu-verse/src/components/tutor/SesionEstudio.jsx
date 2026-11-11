import React, { useEffect, useRef, useState } from 'react';
import Respuesta from './Respuesta';
import { etiquetaNivel } from './utilidades';

const PASOS_BUSQUEDA = ['Buscando fuentes…', 'Leyendo páginas…', 'Redactando la explicación…', 'Revisando las citas…'];

/* Indicador de carga por pasos. Los pasos son aproximados (la API no avisa
   en qué va), pero le dicen al estudiante que la espera de 30–60 s es normal. */
export function IndicadorCarga({ pasos = PASOS_BUSQUEDA, intervalo = 9000 }) {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPaso((p) => Math.min(p + 1, pasos.length - 1)), intervalo);
    return () => window.clearInterval(id);
  }, [pasos.length, intervalo]);

  return (
    <div role="status" aria-live="polite" className="ev-enter flex items-center gap-4 rounded-2xl border border-indigo-200/70 bg-indigo-50/70 p-5 dark:border-indigo-500/25 dark:bg-indigo-500/10">
      <img src="/Iconos/mascota_robot.png" alt="" className="ev-float h-12 w-12 object-contain" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-indigo-800 dark:text-indigo-200">{pasos[paso]}</p>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {pasos.map((p, i) => (
            <span key={p} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= paso ? 'bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-500/20'}`} />
          ))}
        </div>
        <p className="mt-2 text-xs text-indigo-700/70 dark:text-indigo-300/70">Puede tardar hasta un minuto.</p>
      </div>
    </div>
  );
}

const ACCIONES = [
  { etiqueta: '🧒 Más simple', display: 'Explícalo más simple', contenido: 'Explica lo anterior de forma más simple, como si fuera mi primera vez con el tema, usando una analogía cotidiana.' },
  { etiqueta: '💡 Ejemplos', display: 'Dame ejemplos', contenido: 'Dame 3 ejemplos concretos y resueltos paso a paso de lo que acabas de explicar.' },
  { etiqueta: '📝 Quiz', display: 'Hazme un quiz', contenido: 'Hazme un quiz de 5 preguntas de opción múltiple sobre lo visto. Pon las respuestas correctas con una breve explicación al final, bajo el título "Respuestas".' },
  { etiqueta: '📋 Resumen', display: 'Resume todo', contenido: 'Haz un resumen de todo lo visto en esta sesión en forma de puntos clave para repasar antes del examen.' },
];

/* Vista de conversación de una sesión: respuestas, acciones rápidas,
   preguntas de seguimiento, flashcards y descarga de apuntes. */
export default function SesionEstudio({ sesion, pendiente, cargando, onPreguntar, onFlashcards, onDescargar, onEliminar, generandoFlashcards }) {
  const [pregunta, setPregunta] = useState('');
  const finRef = useRef(null);
  const nivel = etiquetaNivel(sesion.nivel);
  const tieneRespuestas = sesion.mensajes.some((m) => m.rol === 'assistant');

  // Al llegar una respuesta o empezar una pregunta, se baja hasta el final.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [sesion.mensajes.length, pendiente]);

  const enviar = (e) => {
    e.preventDefault();
    const texto = pregunta.trim();
    if (!texto || cargando) return;
    onPreguntar({ contenido: texto });
    setPregunta('');
  };

  const alTeclear = (e) => {
    // Enter envía; Shift+Enter hace salto de línea.
    if (e.key === 'Enter' && !e.shiftKey) enviar(e);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-800">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-black text-slate-900 dark:text-white sm:text-2xl" title={sesion.tema}>{sesion.tema}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Nivel {nivel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onFlashcards}
            disabled={!tieneRespuestas || cargando || generandoFlashcards}
            className="ev-focusable inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            🃏 {sesion.mazo_id ? 'Flashcards' : 'Crear flashcards'}
          </button>
          <button
            type="button"
            onClick={onDescargar}
            disabled={!tieneRespuestas}
            className="ev-focusable inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Descargar apuntes en Markdown"
          >
            ⬇ Apuntes .md
          </button>
          <button
            type="button"
            onClick={onEliminar}
            disabled={cargando}
            className="ev-focusable inline-flex cursor-pointer items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-400"
            title="Eliminar sesión"
            aria-label="Eliminar sesión"
          >
            🗑
          </button>
        </div>
      </header>

      {sesion.mensajes.map((m, idx) =>
        m.rol === 'user' ? (
          <div key={m.id} className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-white shadow-sm">
              {m.display || m.contenido}
            </p>
          </div>
        ) : (
          <Respuesta
            key={m.id}
            mensaje={m}
            deshabilitado={cargando}
            // Solo la última respuesta ofrece subtemas clicables, para no
            // saltar de rama en rama desde respuestas viejas.
            onSubtema={idx === sesion.mensajes.length - 1
              ? (s) => onPreguntar({ contenido: `Explícame el subtema "${s}" en el contexto de ${sesion.tema}.`, display: s })
              : undefined}
          />
        )
      )}

      {pendiente && (
        <>
          <div className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-white opacity-80 shadow-sm">
              {pendiente.display || pendiente.contenido}
            </p>
          </div>
          <IndicadorCarga />
        </>
      )}

      {tieneRespuestas && !pendiente && (
        <div className="flex flex-wrap gap-2" aria-label="Acciones rápidas">
          {ACCIONES.map((a) => (
            <button
              key={a.etiqueta}
              type="button"
              disabled={cargando}
              onClick={() => onPreguntar({ contenido: a.contenido, display: a.display })}
              className="ev-focusable cursor-pointer rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-500/15"
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={enviar} className="sticky bottom-3 z-10 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        <label htmlFor="tutor-pregunta" className="sr-only">Pregunta de seguimiento</label>
        <textarea
          id="tutor-pregunta"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={alTeclear}
          rows={1}
          maxLength={4000}
          placeholder={cargando ? 'Esperando la respuesta…' : 'Haz una pregunta de seguimiento…'}
          disabled={cargando}
          className="max-h-40 min-h-[2.75rem] flex-1 resize-y rounded-xl bg-transparent px-3 py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white"
        />
        <button
          type="submit"
          disabled={!pregunta.trim() || cargando}
          className="ev-focusable grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Enviar pregunta"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      <div ref={finRef} />
    </div>
  );
}
