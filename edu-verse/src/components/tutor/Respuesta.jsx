import React from 'react';
import { Link } from 'react-router-dom';
import Markdown from './Markdown';

const dominio = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/* Una respuesta del tutor: Markdown con citas [n] como superíndice, lista
   numerada de fuentes y subtemas clicables para seguir aprendiendo. */
export default function Respuesta({ mensaje, onSubtema, deshabilitado }) {
  const { contenido, fuentes = [], subtemas = [], sin_busqueda: sinBusqueda } = mensaje;

  return (
    <article className="ev-enter rounded-2xl border border-slate-200/80 bg-white p-5 text-[0.98rem] text-slate-700 shadow-sm dark:border-slate-700/70 dark:bg-slate-800 dark:text-slate-300 sm:p-7 sm:text-base">
      <div className="mb-3 flex items-center gap-2">
        <img src="/Iconos/mascota_robot.png" alt="" className="h-8 w-8 object-contain" />
        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Tutor IA</span>
        {sinBusqueda && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
            Sin búsqueda web
          </span>
        )}
      </div>

      <div className="min-w-0 break-words">
        <Markdown texto={contenido} fuentes={fuentes} />
      </div>

      {fuentes.length > 0 && (
        <section className="mt-6 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700" aria-label="Fuentes">
          {/* El número de cada fuente es su posición en la lista completa, el
              mismo que usan las citas [n] del texto. */}
          {[
            { tipo: 'apunte', titulo: '📚 De la biblioteca' },
            { tipo: 'web', titulo: '🌐 De la web' },
          ].map((grupo) => {
            const items = fuentes
              .map((f, i) => ({ ...f, n: i + 1 }))
              .filter((f) => (grupo.tipo === 'apunte' ? f.tipo === 'apunte' : f.tipo !== 'apunte'));
            if (items.length === 0) return null;
            return (
              <div key={grupo.tipo}>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{grupo.titulo}</h3>
                <ol className="space-y-1.5 text-sm">
                  {items.map((f) => (
                    <li key={`${f.n}-${f.url}`} className="flex gap-2">
                      <span className={`mt-0.5 grid h-5 min-w-5 place-items-center rounded px-1 text-[0.7rem] font-bold ${f.tipo === 'apunte' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200'}`}>
                        {f.n}
                      </span>
                      {f.tipo === 'apunte' ? (
                        <Link to={f.url} className="min-w-0 break-words font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                          {f.titulo}
                          <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
                            · {f.pagina ? `pág. ${f.pagina}` : 'apunte de Edu-Verse'}
                          </span>
                        </Link>
                      ) : (
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-indigo-600 hover:underline dark:text-indigo-300">
                          {f.titulo || dominio(f.url)}
                          <span className="ml-1.5 text-slate-400 dark:text-slate-500">· {dominio(f.url)}</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </section>
      )}

      {subtemas.length > 0 && onSubtema && (
        <section className="mt-5" aria-label="Subtemas sugeridos">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sigue aprendiendo</h3>
          <div className="flex flex-wrap gap-2">
            {subtemas.map((s) => (
              <button
                key={s}
                type="button"
                disabled={deshabilitado}
                onClick={() => onSubtema(s)}
                className="ev-focusable cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
              >
                {s} →
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
