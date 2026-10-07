import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

/* ------------------------------------------------------------------
   Datos derivados: el backend no manda conteos ni categorias, todo se
   calcula aca a partir de los apuntes que ya trajo /apuntes.
   ------------------------------------------------------------------ */

// Paleta categorica segura para daltónicos. Azul primero porque es el color
// de marca del proyecto. Con más de 6 materias se recorta a "Otras" para no
// agregar un color que ya no se distingue del sexto.
const TONOS_MATERIA = [
  { fondo: 'from-blue-500 to-indigo-600', chip: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300', punto: '#3b82f6' },
  { fondo: 'from-violet-500 to-purple-600', chip: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300', punto: '#8b5cf6' },
  { fondo: 'from-emerald-500 to-teal-600', chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', punto: '#10b981' },
  { fondo: 'from-amber-500 to-orange-600', chip: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300', punto: '#f59e0b' },
  { fondo: 'from-rose-500 to-red-600', chip: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300', punto: '#ec4899' },
  { fondo: 'from-cyan-500 to-sky-600', chip: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', punto: '#06b6d4' },
];
const TONO_OTRAS = { fondo: 'from-slate-500 to-slate-600', chip: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', punto: '#64748b' };

// Hash estable: mismo nombre, mismo avatar y mismo color de materia.
const hash = (texto = '') => {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) % 9973;
  return h;
};

const tonoDesdeMateria = (materia = '') => {
  // Las 6 materias más frecuentes se llevan los tonos de la paleta; el resto
  // comparte el tono neutro en vez de inventar colores infinitos.
  return materia === '__otras__' ? TONO_OTRAS : TONOS_MATERIA[hash(materia) % TONOS_MATERIA.length];
};

const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';

// "hace 3 días", "hoy". La fecha viene sin zona horaria desde Postgres.
const tiempoRelativo = (fecha) => {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} sem`;
  return `Hace ${Math.floor(dias / 30)} mes${Math.floor(dias / 30) > 1 ? 'es' : ''}`;
};

const truncar = (texto = '', max) => (texto.length > max ? `${texto.slice(0, max)}…` : texto);

const CLAVE_ULTIMO = 'eduverse_ultimo_apunte';

// El backend guarda archivo_url como /uploads/<nombre>. La extensión dice si
// es PDF, sin necesidad de pedir el tipo MIME. Los PNG/JPG se muestran como
// imagen y cualquier otro formato cae en la portada con degradado.
const esPdfUrl = (url = '') => /\.pdf($|\?)/i.test(url);
const urlArchivo = (apunte) => `${API_URL}${apunte.archivo_url || ''}`;

// Lo escribe DetalleApunte al abrir un apunte. Se leen datos ya resueltos
// (titulo, materia, autor) para no pegarle al backend otra vez al montar.
const leerUltimo = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_ULTIMO));
    return guardado && guardado.apunte_id ? guardado : null;
  } catch {
    return null;
  }
};

const Icono = ({ nombre, className = 'w-5 h-5', relleno = false }) => {
  const paths = {    buscar: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></>,
    mas: <><path d="M12 5v14M5 12h14" strokeLinecap="round" /></>,
    documento: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" /><path d="M14 3v5h5" strokeLinejoin="round" /><path d="M9 13h6M9 17h4" strokeLinecap="round" /></>,
    reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></>,
    usuarios: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3.5" /><path d="M17 4.2a3.5 3.5 0 0 1 0 6.6M22 20v-1.5a4 4 0 0 0-3-3.9" strokeLinecap="round" /></>,
    capas: <><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" strokeLinejoin="round" /><path d="m3 12.5 9 4.5 9-4.5" strokeLinejoin="round" /><path d="m3 17 9 4.5 9-4.5" strokeLinejoin="round" /></>,
    estrella: <><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" strokeLinejoin="round" /></>,
    estrellaLlena: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />,
    close: <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />,
    izquierda: <><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></>,
    derecha: <><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></>,
    volver: <><path d="M9 14 4 9l5-5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 9h11a5 5 0 0 1 0 10h-4" strokeLinecap="round" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill={relleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      {paths[nombre]}
    </svg>
  );
};

const Biblioteca = () => {
  // Se lee una sola vez: llamar localStorage dentro del JSX es una lectura
  // impura en cada render y ademas no reacciona a un login posterior.
  const usuarioIdGuardado = localStorage.getItem('usuario_id');

  const [userName, setUserName] = useState('');
  const [apuntes, setApuntes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [materiaActiva, setMateriaActiva] = useState('todas');
  const [ultimoApunte, setUltimoApunte] = useState(null);
  // Set de apunte_id marcados. Un Set evita el O(n) de includes sobre un array
  // y ademas permite clonar el estado al cambiar, que React si detecta.
  const [favoritos, setFavoritos] = useState(() => new Set());
  const [listaFavoritos, setListaFavoritos] = useState([]);
  // El panel lateral muestra solo 6. El resto vive en un modal, asi el
  // sticky no crece y empuja las barras de materias fuera de pantalla.
  const [modalFavoritos, setModalFavoritos] = useState(false);
  const modalRef = useRef(null);
  // Preview del apunte: null = cerrado. Guarda el apunte entero, no solo el
  // id, para no volver a buscarlo en la lista al abrir.
  const [apuntePreview, setApuntePreview] = useState(null);
  const previewRef = useRef(null);

  const heroRef = useRef(null);
  const heroGlowRef = useRef(null);
  const heroRafRef = useRef(0);
  const carruselRef = useRef(null);
  const carruselTimerRef = useRef(0);
  const [carruselIndice, setCarruselIndice] = useState(0);
  const [carruselPausado, setCarruselPausado] = useState(false);

  /* ---------------- datos ---------------- */

  const cargarApuntes = useCallback(async () => {
    setCargando(true);
    try {
      const res = await axios.get(`${API_URL}/apuntes`);
      if (Array.isArray(res.data)) setApuntes(res.data);
    } catch {
      toast.error('No se pudo cargar la biblioteca');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarTodos = useCallback(async () => {
    setCargando(true);
    try {
      const res = await axios.get(`${API_URL}/apuntes`);
      if (Array.isArray(res.data)) setApuntes(res.data);
    } catch {
      toast.error('No se pudo cargar la biblioteca');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarFavoritos = useCallback(async () => {
    const usuarioId = localStorage.getItem('usuario_id');
    if (!usuarioId) {
      setFavoritos(new Set());
      setListaFavoritos([]);
      return;
    }
    try {
      const res = await axios.get(`${API_URL}/favoritos/${usuarioId}`);
      const lista = Array.isArray(res.data) ? res.data : [];
      setListaFavoritos(lista);
      setFavoritos(new Set(lista.map((f) => f.apunte_id)));
    } catch {
      // El panel de favoritos es accesorio: si falla, la biblioteca sigue.
    }
  }, []);

  // Alterna favorito. El estado se actualiza optimista y se revierte si el
  // backend rechaza, para que la estrella responda al instante.
  const alternarFavorito = async (apunte) => {
    const usuarioId = localStorage.getItem('usuario_id');
    if (!usuarioId) return toast.error('Debes iniciar sesión');

    const estaba = favoritos.has(apunte.apunte_id);
    const siguiente = new Set(favoritos);
    if (estaba) siguiente.delete(apunte.apunte_id);
    else siguiente.add(apunte.apunte_id);
    setFavoritos(siguiente);

    try {
      if (estaba) {
        await axios.delete(`${API_URL}/favoritos`, { data: { apunte_id: apunte.apunte_id } });
        setListaFavoritos((prev) => prev.filter((f) => f.apunte_id !== apunte.apunte_id));
        toast.success('Quitado de favoritos');
      } else {
        await axios.post(`${API_URL}/favoritos`, {
          usuario_id: usuarioId,
          apunte_id: apunte.apunte_id,
        });
        setListaFavoritos((prev) => (prev.some((f) => f.apunte_id === apunte.apunte_id) ? prev : [apunte, ...prev]));
        toast.success('Añadido a favoritos');
      }
    } catch (err) {
      setFavoritos(favoritos);
      toast.error(err.response?.data?.message || 'No se pudo actualizar el favorito');
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setCargando(true);
    setMateriaActiva('todas');
    try {
      const res = await axios.get(`${API_URL}/apuntes/buscar?q=${encodeURIComponent(busqueda)}`);
      setApuntes(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Error al buscar');
    } finally {
      setCargando(false);
    }
  };

  const limpiarBusqueda = async () => {
    setBusqueda('');
    setMateriaActiva('todas');
    await cargarTodos();
  };

  useEffect(() => {
    const storedName = localStorage.getItem('usuario');
    if (storedName) setUserName(storedName);
    cargarApuntes();
  }, [cargarApuntes]);

  useEffect(() => {
    setUltimoApunte(leerUltimo());
  }, []);

  useEffect(() => {
    cargarFavoritos();
  }, [cargarFavoritos]);

  // Escape cierra cualquiera de los dos modales abiertos.
  useEffect(() => {
    const alPresionarEsc = (e) => {
      if (e.key !== 'Escape') return;
      setModalFavoritos(false);
      setApuntePreview(null);
    };
    document.addEventListener('keydown', alPresionarEsc);
    return () => document.removeEventListener('keydown', alPresionarEsc);
  }, []);

  // Scroll del fondo congelado mientras haya un modal abierto. El Escape lo
  // maneja un unico listener global (arriba), no uno por modal.
  // Se usa overflow hidden y no position: fixed, porque fixed pierde la
  // posicion del scroll al cerrar.
  useEffect(() => {
    if (!modalFavoritos && !apuntePreview) return undefined;

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // El foco entra al modal para que la navegacion con teclado no se quede
    // atras en la pagina de fondo.
    modalRef.current?.focus();
    previewRef.current?.focus();

    return () => {
      document.body.style.overflow = overflowPrevio;
    };
  }, [modalFavoritos, apuntePreview]);

  /* ---------------- glow del hero ---------------- */

  useEffect(() => () => cancelAnimationFrame(heroRafRef.current), []);

  const handleHeroPointerMove = (e) => {
    const hero = heroRef.current;
    const glow = heroGlowRef.current;
    if (!hero || !glow) return;
    const rect = hero.getBoundingClientRect();
    cancelAnimationFrame(heroRafRef.current);
    heroRafRef.current = requestAnimationFrame(() => {
      glow.style.transform = `translate3d(${e.clientX - rect.left}px, ${e.clientY - rect.top}px, 0)`;
    });
  };

  /* ---------------- metricas y categorias ---------------- */

  // Las 6 materias mas frecuentes se llevan los tonos; el resto cae en
  // "Otras". Sin este recorte la paleta tendria un color por materia.
  const categorias = useMemo(() => {
    const conteo = new Map();
    apuntes.forEach((a) => {
      const m = a.materia || 'Sin materia';
      conteo.set(m, (conteo.get(m) || 0) + 1);
    });
    const todas = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
    const principales = todas.slice(0, 6);
    const resto = todas.slice(6);
    const lista = principales.map(([materia, n]) => ({
      materia,
      total: n,
      tono: TONOS_MATERIA[hash(materia) % TONOS_MATERIA.length],
    }));
    if (resto.length > 0) {
      lista.push({
        materia: '__otras__',
        total: resto.reduce((acc, [, n]) => acc + n, 0),
        tono: TONO_OTRAS,
      });
    }
    return lista;
  }, [apuntes]);

  // El filtro por materia trabaja sobre la lista ya traida, no pega al
  // backend: el endpoint /apuntes/buscar no acepta ese parametro.
  const apuntesFiltrados = useMemo(() => {
    if (materiaActiva === 'todas') return apuntes;
    if (materiaActiva === '__otras__') {
      const nombresPrincipales = categorias
        .filter((c) => c.materia !== '__otras__')
        .map((c) => c.materia);
      return apuntes.filter((a) => !nombresPrincipales.includes(a.materia || 'Sin materia'));
    }
    return apuntes.filter((a) => (a.materia || 'Sin materia') === materiaActiva);
  }, [apuntes, materiaActiva, categorias]);

  const resumen = useMemo(() => {
    const autores = new Set(apuntes.map((a) => a.autor).filter(Boolean));
    const usados = new Set(apuntes.map((a) => (a.materia || 'Sin materia').toLowerCase()));
    return {
      total: apuntes.length,
      materias: usados.size,
      autores: autores.size,
      hoy: apuntes.filter((a) => {
        const t = tiempoRelativo(a.fecha_subida);
        return t === 'Hoy';
      }).length,
    };
  }, [apuntes]);

  // Los mas recientes alimentan el carrusel. Con menos de 5 no hay carrusel:
  // un carrusel de un solo elemento es ruido visual.
  const destacados = useMemo(() => apuntes.slice(0, 8), [apuntes]);
  const hayCarrusel = !cargando && destacados.length >= 4;

  /* ---------------- carrusel ---------------- */

  const paginas = Math.ceil(destacados.length / 3);

  const irAPagina = (i) => {
    const el = carruselRef.current;
    if (!el) return;
    const destino = Math.max(0, Math.min(i, paginas - 1));
    // Se mueve por scroll nativo con smooth: sin estado de scroll para sincronizar.
    el.scrollTo({ left: el.scrollWidth * (destino / paginas), behavior: 'smooth' });
    setCarruselIndice(destino);
  };

  const carruselSiguiente = () => irAPagina((carruselIndice + 1) % paginas);
  const carruselAnterior = () => irAPagina((carruselIndice - 1 + paginas) % paginas);

  // Auto-avance con rAF sobre un intervalo. Se pausa al hover y al tocar la
  // pantalla, porque mover contenido mientras se intenta leer es hostile.
  useEffect(() => {
    if (!hayCarrusel || carruselPausado || paginas < 2) return undefined;

    carruselTimerRef.current = window.setInterval(() => {
      setCarruselIndice((prev) => {
        const siguiente = (prev + 1) % paginas;
        const el = carruselRef.current;
        if (el) el.scrollTo({ left: el.scrollWidth * (siguiente / paginas), behavior: 'smooth' });
        return siguiente;
      });
    }, 6000);

    return () => window.clearInterval(carruselTimerRef.current);
  }, [hayCarrusel, carruselPausado, paginas]);

  /* ---------------- carga ---------------- */

  const SkeletonCard = () => (
    <div className="ev-panel-glass overflow-hidden rounded-2xl" aria-hidden="true">
      <div className="h-36 bg-slate-200/70 dark:bg-slate-700/70 animate-pulse" />
      <div className="p-5">
        <div className="h-5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mb-3" />
        <div className="h-3.5 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse mb-5" />
        <div className="flex items-center justify-between pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-8 w-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
    </div>
  );

  /* ---------------- tarjeta ---------------- */

  const TarjetaApunte = ({ apunte, i, destacada = false, onAlternarFavorito, onPreview }) => {
    const tono = tonoDesdeMateria(
      categorias.find((c) => c.materia === (apunte.materia || 'Sin materia'))?.materia ?? apunte.materia
    );
    const tiempo = tiempoRelativo(apunte.fecha_subida);
    const esFav = favoritos.has(apunte.apunte_id);
    const esPdf = esPdfUrl(apunte.archivo_url);

    return (
      <article
        className={`ev-panel-glass ev-card-dash group flex flex-col overflow-hidden rounded-2xl ev-enter ${
          ['ev-d-0', 'ev-d-1', 'ev-d-2', 'ev-d-3'][i % 4]
        } ${destacada ? 'w-64 sm:w-72 shrink-0' : ''}`}
      >
        {/* Portada. En las tarjetas grandes del carrusel se embebe la primera
            pagina del PDF; en el grid chico queda el degradado de la materia.
            Se usa loading="lazy" porque cargar 8 iframes de PDF a la vez
            descarga varios MB que el usuario ni esta mirando. */}
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
            <Link
              to={`/apunte/${apunte.apunte_id}`}
              className={`relative block overflow-hidden bg-gradient-to-br ${tono.fondo} ev-focusable`}
            >
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
            <Link to={`/apunte/${apunte.apunte_id}`} className="ev-focusable">
              {apunte.titulo}
            </Link>
          </h3>

          {apunte.descripcion && (
            <p className="mt-1.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{apunte.descripcion}</p>
          )}

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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  alternarFavorito(apunte);
                }}
                aria-pressed={esFav}
                aria-label={esFav ? `Quitar ${apunte.titulo} de favoritos` : `Guardar ${apunte.titulo} en favoritos`}
                className={`ev-focusable ev-favorito grid place-items-center w-9 h-9 rounded-xl transition-colors ${
                  esFav ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-500' : 'text-slate-400 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-500/15 hover:text-amber-500'
                }`}
              >
                <Icono nombre={esFav ? 'estrellaLlena' : 'estrella'} relleno={esFav} className="w-4 h-4" />
              </button>

              {/* Preview tambien desde el grid chico. El boton Ver sigue
                  llevando al detalle con comentarios y valoracion. */}
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

              <Link
                to={`/apunte/${apunte.apunte_id}`}
                className="ev-btn inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                Ver
                <Icono nombre="derecha" className="w-3.5 h-3.5" />
              </Link>
            </span>
          </div>
        </div>
      </article>
    );
  };

  /* ---------------- render ---------------- */

  const tieneFiltro = busqueda.trim() !== '' || materiaActiva !== 'todas';

  return (
    <div className="ev-bg-nexo min-h-[calc(100vh-64px)] font-['Fredoka',sans-serif] relative">
      <div className="ev-gridfield absolute inset-0 pointer-events-none" />

      <div className="relative mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        {/* ---------------- HEADER ---------------- */}
        <header
          ref={heroRef}
          onMouseMove={handleHeroPointerMove}
          className="ev-mesh relative overflow-hidden rounded-[2rem] text-white shadow-lg ev-enter ev-d-0"
        >
          <div ref={heroGlowRef} className="ev-glow" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-14 -left-14 h-48 w-48 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-amber-400/20 blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute top-1/3 -left-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-2xl" />
          <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30 pointer-events-none" />

          <div className="relative grid gap-8 sm:gap-10 p-6 sm:p-10 lg:p-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="text-center lg:text-left">
              <p className="text-blue-200 text-sm sm:text-base font-semibold ev-enter ev-d-1">Tu conocimiento compartido</p>
              <h1 className="mt-2 text-3xl sm:text-6xl font-extrabold tracking-tight ev-enter ev-d-2">
                Hola, {userName || 'Estudiante'}
              </h1>
              <p className="mt-3 sm:mt-4 text-base sm:text-xl text-blue-100 max-w-xl mx-auto lg:mx-0 ev-enter ev-d-3">
                Explora apuntes de tus compañeros, comparte los tuyos y aprovemos juntos.
              </p>

              <div className="mt-5 sm:mt-7 flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-2.5 ev-enter ev-d-4">
                {[
                  { t: `${resumen.total} apuntes`, i: 'capas' },
                  { t: `${resumen.materias} materias`, i: 'documento' },
                  { t: `${resumen.autores} autores`, i: 'usuarios' },
                  { t: `${listaFavoritos.length} favoritos`, i: 'estrella' },
                ].map((c) => (
                  <span key={c.t} className="inline-flex items-center gap-2 sm:gap-2.5 rounded-full border border-white/25 bg-white/12 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold">
                    <Icono nombre={c.i} relleno={c.i === 'estrella'} className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-200" />
                    {c.t}
                  </span>
                ))}
              </div>
            </div>

            {/* Ilustracion + contador. La imagen acompana al dato, no lo reemplaza:
                el "subiste hoy" sigue siendo lo que hay que leer primero. */}
            <div className="flex items-center justify-center gap-6 sm:gap-10 ev-enter ev-d-3">
              <div className="ev-float shrink-0">
                <div className="relative">
                  <div aria-hidden="true" className="absolute inset-0 rounded-full bg-amber-300/25 blur-2xl scale-90" />
                  <img
                    src="/Imagenes_Diseño/come_libros.png"
                    alt=""
                    aria-hidden="true"
                    className="relative w-28 sm:w-40 lg:w-48 h-auto object-contain drop-shadow-2xl"
                  />
                </div>
              </div>

              <div className="inline-flex flex-col items-center rounded-3xl bg-white/12 px-5 sm:px-7 py-5 sm:py-6 text-center ring-2 ring-white/25 backdrop-blur-sm shrink-0">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-blue-200">Subiste hoy</span>
                <span className="mt-1 text-5xl sm:text-6xl font-black tabular-nums leading-none text-white">{resumen.hoy}</span>
                <span className="mt-1.5 text-xs sm:text-sm text-blue-100">
                  {resumen.hoy === 1 ? 'apunte' : 'apuntes'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ---------------- BARRA DE ACCIONES ---------------- */}
        {/* Fuera del header, igual que en el gestor: el azul del hero se
            reserva para el mensaje y la accion primaria vive sobre el fondo. */}
        <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 ev-enter ev-d-2">
          <Link
            to="/upload"
            className="ev-btn ev-shimmer ev-focusable inline-flex cursor-pointer items-center gap-2 sm:gap-2.5 rounded-2xl bg-blue-600 px-5 sm:px-7 py-3.5 sm:py-4 text-lg sm:text-xl font-bold text-white shadow-md hover:bg-blue-700"
          >
            <Icono nombre="mas" className="w-5 sm:w-6 h-5 sm:h-6" />
            Subir material
          </Link>

          {!cargando && apuntes.length > 0 && (
            <a
              href="#explorar"
              className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 sm:gap-2.5 rounded-2xl border border-blue-200 dark:border-blue-500/35 bg-white px-5 sm:px-7 py-3.5 sm:py-4 text-lg sm:text-xl font-bold text-blue-700 hover:border-blue-400 hover:bg-blue-50"
            >
              <Icono nombre="capas" className="w-5 sm:w-6 h-5 sm:h-6" />
              Explorar apuntes
            </a>
          )}

          {/* El atajo a favoritos va en la barra de acciones y no dentro del
              panel lateral: ahí se ve sin scroll y no depende de cuántos
              Favoritos haya guardado. */}
          {usuarioIdGuardado && listaFavoritos.length > 0 && (
            <button
              type="button"
              onClick={() => setModalFavoritos(true)}
              className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 sm:gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-500/15 px-5 sm:px-7 py-3.5 sm:py-4 text-lg sm:text-xl font-bold text-amber-800 dark:text-amber-200 hover:border-amber-400 hover:bg-amber-100"
            >
              <Icono nombre="estrella" relleno className="w-5 sm:w-6 h-5 sm:h-6 text-amber-500" />
              Mis favoritos
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-sm font-black text-white tabular-nums">
                {listaFavoritos.length}
              </span>
            </button>
          )}

          {/* Volver al inicio. Sin esto, desde la biblioteca no hay salida al
              Home salvo el logo de la navbar. `Link` y no `navigate(-1)`: si
              el usuario abrio la biblioteca en una pestana nueva, atras lo
              saca de la aplicacion. */}
          <Link
            to="/"
            className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 sm:gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 sm:px-7 py-3.5 sm:py-4 text-lg sm:text-xl font-bold text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-700 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
          >
            <Icono nombre="volver" className="w-5 sm:w-6 h-5 sm:h-6" />
            Volver al inicio
          </Link>
        </div>

        {/* ---------------- CARRUSEL ---------------- */}
        {hayCarrusel && (
          <section
            aria-label="Apuntes destacados"
            className="mt-6 sm:mt-8 ev-enter ev-d-2"
            onMouseEnter={() => setCarruselPausado(true)}
            onMouseLeave={() => setCarruselPausado(false)}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Recién subidos</h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Lo último que compartieron tus compañeros</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {paginas > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={carruselAnterior}
                      aria-label="Anterior"
                      className="ev-btn ev-focusable grid place-items-center w-10 h-10 rounded-xl bg-white text-slate-500 dark:text-slate-400 border border-blue-100 dark:border-blue-500/30 shadow-sm hover:text-blue-700"
                    >
                      <Icono nombre="izquierda" className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1.5 px-1">
                      {Array.from({ length: paginas }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => irAPagina(i)}
                          aria-label={`Ir a la página ${i + 1}`}
                          aria-current={i === carruselIndice}
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            i === carruselIndice ? 'w-7 bg-blue-600' : 'w-2.5 bg-blue-200 dark:bg-blue-500/25 hover:bg-blue-400'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={carruselSiguiente}
                      aria-label="Siguiente"
                      className="ev-btn ev-focusable grid place-items-center w-10 h-10 rounded-xl bg-white text-slate-500 dark:text-slate-400 border border-blue-100 dark:border-blue-500/30 shadow-sm hover:text-blue-700"
                    >
                      <Icono nombre="derecha" className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* scroll-snap: el navegador ancla cada tarjeta, sin JS de posicion */}
            <div
              ref={carruselRef}
              className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {destacados.map((a, i) => (
                <div key={a.apunte_id} className="snap-start">
                  <TarjetaApunte apunte={a} i={i} destacada onPreview={setApuntePreview} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---------------- ULTIMO APUNTE VISTO ---------------- */}
        {/* Solo aparece si hay historial real en este navegador. El atajo
            apunta a algo que el usuario ya abrio, no a un dato inventado. */}
        {ultimoApunte && !cargando && apuntes.some((a) => a.apunte_id === ultimoApunte.apunte_id) && (
          <section aria-label="Último apunte visto" className="mt-6 sm:mt-8 ev-enter ev-d-2">
            <Link
              to={`/apunte/${ultimoApunte.apunte_id}`}
              className="ev-panel-glass ev-card-dash group relative flex flex-col sm:flex-row items-start sm:items-center gap-5 overflow-hidden rounded-2xl p-5 sm:p-6"
            >
              <div aria-hidden="true" className="pointer-events-none absolute -top-12 -left-10 h-36 w-36 rounded-full bg-blue-200/40 blur-2xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 right-0 h-32 w-32 rounded-full bg-amber-300/25 blur-2xl" />
              <span aria-hidden="true" className="ev-esquina" />

              <div className="relative min-w-0 flex-1">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                  <Icono nombre="reloj" className="w-3 h-3" />
                  Último visto
                </span>

                <h2 className="mt-3 text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 transition-colors line-clamp-2">
                  {ultimoApunte.titulo}
                </h2>

                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-bold text-slate-700 dark:text-slate-300">
                    {ultimoApunte.materia || 'Sin materia'}
                  </span>
                  <span>por {ultimoApunte.autor || 'Anónimo'}</span>
                </p>
              </div>

              <span className="ev-btn relative inline-flex shrink-0 items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-md transition-colors group-hover:bg-blue-700">
                Seguir leyendo
                <Icono nombre="derecha" className="w-4 h-4" />
              </span>
            </Link>
          </section>
        )}

        {/* ---------------- BUSCADOR Y FILTROS ---------------- */}
        <div className="mt-6 sm:mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0">
            <form onSubmit={handleSearch} className="ev-panel-glass ev-card-dash rounded-2xl p-4 sm:p-5 ev-enter ev-d-2">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="ev-field relative flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400">
                    <Icono nombre="buscar" className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    placeholder="¿Qué materia buscas hoy?"
                    aria-label="Buscar apuntes"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-3.5 sm:py-4 pl-11 sm:pl-12 pr-3 sm:pr-4 text-base sm:text-lg text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="ev-btn ev-shimmer inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 sm:px-8 py-3.5 sm:py-4 text-lg font-bold text-white shadow-md hover:bg-blue-700"
                >
                  <Icono nombre="buscar" className="w-5 h-5" />
                  Buscar
                </button>

                {tieneFiltro && (
                  <button
                    type="button"
                    onClick={limpiarBusqueda}
                    aria-label="Limpiar filtros"
                    className="ev-focusable inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3.5 sm:py-4 text-lg font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Icono nombre="volver" className="w-5 h-5" />
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
              </div>

              {/* Filtro por materia: cliente, el endpoint de busqueda no lo acepta */}
              {categorias.length > 1 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/60 dark:border-slate-700/60 pt-4">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Materia</span>

                  <button
                    type="button"
                    onClick={() => setMateriaActiva('todas')}
                    aria-pressed={materiaActiva === 'todas'}
                    className={`ev-chip ev-focusable rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      materiaActiva === 'todas'
                        ? 'border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-blue-300 hover:text-blue-700'
                    }`}
                  >
                    Todas
                  </button>

                  {categorias.map((c) => (
                    <button
                      key={c.materia}
                      type="button"
                      onClick={() => setMateriaActiva(c.materia)}
                      aria-pressed={materiaActiva === c.materia}
                      className={`ev-chip ev-focusable inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                        materiaActiva === c.materia
                          ? 'border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-blue-300 hover:text-blue-700'
                      }`}
                    >
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.tono.punto }} />
                      {c.materia === '__otras__' ? 'Otras' : truncar(c.materia, 22)}
                      <span className="tabular-nums opacity-70">{c.total}</span>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* ---------------- GRID DE APUNTES ---------------- */}
            <section id="explorar" className="mt-8 scroll-mt-20" aria-label="Apuntes">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-base font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {materiaActiva === 'todas' ? 'Explorar apuntes' : materiaActiva === '__otras__' ? 'Otras materias' : apuntesFiltrados[0]?.materia}
                </h2>
                <span className="rounded-full bg-blue-50 dark:bg-blue-500/15 px-4 py-1.5 text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {apuntesFiltrados.length} {apuntesFiltrados.length === 1 ? 'archivo' : 'archivos'}
                </span>
              </div>

              {cargando ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((n) => <SkeletonCard key={n} />)}
                </div>
              ) : apuntesFiltrados.length === 0 ? (
                <div className="ev-panel-glass relative overflow-hidden rounded-[2rem] px-6 py-16 text-center ev-enter">
                  <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-12 h-44 w-44 rounded-full bg-blue-200/40 blur-2xl" />
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-14 h-56 w-56 rounded-full bg-amber-300/30 blur-2xl" />
                  <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />

                  <div className="relative">
                    <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-blue-50 dark:bg-blue-500/15 text-blue-400">
                      <Icono nombre="capas" className="w-8 h-8" />
                    </span>
                    <h3 className="mt-6 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                      {tieneFiltro ? 'No encontramos ese apunte' : 'La biblioteca está vacía'}
                    </h3>
                    <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg font-medium max-w-lg mx-auto">
                      {tieneFiltro
                        ? 'Prueba con otro término o quita los filtros para ver todo lo que hay.'
                        : 'Sé la primera persona en compartir material con tu comunidad.'}
                    </p>

                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                      {tieneFiltro ? (
                        <button
                          type="button"
                          onClick={limpiarBusqueda}
                          className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-lg font-bold text-blue-700 border border-blue-200 dark:border-blue-500/35 hover:border-blue-400 hover:bg-blue-50"
                        >
                          <Icono nombre="volver" className="w-5 h-5" />
                          Ver todos los apuntes
                        </button>
                      ) : (
                        <Link
                          to="/upload"
                          className="ev-btn ev-shimmer inline-flex items-center gap-2.5 rounded-2xl bg-blue-600 px-7 py-4 text-xl font-bold text-white shadow-md hover:bg-blue-700"
                        >
                          <Icono nombre="mas" className="w-6 h-6" />
                          Subir el primero
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {apuntesFiltrados.map((a, i) => (
                    <TarjetaApunte key={a.apunte_id} apunte={a} i={i} onPreview={setApuntePreview} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ---------------- PANEL LATERAL ---------------- */}
          <aside className="space-y-4 sm:space-y-5 lg:sticky lg:top-20" aria-label="Resumen de la biblioteca">
            <div className="ev-panel-glass ev-card-dash ev-slide-right ev-sr-0 relative overflow-hidden rounded-2xl p-5 sm:p-6">
              <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />
              <div aria-hidden="true" className="pointer-events-none absolute -top-14 -right-10 h-36 w-36 rounded-full bg-blue-200/40 blur-2xl" />
              <span aria-hidden="true" className="ev-esquina" />

              <div className="relative">
                <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Tu biblioteca</h2>

                <div className="mt-4 sm:mt-5 space-y-3">
                  {[
                    { etiqueta: 'Apuntes', valor: resumen.total, gradiente: 'from-blue-600 to-indigo-700', icono: 'capas' },
                    { etiqueta: 'Materias', valor: resumen.materias, gradiente: 'from-indigo-500 to-violet-600', icono: 'documento' },
                    { etiqueta: 'Autores', valor: resumen.autores, gradiente: 'from-emerald-500 to-teal-600', icono: 'usuarios' },
                    { etiqueta: 'Subidos hoy', valor: resumen.hoy, gradiente: 'from-amber-500 to-orange-600', icono: 'reloj' },
                  ].map((s) => (
                    <div key={s.etiqueta} className="flex items-center gap-3 sm:gap-3.5 rounded-xl border border-white/70 bg-white/85 dark:bg-slate-800/85 px-3.5 sm:px-4 py-3">
                      <span className={`ev-stat-icon grid w-9 h-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${s.gradiente} text-white shadow-sm`}>
                        <Icono nombre={s.icono} className="w-5 h-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.etiqueta}</span>
                      </span>
                      <span className="text-xl sm:text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100 leading-none">{s.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Materias por volumen: barra horizontal ordenada, que es mas
                legible que un donut para "cual tiene mas apuntes". */}
            {categorias.length > 0 && (
              <div className="ev-panel-glass ev-card-dash ev-slide-right ev-sr-1 relative overflow-hidden rounded-2xl p-5 sm:p-6">
                <span aria-hidden="true" className="ev-esquina" />

                <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Materias con más apuntes</h2>

                <ul className="mt-4 sm:mt-5 space-y-3.5">
                  {categorias.map((c) => {
                    const max = categorias[0]?.total || 1;
                    const pct = Math.round((c.total / max) * 100);
                    return (
                      <li key={c.materia}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-bold text-slate-700 dark:text-slate-300">
                            {c.materia === '__otras__' ? 'Otras' : truncar(c.materia, 20)}
                          </span>
                          <span className="shrink-0 tabular-nums font-extrabold text-slate-900 dark:text-slate-100">{c.total}</span>
                        </div>
                        <div className="ev-bar-track" role="img" aria-label={`${c.materia}: ${c.total} apuntes`}>
                          <div className="ev-bar-fill" style={{ width: `${pct}%`, backgroundColor: c.tono.punto }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Acceso rapido: la accion primaria del header */}
            <div className="ev-slide-right ev-sr-2 relative overflow-hidden rounded-2xl bg-blue-600 p-5 sm:p-6 text-white shadow-md">
              <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-20 pointer-events-none" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-12 h-36 w-36 rounded-full bg-indigo-400/40 blur-2xl" />

              <div className="relative">
                <p className="text-xs font-black uppercase tracking-widest text-blue-200">Comparte</p>
                <p className="mt-1.5 text-base sm:text-lg font-bold leading-snug">
                  ¿Tienes apuntes que le sirvan a otros?
                </p>
                <p className="mt-1.5 text-sm text-blue-100">
                  Súbelos y ayuda a tu comunidad a repasar más rápido.
                </p>
                <Link
                  to="/upload"
                  className="ev-btn ev-shimmer ev-shimmer-claro mt-4 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-5 py-3.5 text-base font-bold text-blue-700 shadow-md"
                >
                  <Icono nombre="mas" className="w-5 h-5" />
                  Subir material
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {/* ---------------- MODAL: TODOS LOS FAVORITOS ---------------- */}
        {modalFavoritos && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
              className="ev-overlay absolute inset-0 bg-slate-900/50"
              onClick={() => setModalFavoritos(false)}
              aria-hidden="true"
            />

            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-modal-favoritos"
              tabIndex={-1}
              className="ev-modal relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl outline-none"
            >
              <div className="ev-mesh relative overflow-hidden px-5 py-4 sm:px-6">
                <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30" />
                <div className="relative flex items-center justify-between gap-3">
                  <h2 id="titulo-modal-favoritos" className="flex items-center gap-2 text-lg font-extrabold text-white">
                    <Icono nombre="estrella" relleno className="w-5 h-5 text-amber-300" />
                    Tus favoritos
                    <span className="rounded-full bg-white/20 px-2.5 py-1 text-sm font-black tabular-nums">
                      {listaFavoritos.length}
                    </span>
                  </h2>

                  <button
                    type="button"
                    onClick={() => setModalFavoritos(false)}
                    aria-label="Cerrar"
                    className="ev-focusable grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white transition-colors hover:bg-white/30"
                  >
                    <Icono nombre="close" className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* max-h y overflow: con 20+ favoritos la lista scrollea sola */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-white/95 dark:bg-slate-800/95 p-4 sm:p-5">
                {listaFavoritos.length === 0 ? (
                  <p className="rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-500/35 bg-amber-50/40 px-4 py-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                    Ya no tenés favoritos guardados.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {listaFavoritos.map((f, i) => {
                      const tonoFav = tonoDesdeMateria(f.materia || 'Sin materia');
                      const esUltimo = f.apunte_id === ultimoApunte?.apunte_id;
                      return (
                        <li
                          key={f.apunte_id}
                          className={`ev-enter flex items-center gap-3 rounded-xl border px-3 py-3 ${
                            esUltimo ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                          } ${['ev-d-0', 'ev-d-1', 'ev-d-2'][i % 3]}`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tonoFav.fondo} text-white`}>
                            <Icono nombre="documento" className="w-5 h-5" />
                          </span>

                          <Link to={`/apunte/${f.apunte_id}`} className="ev-focusable min-w-0 flex-1">
                            <span className={`block truncate text-sm font-bold ${esUltimo ? 'text-amber-800' : 'text-slate-800 dark:text-slate-200'}`}>
                              {f.titulo}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tonoFav.punto }} />
                                {f.materia || 'Sin materia'}
                              </span>
                              <span className="truncate">{f.autor || 'Anónimo'}</span>
                            </span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => alternarFavorito(f)}
                            aria-label={`Quitar ${f.titulo} de favoritos`}
                            className="ev-focusable grid h-9 w-9 shrink-0 place-items-center rounded-lg text-amber-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Icono nombre="close" className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setModalFavoritos(false)}
                  className="ev-btn ev-focusable w-full cursor-pointer rounded-xl bg-blue-600 py-3 text-base font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- MODAL: VISTA PREVIA DEL APUNTE ---------------- */}
        {apuntePreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
              className="ev-overlay absolute inset-0 bg-slate-900/60"
              onClick={() => setApuntePreview(null)}
              aria-hidden="true"
            />

            <div
              ref={previewRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-preview"
              tabIndex={-1}
              className="ev-modal relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl outline-none"
            >
              <div className="ev-mesh relative overflow-hidden px-5 py-4 sm:px-6">
                <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="titulo-preview" className="truncate text-lg font-extrabold text-white">
                      {apuntePreview.titulo}
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-blue-100">
                      <span>{apuntePreview.materia || 'Sin materia'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{apuntePreview.autor || 'Anónimo'}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setApuntePreview(null)}
                    aria-label="Cerrar"
                    className="ev-focusable grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-white/15 text-white transition-colors hover:bg-white/30"
                  >
                    <Icono nombre="close" className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* min-h-0 + flex-1 + overflow: el iframe scrollea internamente
                  sin estirar el modal mas alla del max-h de la pantalla. */}
              <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-slate-800">
                {esPdfUrl(apuntePreview.archivo_url) ? (
                  <iframe
                    src={urlArchivo(apuntePreview)}
                    title={`Vista previa de ${apuntePreview.titulo}`}
                    className="h-full min-h-[24rem] w-full bg-white dark:bg-slate-900"
                  />
                ) : (
                  <img
                    src={urlArchivo(apuntePreview)}
                    alt={apuntePreview.titulo}
                    className="h-full min-h-[24rem] w-full object-contain"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 sm:px-6">
                <a
                  href={urlArchivo(apuntePreview)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ev-btn inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-500/35 bg-white px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50"
                >
                  <Icono nombre="derecha" className="w-4 h-4" />
                  Abrir en pestaña nueva
                </a>

                <Link
                  to={`/apunte/${apuntePreview.apunte_id}`}
                  className="ev-btn ev-shimmer inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Ver detalle completo
                  <Icono nombre="derecha" className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Biblioteca;
