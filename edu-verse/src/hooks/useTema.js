import { useState, useCallback, useEffect } from 'react';

/* ------------------------------------------------------------------
   Tema claro / oscuro.

   El atributo `dark` se pone en <html>, no en <body>: el script inline de
   index.html ya lo hace antes de que React monte, para que no haya destello
   blanco al recargar. Este hook solo lo mantiene sincronizado con el estado
   y lo persiste.

   La paleta oscura vive en index.css como variables semanticas; las clases
   `ev-*` las consumen. Asi el tema oscuro no depende de editar cada clase
   de cada pagina.
   ------------------------------------------------------------------ */

const CLAVE_TEMA = 'eduverse_tema';

const aplicar = (oscuro) => {
  document.documentElement.classList.toggle('dark', oscuro);
};

const leerPreferencia = () => {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    if (guardado) return guardado === 'oscuro';
    // Sin preferencia guardada se respeta la del sistema.
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

export const useTema = () => {
  const [oscuro, setOscuro] = useState(leerPreferencia);

  useEffect(() => {
    aplicar(oscuro);
    try {
      localStorage.setItem(CLAVE_TEMA, oscuro ? 'oscuro' : 'claro');
    } catch {
      // Sin permiso de escritura: el tema funciona igual, solo no persiste.
    }
  }, [oscuro]);

  // Si el usuario nunca eligio tema, se sigue al del sistema en vivo.
  useEffect(() => {
    if (localStorage.getItem(CLAVE_TEMA)) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = (e) => setOscuro(e.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  const alternar = useCallback(() => setOscuro((prev) => !prev), []);

  return { oscuro, alternar };
};

export default useTema;
