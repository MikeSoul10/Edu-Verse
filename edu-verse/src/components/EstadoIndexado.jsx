import React from 'react';

/* Estado discreto del indexado de un apunte para el Tutor IA.
   El worker extrae el texto (PDF u OCR) para que el tutor pueda buscarlo y
   citarlo. Solo se muestra al dueño del apunte. */
const ESTADOS = {
  pendiente: {
    texto: 'Preparando para el Tutor IA',
    ayuda: 'En cola: pronto el Tutor IA podrá consultar este apunte.',
    clases: 'text-slate-500 dark:text-slate-400',
    punto: 'bg-slate-400',
  },
  procesando: {
    texto: 'Leyendo para el Tutor IA…',
    ayuda: 'Extrayendo el texto del archivo.',
    clases: 'text-blue-600 dark:text-blue-300',
    punto: 'bg-blue-500 animate-pulse',
  },
  listo: {
    texto: 'Disponible en el Tutor IA',
    ayuda: 'El Tutor IA puede buscar y citar este apunte.',
    clases: 'text-emerald-700 dark:text-emerald-300',
    punto: 'bg-emerald-500',
  },
  error: {
    texto: 'El Tutor IA no pudo leerlo',
    ayuda: 'No se pudo extraer el texto.',
    clases: 'text-amber-700 dark:text-amber-300',
    punto: 'bg-amber-500',
  },
};

export default function EstadoIndexado({ estado, error }) {
  const info = ESTADOS[estado];
  if (!info) return null;
  const ayuda = estado === 'error' && error ? error : info.ayuda;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${info.clases}`} title={ayuda}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${info.punto}`} />
      {info.texto}
      <span className="sr-only">. {ayuda}</span>
    </span>
  );
}
