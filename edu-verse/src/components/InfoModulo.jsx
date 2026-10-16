import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* ------------------------------------------------------------------
   Boton de informacion de un modulo del Home.

   El boton va DENTRO de la tarjeta del modulo, pero el popover se monta en
   un portal a document.body. Motivo: el contenedor de las tarjetas tiene
   `overflow-hidden` (viene del diseno de la portada) y un popover dentro
   se cortaria justo por la mitad. El calendario de vencimientos tiene el
   mismo problema y lo resuelve igual.

   El popover se posiciona midiendo el boton y despues lo recalcula en
   scroll y resize, porque es `position: fixed` y se despegaria al hacer
   scroll.
   ------------------------------------------------------------------ */

const ANCHO = 300;

const InfoModulo = ({ texto, etiqueta }) => {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const botonRef = useRef(null);

  const medir = () => {
    const rect = botonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margen = 8;
    const centrado = rect.left + rect.width / 2 - ANCHO / 2;
    const maxDerecha = window.innerWidth - ANCHO - margen;
    setPos({
      left: Math.max(margen, Math.min(centrado, maxDerecha)),
      top: rect.bottom + 10,
    });
  };

  /* Este boton vive DENTRO del <Link> que envuelve la tarjeta del modulo.
     Sin preventDefault + stopPropagation, el clic sube al Link padre y React
     Router navega: el usuario pulsaba "info" y lo mandaba a otra pagina.

     Ojo con stopPropagation y el listener de clic fuera: este ultimo esta en
     `document`, y ahi los eventos ya no tienen tabu de propagacion. Por eso
     el popover necesita su propio marcador para que el listener lo ignore. */
  const alternar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (abierto) {
      setAbierto(false);
      return;
    }
    medir();
    setAbierto(true);
  };

  useEffect(() => {
    if (!abierto) return undefined;

    const alClicFuera = (e) => {
      // Ignora el clic que abrio el popover: el listener se registra en el
      // mismo tick y cerraria de inmediato.
      if (e.target instanceof Node && e.target.closest('[data-info-modulo], [data-info-popover]')) return;
      setAbierto(false);
    };
    const alPulsarEsc = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    document.addEventListener('pointerdown', alClicFuera);
    document.addEventListener('keydown', alPulsarEsc);

    return () => {
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
      document.removeEventListener('pointerdown', alClicFuera);
      document.removeEventListener('keydown', alPulsarEsc);
    };
  }, [abierto]);

  const popover =
    abierto && pos ? (
      <div
        role="tooltip"
        data-info-popover
        style={{ left: pos.left, top: pos.top, width: ANCHO }}
        className="ev-enter-pop fixed z-[70] rounded-2xl border border-blue-100 bg-white p-4 shadow-2xl dark:border-blue-500/30 dark:bg-slate-900"
      >
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{texto}</p>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        data-info-modulo
        onClick={alternar}
        aria-label={`Más información sobre ${etiqueta}`}
        aria-expanded={abierto}
        className="ev-focusable grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-300"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
        </svg>
      </button>

      {popover && createPortal(popover, document.body)}
    </>
  );
};

export default InfoModulo;