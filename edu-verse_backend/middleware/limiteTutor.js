// Límite de peticiones por usuario para los endpoints que llaman a la IA.
// Protege la cuota gratuita de Groq. Ventana deslizante de 60 s en memoria:
// suficiente para un solo proceso de backend.

const VENTANA_MS = 60_000;
const marcas = new Map(); // usuario_id -> [timestamps]

const limiteTutor = (req, res, next) => {
  const limite = parseInt(process.env.TUTOR_LIMITE_POR_MINUTO, 10) || 10;
  const clave = String(req.usuario.id);
  const ahora = Date.now();
  const recientes = (marcas.get(clave) || []).filter((t) => ahora - t < VENTANA_MS);

  if (recientes.length >= limite) {
    const espera = Math.ceil((VENTANA_MS - (ahora - recientes[0])) / 1000);
    res.set('Retry-After', String(espera));
    marcas.set(clave, recientes);
    return res.status(429).json({
      mensaje: `Hiciste muchas preguntas seguidas. Espera ${espera} s antes de volver a intentar.`,
      codigo: 'limite_usuario',
    });
  }

  recientes.push(ahora);
  marcas.set(clave, recientes);
  next();
};

// Limpieza periódica para que el mapa no crezca sin control.
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, lista] of marcas) {
    if (lista.every((t) => ahora - t >= VENTANA_MS)) marcas.delete(clave);
  }
}, 5 * VENTANA_MS).unref();

module.exports = limiteTutor;
