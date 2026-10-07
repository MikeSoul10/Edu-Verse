import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/* ------------------------------------------------------------------
   Calendario de vencimientos del equipo.

   Se alimenta de `tareas`, que el padre ya tiene cargadas: no hace
   peticiones propias. El color de cada dia codifica urgencia, no estado:

     rojo   -> vencida o vence hoy
     ambar  -> vence en 1 a 3 dias
     azul   -> vence en 4 dias o mas

   El rojo esta reservado para urgencia en todo el proyecto, asi que el
   calendario no introduce un color nuevo: reutiliza los tres que el
   usuario ya aprendio a leer en las tarjetas y en el resumen.

   El popover se monta en un portal pegado a body. Vive dentro del header
   `ev-mesh`, que tiene overflow: hidden para recortar sus circulos
   decorativos: si el popover quedara en el arbol normal, el navegador lo
   cortaria a la altura del header y no se veria nunca.
   ------------------------------------------------------------------ */

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Convierte a clave YYYY-MM-DD en hora local. Usar toISOString() correria el
// calculo a UTC y podria corrimiento un dia el vencimiento.
const claveDia = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

// getDate() devuelve 0 para domingo, pero la semana arranca en lunes.
const columnaLunes = (d) => (d.getDay() + 6) % 7;

// El redondeo del dia se hace con las horas locales de ambos lados.
// Math.ceil((a - b) / 86400000) se corre un dia cuando hay cambio de hora.
const diasEntre = (a, b) => {
  const ma = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const mb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((ma - mb) / 86400000);
};

const ANCHO_POPOVER = 336;

const CalendarioVencimientos = ({ tareas, prioridades, onVerEnTablero }) => {
  const [mesVisible, setMesVisible] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [posPopover, setPosPopover] = useState(null);
  const contenedorRef = useRef(null);

  // Indice tareas por clave de dia una sola vez por cambio de `tareas`.
  const porDia = useMemo(() => {
    const mapa = new Map();
    tareas.forEach((t) => {
      if (!t.fecha_entrega || t.estado === 'completada') return;
      const d = new Date(t.fecha_entrega);
      if (Number.isNaN(d.getTime())) return;
      const k = claveDia(d);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(t);
    });
    return mapa;
  }, [tareas]);

  // La grilla siempre arranca en lunes y termina en domingo.
  const celdas = useMemo(() => {
    const primero = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
    const desplazamiento = columnaLunes(primero);
    const inicio = new Date(primero);
    inicio.setDate(inicio.getDate() - desplazamiento);

    return Array.from({ length: 42 }, (_, i) => {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + i);
      return { fecha: dia, enMes: dia.getMonth() === mesVisible.getMonth() };
    });
  }, [mesVisible]);

  const hoy = new Date();
  const claveHoy = claveDia(hoy);

  // Al elegir un dia se mide el contenedor para colocar el popover en
  // coordenadas de viewport. Se recalcula en scroll y resize porque el
  // popover es fixed: si no, se despegaria de su calendario.
  const abrirDia = (k) => {
    setDiaSeleccionado(k);
    const rect = contenedorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margen = 8;
    const centrado = rect.left + rect.width / 2 - ANCHO_POPOVER / 2;
    const maxDerecha = window.innerWidth - ANCHO_POPOVER - margen;
    setPosPopover({
      left: Math.max(margen, Math.min(centrado, maxDerecha)),
      top: rect.bottom + 8,
    });
  };

  useEffect(() => {
    if (!diaSeleccionado) return undefined;

    const repositionar = () => {
      const rect = contenedorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margen = 8;
      const centrado = rect.left + rect.width / 2 - ANCHO_POPOVER / 2;
      const maxDerecha = window.innerWidth - ANCHO_POPOVER - margen;
      setPosPopover({
        left: Math.max(margen, Math.min(centrado, maxDerecha)),
        top: rect.bottom + 8,
      });
    };

    const alClicFuera = (e) => {
      // Se ignora el click que abrio el popover: el listener se registra
      // en el mismo tick del click, asi que podria cerrar de inmediato.
      if (e.target instanceof Node && e.target.closest('[data-calendario]')) return;
      setDiaSeleccionado(null);
    };
    const alPresionarEsc = (e) => {
      if (e.key === 'Escape') setDiaSeleccionado(null);
    };

    window.addEventListener('scroll', repositionar, true);
    window.addEventListener('resize', repositionar);
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alPresionarEsc);

    return () => {
      window.removeEventListener('scroll', repositionar, true);
      window.removeEventListener('resize', repositionar);
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alPresionarEsc);
    };
  }, [diaSeleccionado]);

  const cambiarMes = (delta) => {
    setMesVisible((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setDiaSeleccionado(null);
  };

  const colorDia = (fecha) => {
    const lista = porDia.get(claveDia(fecha));
    if (!lista || lista.length === 0) return null;
    const diff = diasEntre(fecha, hoy);
    if (diff <= 0) return 'rojo';
    if (diff <= 3) return 'ambar';
    return 'azul';
  };

  const tareasDelDia = diaSeleccionado ? porDia.get(diaSeleccionado) || [] : [];

  const popover =
    diaSeleccionado && posPopover ? (
      <div
        role="dialog"
        aria-label={`Tareas que vencen el ${diaSeleccionado}`}
        style={{ left: posPopover.left, top: posPopover.top, width: ANCHO_POPOVER }}
        className="ev-burbuja fixed z-[60] rounded-2xl border border-blue-100 dark:border-blue-500/30 bg-white dark:bg-slate-900 p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">Vencen este día</p>
            <p className="mt-0.5 truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {new Date(`${diaSeleccionado}T00:00:00`).toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDiaSeleccionado(null)}
            aria-label="Cerrar detalle"
            className="ev-focusable grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {tareasDelDia.map((t) => {
            const pri = (prioridades && prioridades[t.prioridad]) || null;
            const dias = diasEntre(new Date(t.fecha_entrega), hoy);
            const textoPlazo =
              dias < 0
                ? `Venció hace ${Math.abs(dias)} d`
                : dias === 0
                  ? 'Vence hoy'
                  : dias === 1
                    ? 'Mañana'
                    : `En ${dias} d`;
            return (
              <li key={t.tarea_id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">{t.titulo}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  {pri ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${pri.bg} ${pri.text}`}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pri.color }} />
                      {pri.label}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className={`text-xs font-bold ${dias <= 0 ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>
                    {textoPlazo}
                  </span>
                </div>
                {t.asignado_nombre && (
                  <p className="mt-1.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{t.asignado_nombre}</p>
                )}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            onVerEnTablero?.(diaSeleccionado);
            setDiaSeleccionado(null);
          }}
          className="ev-btn ev-focusable mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
        >
          Ver en el tablero
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    ) : null;

  return (
    <div ref={contenedorRef} data-calendario className="relative">
      <div className="rounded-2xl bg-white/15 px-4 py-3 ring-2 ring-white/25 shadow-lg shadow-slate-900/10">
        {/* Mes + navegacion */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            className="ev-focusable grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/25 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <p className="text-sm font-black uppercase tracking-wide text-white">
            {MESES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
          </p>

          <button
            type="button"
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            className="ev-focusable grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/25 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden="true">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Encabezados de la semana */}
        <div className="mt-3 grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((d, i) => (
            <span key={d} className={`text-center text-[10px] font-black uppercase ${i >= 5 ? 'text-white/50' : 'text-white/75'}`}>
              {d}
            </span>
          ))}
        </div>

        {/* Grilla */}
        <div className="mt-1 grid grid-cols-7 gap-1">
          {celdas.map(({ fecha, enMes }) => {
            const k = claveDia(fecha);
            const lista = porDia.get(k);
            const color = colorDia(fecha);
            const esHoy = k === claveHoy;
            const activo = diaSeleccionado === k;

            return (
              <button
                key={k}
                type="button"
                onClick={() => lista && abrirDia(activo ? null : k)}
                disabled={!lista}
                aria-label={`${fecha.getDate()} de ${MESES[fecha.getMonth()]}${lista ? `: ${lista.length} ${lista.length === 1 ? 'tarea vence' : 'tareas vencen'}` : ''}`}
                aria-pressed={activo}
                className={`ev-focusable relative grid h-8 w-full place-items-center rounded-lg text-sm font-bold transition-colors ${
                  esHoy
                    ? 'bg-white text-blue-700 shadow-md'
                    : activo
                      ? 'bg-white/30 text-white ring-2 ring-white'
                      : lista
                        ? 'cursor-pointer text-white hover:bg-white/20'
                        : enMes
                          ? 'text-white/85'
                          : 'cursor-default text-white/25'
                }`}
              >
                {fecha.getDate()}

                {/* Punto de urgencia. Es un punto y no un fondo: el fondo
                    lo usa "hoy" y la celda ya tiene el tamano justo. */}
                {color && !esHoy && (
                  <span
                    className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                      color === 'rojo' ? 'ev-punto-critico bg-red-400' : color === 'ambar' ? 'bg-amber-300' : 'bg-sky-300'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-white/20 pt-2.5">
          {[
            { c: 'bg-red-400', t: 'Hoy o vencida' },
            { c: 'bg-amber-300', t: '1-3 días' },
            { c: 'bg-sky-300', t: '4+ días' },
          ].map((l) => (
            <span key={l.t} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white/85">
              <span className={`h-1.5 w-1.5 rounded-full ${l.c}`} aria-hidden="true" />
              {l.t}
            </span>
          ))}
        </div>
      </div>

      {popover && createPortal(popover, document.body)}
    </div>
  );
};

export default CalendarioVencimientos;
