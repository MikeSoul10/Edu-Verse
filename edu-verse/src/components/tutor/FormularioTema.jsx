import React, { useState } from 'react';
import { NIVELES } from './utilidades';

const EJEMPLOS = ['Normalización de bases de datos', 'Derivadas parciales', 'Modelo OSI', 'Ley de Ohm'];

/* Pantalla inicial: el estudiante elige tema, nivel y, si quiere, dudas
   concretas. Crea la sesión con la primera respuesta del tutor. */
export default function FormularioTema({ onCrear, cargando }) {
  const [tema, setTema] = useState('');
  const [nivel, setNivel] = useState('intermedio');
  const [preguntas, setPreguntas] = useState('');

  const enviar = (e) => {
    e.preventDefault();
    if (tema.trim().length < 2 || cargando) return;
    onCrear({ tema: tema.trim(), nivel, preguntas: preguntas.trim() || undefined });
  };

  return (
    <form onSubmit={enviar} className="ev-enter mx-auto w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-800 sm:p-9">
      <div className="mb-6 flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-violet-50 dark:bg-violet-500/15">
          <img src="/Iconos/mascota_robot.png" alt="" className="h-14 w-14 object-contain" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">¿Qué quieres aprender hoy?</h2>
          <p className="text-slate-500 dark:text-slate-400">El tutor investiga en la web y te explica con fuentes.</p>
        </div>
      </div>

      <label htmlFor="tutor-tema" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Tema</label>
      <input
        id="tutor-tema"
        type="text"
        value={tema}
        onChange={(e) => setTema(e.target.value)}
        maxLength={200}
        placeholder="Ej. Normalización de bases de datos"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-500/20"
        autoFocus
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {EJEMPLOS.map((ej) => (
          <button
            key={ej}
            type="button"
            onClick={() => setTema(ej)}
            className="ev-focusable cursor-pointer rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
          >
            {ej}
          </button>
        ))}
      </div>

      <fieldset className="mt-6">
        <legend className="mb-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">Nivel</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {NIVELES.map((n) => (
            <label
              key={n.valor}
              className={`cursor-pointer rounded-xl border-2 px-4 py-3 transition-colors ${
                nivel === n.valor
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15'
                  : 'border-slate-200 hover:border-indigo-300 dark:border-slate-600'
              }`}
            >
              <input type="radio" name="nivel" value={n.valor} checked={nivel === n.valor} onChange={() => setNivel(n.valor)} className="sr-only" />
              <span className="block font-bold text-slate-800 dark:text-slate-100">{n.etiqueta}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{n.detalle}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="tutor-preguntas" className="mb-1.5 mt-6 block text-sm font-bold text-slate-700 dark:text-slate-300">
        Dudas concretas <span className="font-normal text-slate-400">(opcional)</span>
      </label>
      <textarea
        id="tutor-preguntas"
        value={preguntas}
        onChange={(e) => setPreguntas(e.target.value)}
        maxLength={4000}
        rows={3}
        placeholder="Ej. ¿Cuál es la diferencia entre 2FN y 3FN?"
        className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-500/20"
      />

      <button
        type="submit"
        disabled={tema.trim().length < 2 || cargando}
        className="ev-btn ev-shimmer mt-6 inline-flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-lg font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {cargando ? 'Investigando…' : 'Empezar a estudiar →'}
      </button>
    </form>
  );
}
