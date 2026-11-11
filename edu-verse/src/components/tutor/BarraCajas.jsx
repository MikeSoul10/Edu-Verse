import React from 'react';

const COLORES = ['bg-rose-400', 'bg-amber-400', 'bg-yellow-300', 'bg-lime-400', 'bg-emerald-500'];
const DIAS = ['1 día', '3 días', '7 días', '14 días', '30 días'];

/* Barra de las 5 cajas del sistema Leitner: cuántas tarjetas hay en cada
   nivel (caja 1 = por aprender, caja 5 = dominadas). */
export default function BarraCajas({ cajas = [0, 0, 0, 0, 0], compacta = false }) {
  const total = cajas.reduce((s, n) => s + n, 0);
  const resumen = cajas.map((n, i) => `Caja ${i + 1} (repaso cada ${DIAS[i]}): ${n}`).join(' · ');

  return (
    <div title={resumen}>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="img" aria-label={`Progreso por cajas. ${resumen}`}>
        {total > 0 && cajas.map((n, i) => (n ? <span key={i} className={COLORES[i]} style={{ width: `${(n / total) * 100}%` }} /> : null))}
      </div>
      {!compacta && (
        <div className="mt-1.5 grid grid-cols-5 gap-1 text-center text-[0.65rem] font-semibold text-slate-500 dark:text-slate-400" aria-hidden="true">
          {cajas.map((n, i) => (
            <span key={i}>
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${COLORES[i]}`} />
              {i === 0 ? 'Nuevas/1' : `Caja ${i + 1}`}: {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
