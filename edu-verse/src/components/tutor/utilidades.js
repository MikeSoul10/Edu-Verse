// Constantes y utilidades compartidas del Tutor IA (fuera de los componentes
// para que Fast Refresh funcione).

export const NIVELES = [
  { valor: 'basico', etiqueta: 'Básico', detalle: 'Desde cero, con analogías' },
  { valor: 'intermedio', etiqueta: 'Intermedio', detalle: 'Nivel universitario' },
  { valor: 'avanzado', etiqueta: 'Avanzado', detalle: 'Detalle técnico' },
];

export const etiquetaNivel = (valor) => NIVELES.find((n) => n.valor === valor)?.etiqueta || valor;

export const nombreArchivo = (texto, respaldo = 'archivo') =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || respaldo;

export function descargar(nombre, contenido, tipo = 'text/plain') {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Archivo de texto separado por tabuladores que Anki importa directo
// (Archivo → Importar). Las cabeceras # le indican separador y mazo.
export function exportarAnki(mazo) {
  const limpiar = (s) => s.replace(/[\t\r\n]+/g, ' ');
  const lineas = [
    '#separator:tab',
    '#html:false',
    `#deck:Edu-Verse::${limpiar(mazo.tema)}`,
    ...mazo.tarjetas.map((t) => `${limpiar(t.frente)}\t${limpiar(t.reverso)}`),
  ];
  descargar(`flashcards_${nombreArchivo(mazo.tema, 'mazo')}.txt`, lineas.join('\n'));
}

// Apuntes descargables: la sesión completa en Markdown con fuentes por respuesta.
export function sesionAMarkdown(sesion) {
  const partes = [
    `# ${sesion.tema}`,
    '',
    `*Nivel ${etiquetaNivel(sesion.nivel)} · Edu-Verse Tutor IA · ${new Date().toLocaleDateString('es-MX')}*`,
    '',
  ];
  for (const m of sesion.mensajes) {
    if (m.rol === 'user') {
      partes.push('---', '', `## ❓ ${(m.display || m.contenido).split('\n')[0]}`, '');
    } else {
      partes.push(m.contenido, '');
      if (m.fuentes?.length) {
        partes.push('**Fuentes:**', '');
        m.fuentes.forEach((f, i) => partes.push(
          f.tipo === 'apunte'
            ? `${i + 1}. 📚 ${f.titulo}${f.pagina ? ` (pág. ${f.pagina})` : ''} — apunte de Edu-Verse`
            : `${i + 1}. [${f.titulo || f.url}](${f.url})`
        ));
        partes.push('');
      }
    }
  }
  return partes.join('\n');
}

export const descargarApuntes = (sesion) =>
  descargar(`${nombreArchivo(sesion.tema, 'apuntes')}.md`, sesionAMarkdown(sesion), 'text/markdown');
