import React from 'react';
import { Link } from 'react-router-dom';
import Icono from './ui/Icono';
import { iniciales, tiempoRelativo } from '../utils/formatters';

const esPdfUrl = (url = '') => /\.pdf($|\?)/i.test(url);

/** Tarjeta compartida para el carrusel y la cuadrícula de la biblioteca. */
const ApunteCard = ({
  apunte,
  indice,
  tono,
  esFavorito,
  destacada = false,
  onAlternarFavorito,
  onPreview,
  urlArchivo,
}) => {
  const tiempo = tiempoRelativo(apunte.fecha_subida);
  const esPdf = esPdfUrl(apunte.archivo_url);

  return (
    <article
      className={`ev-panel-glass ev-card-dash group flex flex-col overflow-hidden rounded-2xl ev-enter ${
        ['ev-d-0', 'ev-d-1', 'ev-d-2', 'ev-d-3'][indice % 4]
      } ${destacada ? 'w-64 sm:w-72 shrink-0' : ''}`}
    >
      <div className="relative">
        {destacada && esPdf ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreview?.(apunte);
            }}
            aria-label={`Ver vista previa de ${apunte.titulo}`}
            className="ev-focusable group block w-full cursor-pointer overflow-hidden bg-slate-200 dark:bg-slate-700"
          >
            <iframe
              src={`${urlArchivo(apunte)}#page=1&view=FitH`}
              title={`Vista previa de ${apunte.titulo}`}
              loading="lazy"
              scrolling="no"
              className="pointer-events-none h-40 w-full"
            />
            <span className="pointer-events-none absolute inset-0 bg-slate-900/0 transition-colors duration-300 group-hover:bg-slate-900/25" />
            <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-blue-700 opacity-0 shadow-lg transition-opacity duration-300 group-hover:opacity-100">
              Ver vista previa
              <Icono nombre="derecha" className="w-3.5 h-3.5" />
            </span>
          </button>
        ) : (
          <Link to={`/apunte/${apunte.apunte_id}`} className={`relative block overflow-hidden bg-gradient-to-br ${tono.fondo} ev-focusable`}>
            <div aria-hidden="true" className="absolute inset-0 opacity-20 ev-dotfield" />
            <div aria-hidden="true" className="absolute -top-8 -right-6 w-28 h-28 bg-white/20 rounded-full blur-2xl" />
            <div className={`relative grid place-items-center ${destacada ? 'h-40' : 'h-32'}`}>
              <span className="text-white/95 transition-transform duration-300 group-hover:scale-110">
                <Icono nombre="documento" className={destacada ? 'w-14 h-14' : 'w-11 h-11'} />
              </span>
            </div>
          </Link>
        )}

        {tiempo && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            <Icono nombre="reloj" className="w-3 h-3" />
            {tiempo}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tono.chip}`}>
          {apunte.materia || 'Sin materia'}
        </span>
        <h3 className={`mt-2.5 font-extrabold leading-snug text-slate-900 dark:text-slate-100 group-hover:text-blue-700 transition-colors ${destacada ? 'text-lg line-clamp-2' : 'text-base line-clamp-2'}`}>
          <Link to={`/apunte/${apunte.apunte_id}`} className="ev-focusable">{apunte.titulo}</Link>
        </h3>
        {apunte.descripcion && <p className="mt-1.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{apunte.descripcion}</p>}

        <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-slate-200/60 dark:border-slate-700/60">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`ev-avatar grid place-items-center w-8 h-8 shrink-0 rounded-full bg-gradient-to-br ${tono.fondo} text-[11px] font-bold text-white`}>
              {iniciales(apunte.autor)}
            </span>
            <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-400">{apunte.autor || 'Anónimo'}</span>
          </span>

          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAlternarFavorito(apunte); }}
              aria-pressed={esFavorito}
              aria-label={esFavorito ? `Quitar ${apunte.titulo} de favoritos` : `Guardar ${apunte.titulo} en favoritos`}
              className={`ev-focusable ev-favorito grid place-items-center w-9 h-9 rounded-xl transition-colors ${esFavorito ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-500' : 'text-slate-400 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-500/15 hover:text-amber-500'}`}
            >
              <Icono nombre={esFavorito ? 'estrellaLlena' : 'estrella'} relleno={esFavorito} className="w-4 h-4" />
            </button>
            {esPdf && (
              <button
                type="button"
                onClick={() => onPreview?.(apunte)}
                aria-label={`Ver vista previa de ${apunte.titulo}`}
                className="ev-focusable grid h-9 w-9 cursor-pointer place-items-center rounded-xl text-slate-400 dark:text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              >
                <Icono nombre="documento" className="w-4 h-4" />
              </button>
            )}
            <Link to={`/apunte/${apunte.apunte_id}`} className="ev-btn inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700">
              Ver
              <Icono nombre="derecha" className="w-3.5 h-3.5" />
            </Link>
          </span>
        </div>
      </div>
    </article>
  );
};

export default ApunteCard;
