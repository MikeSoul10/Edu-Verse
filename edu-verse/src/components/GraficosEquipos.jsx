import React, { useState } from 'react';

/**
 * Gráfico de dona (donut) para distribución de estados.
 * SVG puro, sin dependencias externas.
 */
export const DonutEstados = ({ datos, total }) => {
  const [hover, setHover] = useState(null);

  const RADIO = 54;
  const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
  const GROSOR = 22;

  if (!total || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <svg width="140" height="140" viewBox="0 0 140 140" className="opacity-40">
          <circle
            cx="70" cy="70" r={RADIO}
            fill="none" stroke="#e8eef8" strokeWidth={GROSOR}
          />
          <text x="70" y="66" textAnchor="middle" className="fill-gray-400" fontSize="20" fontWeight="800">
            0
          </text>
          <text x="70" y="84" textAnchor="middle" className="fill-gray-400" fontSize="9" fontWeight="700">
            TAREAS
          </text>
        </svg>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Sin tareas para mostrar</p>
      </div>
    );
  }

  let acumulado = 0;

  return (
    <div className={`flex items-center gap-5 ${hover ? 'donut-highlight' : ''}`}>
      <div className="relative shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Distribución de tareas por estado">
          <circle
            cx="70" cy="70" r={RADIO}
            fill="none" stroke="#eef2f9" strokeWidth={GROSOR}
            className="donut-track"
          />
          {datos.map((d, i) => {
            if (d.valor === 0) return null;
            const fraccion = d.valor / total;
            const largo = fraccion * CIRCUNFERENCIA;
            const offset = -acumulado * CIRCUNFERENCIA;
            acumulado += fraccion;
            return (
              <circle
                key={d.clave}
                cx="70" cy="70" r={RADIO}
                fill="none"
                stroke={d.color}
                strokeWidth={hover === d.clave ? GROSOR + 7 : GROSOR}
                strokeDasharray={`${largo} ${CIRCUNFERENCIA - largo}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
                className="donut-segment"
                style={{ animationDelay: `${i * 0.15}s` }}
                onMouseEnter={() => setHover(d.clave)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
          <text
            x="70" y="66" textAnchor="middle"
            className={hover ? 'fill-blue-600' : 'fill-gray-800'}
            fontSize="26" fontWeight="800"
            style={{ transition: 'fill 0.2s ease' }}
          >
            {hover ? datos.find((d) => d.clave === hover)?.valor : total}
          </text>
          <text x="70" y="84" textAnchor="middle" className="fill-gray-400" fontSize="9" fontWeight="700">
            {hover ? datos.find((d) => d.clave === hover)?.label.toUpperCase() : 'TAREAS'}
          </text>
        </svg>
      </div>

      <ul className="flex-1 space-y-2 min-w-0">
        {datos.map((d, i) => (
          <li
            key={d.clave}
            className="flex items-center gap-2 text-xs cursor-default bar-row"
            style={{ animationDelay: `${0.2 + i * 0.1}s` }}
            onMouseEnter={() => setHover(d.clave)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0 transition-transform"
              style={{
                backgroundColor: d.color,
                transform: hover === d.clave ? 'scale(1.25)' : 'scale(1)',
              }}
            />
            <span className={`font-medium truncate ${hover === d.clave ? 'text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>
              {d.label}
            </span>
            <span className="ml-auto font-black text-gray-800 dark:text-slate-200 shrink-0">{d.valor}</span>
            <span className="text-gray-400 dark:text-slate-500 w-10 text-right shrink-0">
              {Math.round((d.valor / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Barras horizontales animadas por equipo.
 */
export const BarrasEquipos = ({ equipos }) => {
  if (!equipos || equipos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-xs text-gray-400 dark:text-slate-500">Sin datos de equipos</p>
      </div>
    );
  }

  const maxTareas = Math.max(...equipos.map((e) => e.totalTareas), 1);

  return (
    <div className="space-y-3.5">
      {equipos.map((eq, i) => {
        const pctTareas = (eq.totalTareas / maxTareas) * 100;
        const pctProgreso = eq.progreso;
        return (
          <div
            key={eq.equipo_id}
            className="bar-row"
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <p className="text-xs font-bold text-gray-700 dark:text-slate-300 truncate">{eq.nombre}</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
                <span className="font-black text-gray-700 dark:text-slate-300">{eq.totalTareas}</span> tareas · {eq.progreso}%
              </p>
            </div>
            <div className="w-full h-5 bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-lg bar-grow"
                style={{
                  width: `${Math.max(pctTareas, 3)}%`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 bar-grow"
                style={{
                  width: `${Math.max(pctProgreso, 2)}%`,
                  animationDelay: `${0.15 + i * 0.12}s`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Skeleton loader reutilizable.
 */
export const Skeleton = ({ className = '', rounded = 'rounded-xl' }) => (
  <div className={`skeleton ${rounded} ${className}`} aria-hidden="true" />
);

/**
 * Skeleton para las tarjetas de métricas del dashboard.
 */
export const SkeletonMetricas = ({ cantidad = 6 }) => (
  <div className="grid grid-cols-3 gap-3 mb-6">
    {Array.from({ length: cantidad }).map((_, i) => (
      <div
        key={i}
        className="rounded-2xl p-4 border border-blue-100/60 bg-white/60 dark:bg-slate-800/60 animate-fade-in-up"
        style={{ animationDelay: `${i * 0.06}s` }}
      >
        <Skeleton className="h-2.5 w-16 mb-3" rounded="rounded" />
        <Skeleton className="h-7 w-10" />
      </div>
    ))}
  </div>
);

/**
 * Skeleton para la barra de progreso.
 */
export const SkeletonBarra = () => (
  <div className="rounded-2xl p-5 border border-blue-100/60 bg-white/60 dark:bg-slate-800/60 mb-6 animate-fade-in-up">
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="h-3 w-32" rounded="rounded" />
      <Skeleton className="h-3 w-10" rounded="rounded" />
    </div>
    <Skeleton className="h-4 w-full" rounded="rounded-full" />
  </div>
);

/**
 * Skeleton para las tarjetas de estadísticas por equipo.
 */
export const SkeletonEquipos = ({ cantidad = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: cantidad }).map((_, i) => (
      <div
        key={i}
        className="rounded-2xl p-5 border border-blue-100/60 bg-white/60 dark:bg-slate-800/60 animate-fade-in-up"
        style={{ animationDelay: `${i * 0.1}s` }}
      >
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-5 w-10" />
        </div>
        <Skeleton className="h-2 w-full mb-3" rounded="rounded-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-2.5 w-full" rounded="rounded" />
          <Skeleton className="h-2.5 w-full" rounded="rounded" />
          <Skeleton className="h-2.5 w-full" rounded="rounded" />
          <Skeleton className="h-2.5 w-full" rounded="rounded" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton para las columnas del kanban.
 */
export const SkeletonKanban = ({ columnas = 3 }) => (
  <div className="flex gap-4 p-4">
    {Array.from({ length: columnas }).map((_, col) => (
      <div key={col} className="flex-1 min-w-[280px] rounded-2xl bg-blue-50/40 p-3">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: col === 0 ? 3 : 2 }).map((_, card) => (
            <div key={card} className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-blue-50">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-3/4 mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16" rounded="rounded-full" />
                <Skeleton className="h-4 w-14" rounded="rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);