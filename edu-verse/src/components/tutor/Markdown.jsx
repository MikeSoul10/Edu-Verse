import React from 'react';

/* Renderizador de Markdown mínimo para las respuestas del Tutor IA.
   Construye elementos de React (nunca HTML crudo), así que el texto de la IA
   no puede inyectar etiquetas ni scripts. Cubre lo que el tutor produce:
   títulos, párrafos, listas (con anidación), citas, tablas, código, reglas
   horizontales, **negrita**, *cursiva*, `código`, enlaces y citas [n]. */

const esUrlSegura = (url) => /^https?:\/\//i.test(url);

// --- inline -----------------------------------------------------------------
const PATRON_INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\[(\d{1,2})\](?!\())|(\[([^\]]+)\]\(([^)\s]+)\))|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function renderInline(texto, ctx, clave = 'i') {
  const salida = [];
  let ultimo = 0;
  let n = 0;
  // Regex nueva por llamada: renderInline es recursiva y un /g compartido
  // perdería la posición del nivel exterior.
  const patron = new RegExp(PATRON_INLINE.source, 'g');
  let m;
  while ((m = patron.exec(texto)) !== null) {
    if (m.index > ultimo) salida.push(texto.slice(ultimo, m.index));
    const k = `${clave}-${n++}`;

    if (m[1]) {
      salida.push(
        <code key={k} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.88em] text-indigo-700 dark:bg-slate-700/70 dark:text-indigo-200">
          {m[1].slice(1, -1)}
        </code>
      );
    } else if (m[2]) {
      salida.push(<strong key={k} className="font-bold text-slate-900 dark:text-white">{renderInline(m[2].slice(2, -2), ctx, k)}</strong>);
    } else if (m[3]) {
      const num = Number(m[4]);
      const fuente = ctx.fuentes?.[num - 1];
      salida.push(
        fuente ? (
          <sup key={k} className="mx-0.5">
            <a
              href={fuente.url}
              target="_blank"
              rel="noopener noreferrer"
              title={fuente.titulo}
              className="rounded bg-indigo-100 px-1 text-[0.7rem] font-bold text-indigo-700 no-underline hover:bg-indigo-200 dark:bg-indigo-500/25 dark:text-indigo-200"
            >
              {num}
            </a>
          </sup>
        ) : (
          `[${num}]`
        )
      );
    } else if (m[5]) {
      const [etiqueta, url] = [m[6], m[7]];
      salida.push(
        esUrlSegura(url) ? (
          <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-800 dark:text-indigo-300">
            {renderInline(etiqueta, ctx, k)}
          </a>
        ) : (
          etiqueta
        )
      );
    } else if (m[8]) {
      salida.push(<em key={k}>{renderInline(m[8].slice(1, -1), ctx, k)}</em>);
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) salida.push(texto.slice(ultimo));
  return salida;
}

// --- bloques ----------------------------------------------------------------
const RE_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const sangria = (linea) => linea.match(/^\s*/)[0].replace(/\t/g, '  ').length;

function parsearLista(lineas, i, ctx, clave) {
  const base = sangria(lineas[i]);
  const ordenada = /^\s*\d/.test(lineas[i]);
  const items = [];

  while (i < lineas.length) {
    const linea = lineas[i];
    if (!linea.trim()) {
      // Una línea vacía solo continúa la lista si lo siguiente es otro ítem.
      if (i + 1 < lineas.length && RE_ITEM.test(lineas[i + 1]) && sangria(lineas[i + 1]) >= base) { i++; continue; }
      break;
    }
    const m = linea.match(RE_ITEM);
    const nivel = sangria(linea);
    if (m && nivel === base) {
      items.push({ texto: m[3], hijos: [] });
      i++;
    } else if (m && nivel > base && items.length) {
      const [sub, sig] = parsearLista(lineas, i, ctx, `${clave}-${items.length}`);
      items[items.length - 1].hijos.push(sub);
      i = sig;
    } else if (!m && nivel > base && items.length) {
      items[items.length - 1].texto += ` ${linea.trim()}`;
      i++;
    } else {
      break;
    }
  }

  const Tag = ordenada ? 'ol' : 'ul';
  const elemento = (
    <Tag key={clave} className={`my-3 space-y-1.5 pl-6 ${ordenada ? 'list-decimal' : 'list-disc'} marker:text-indigo-400`}>
      {items.map((it, idx) => (
        <li key={idx} className="pl-1">
          {renderInline(it.texto, ctx, `${clave}-li${idx}`)}
          {it.hijos}
        </li>
      ))}
    </Tag>
  );
  return [elemento, i];
}

const celdas = (linea) => linea.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export default function Markdown({ texto = '', fuentes = [] }) {
  const ctx = { fuentes };
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  const bloques = [];
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];
    const k = `b${i}`;

    if (!linea.trim()) { i++; continue; }

    // Código
    if (/^\s*```/.test(linea)) {
      const lenguaje = linea.trim().slice(3).trim();
      const codigo = [];
      i++;
      while (i < lineas.length && !/^\s*```/.test(lineas[i])) codigo.push(lineas[i++]);
      i++;
      bloques.push(
        <pre key={k} className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100 dark:bg-black/50" data-lenguaje={lenguaje || undefined}>
          <code>{codigo.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Títulos
    const titulo = linea.match(/^(#{1,6})\s+(.*)$/);
    if (titulo) {
      const nivel = titulo[1].length;
      const clases = {
        1: 'mt-6 mb-3 text-2xl font-black',
        2: 'mt-6 mb-3 text-xl font-extrabold',
        3: 'mt-5 mb-2 text-lg font-bold',
      }[nivel] || 'mt-4 mb-2 text-base font-bold';
      const Tag = `h${Math.min(nivel + 1, 6)}`;
      bloques.push(<Tag key={k} className={`${clases} text-slate-900 dark:text-white first:mt-0`}>{renderInline(titulo[2].replace(/#+\s*$/, ''), ctx, k)}</Tag>);
      i++;
      continue;
    }

    // Regla horizontal
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(linea)) {
      bloques.push(<hr key={k} className="my-5 border-slate-200 dark:border-slate-700" />);
      i++;
      continue;
    }

    // Cita
    if (/^\s*>/.test(linea)) {
      const contenido = [];
      while (i < lineas.length && /^\s*>/.test(lineas[i])) contenido.push(lineas[i++].replace(/^\s*>\s?/, ''));
      bloques.push(
        <blockquote key={k} className="my-4 rounded-r-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-2 text-slate-700 dark:bg-amber-500/10 dark:text-slate-200">
          <Markdown texto={contenido.join('\n')} fuentes={fuentes} />
        </blockquote>
      );
      continue;
    }

    // Tabla
    if (linea.includes('|') && i + 1 < lineas.length && /^\s*\|?\s*:?-{2,}/.test(lineas[i + 1])) {
      const cabecera = celdas(linea);
      i += 2;
      const filas = [];
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim()) filas.push(celdas(lineas[i++]));
      bloques.push(
        <div key={k} className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>{cabecera.map((c, j) => <th key={j} className="px-3 py-2 font-bold">{renderInline(c, ctx, `${k}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((f, r) => (
                <tr key={r} className="border-t border-slate-200 dark:border-slate-700">
                  {f.map((c, j) => <td key={j} className="px-3 py-2 align-top">{renderInline(c, ctx, `${k}r${r}c${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Listas
    if (RE_ITEM.test(linea)) {
      const [lista, sig] = parsearLista(lineas, i, ctx, k);
      bloques.push(lista);
      i = sig;
      continue;
    }

    // Párrafo: junta líneas hasta un bloque distinto
    const parrafo = [linea.trim()];
    i++;
    while (
      i < lineas.length && lineas[i].trim() &&
      !/^(#{1,6}\s|\s*```|\s*>)/.test(lineas[i]) && !RE_ITEM.test(lineas[i])
    ) {
      parrafo.push(lineas[i++].trim());
    }
    bloques.push(<p key={k} className="my-3 leading-relaxed">{renderInline(parrafo.join(' '), ctx, k)}</p>);
  }

  return <>{bloques}</>;
}
