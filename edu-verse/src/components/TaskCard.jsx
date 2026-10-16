import React from 'react';
import Icono from './ui/Icono';

/** Presentación de una tarea; el gestor conserva el estado y las acciones. */
const TaskCard = ({
  tarea,
  prioridades,
  ordenEstados,
  estados,
  getDiasRestantes,
  tonoDesdeNombre,
  onDragStart,
  onDragEnd,
  onAbrir,
  onEliminar,
  onMover,
}) => {
  const pri = prioridades[tarea.prioridad] || prioridades.verde;
  const dias = getDiasRestantes(tarea.fecha_entrega);

  let claseFecha = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  let textoFecha = null;
  if (dias !== null) {
    if (dias <= 0) {
      claseFecha = 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300';
      textoFecha = dias === 0 ? 'Vence hoy' : dias === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(dias)} d`;
    } else if (dias <= 2) {
      claseFecha = 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300';
      textoFecha = `${dias} d`;
    } else {
      textoFecha = `${dias} d`;
    }
  }

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart(e, tarea)}
      onDragEnd={onDragEnd}
      onClick={() => onAbrir(tarea)}
      className="ev-tarea cursor-grab active:cursor-grabbing rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-sm leading-snug text-slate-800 dark:text-slate-200 flex-1">{tarea.titulo}</h4>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEliminar(tarea); }}
          className="ev-focusable grid place-items-center w-8 h-8 -mt-1 -mr-1 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
          aria-label={`Eliminar ${tarea.titulo}`}
        >
          <Icono nombre="basura" className="w-4 h-4" />
        </button>
      </div>

      {tarea.descripcion && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{tarea.descripcion}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${pri.bg} ${pri.text}`}>
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pri.color }} />
          {pri.label}
        </span>
        {tarea.fecha_entrega && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${claseFecha}`}>
            <Icono nombre="reloj" className="w-3 h-3" />
            {textoFecha || new Date(tarea.fecha_entrega).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {tarea.asignado_nombre && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className={`ev-avatar grid place-items-center w-5 h-5 rounded-full bg-gradient-to-br ${tonoDesdeNombre(tarea.asignado_nombre)} text-white text-[9px] font-bold`}>
            {tarea.asignado_nombre.charAt(0).toUpperCase()}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{tarea.asignado_nombre}</span>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1">
        {ordenEstados.filter((estado) => estado !== tarea.estado).map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={(e) => { e.stopPropagation(); onMover(tarea.tarea_id, estado); }}
            className="ev-focusable text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-blue-700 transition-colors"
            aria-label={`Mover a ${estados[estado].label}`}
          >
            → {estados[estado].label}
          </button>
        ))}
      </div>
    </article>
  );
};

export default TaskCard;
