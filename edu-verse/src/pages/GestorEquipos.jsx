import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import api from '../services/api';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import CalendarioVencimientos from '../components/CalendarioVencimientos';
import TaskCard from '../components/TaskCard';
import { urlFoto } from '../utils/formatters';

const CLAVE_CALENDARIO = 'eduverse_calendario_visible';

// Si el usuario lo oculto, no se vuelve a dibujar en cada carga.
const leerCalendarioVisible = () => {
  try {
    const guardado = localStorage.getItem(CLAVE_CALENDARIO);
    return guardado === null ? true : guardado === '1';
  } catch {
    return true;
  }
};
import toast from 'react-hot-toast';

// Resumen global del selector de equipos. El backend no expone un endpoint
// agregado, asi que las tareas de cada equipo se traen en paralelo y se
// aplanan por equipo_id para poder derivar las metricas de abajo.
const ETIQUETA_ROL = { admin: 'Administrador', miembro: 'Miembro' };

const PRIORIDADES = {
  verde: { label: 'No urgente', color: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-500/40' },
  amarillo: { label: 'Urgente', color: '#eab308', bg: 'bg-amber-50 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-500/40' },
  rojo: { label: 'Pocos días', color: '#ef4444', bg: 'bg-red-50 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-500/40' },
};

const ESTADOS = {
  pendiente: { label: 'Pendiente', icon: 'clipboard', bg: 'bg-blue-50 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', punto: '#3b82f6' },
  en_progreso: { label: 'En progreso', icon: 'spinner', bg: 'bg-indigo-50 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300', punto: '#6366f1' },
  completada: { label: 'Completada', icon: 'check', bg: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', punto: '#10b981' },
};

const ORDEN_ESTADOS = ['pendiente', 'en_progreso', 'completada'];

const INTERVALO_FRASE_HERO = 4500;

// Distancia al final (px) bajo la cual consideramos que el usuario está
// "abajo" y el botón "ir al último mensaje" se oculta. 80px evita que el
// botón parpadee con micro-scrolls del mouse.
const UMBRAL_FINAL_CHAT = 80;

// Frases del hero: rotan en la burbuja sobre la ilustracion del equipo.
const FRASES_HERO = ['¡Juntos rendimos más! ', 'Reparte y avanza en equipo ', '¡Nunca estudies solo! ', 'Tareas claras, equipo fuerte '];

// Letrero que sostiene la mascota del header de equipo. Mismo tono y mismo
// ritmo que el hero, pero cortos: va al lado de la mascota y el header se
// estrecha cuando se oculta el calendario.
const FRASES_MASCOTA = [
  'Hoy es día de trabajar',
  '¡Vamos con todo!',
  'Tarea tras tarea',
  '¿Cómo vamos?',
  '¡Sigue así!',
  'Un paso más',
];

// Pilares del gestor, en vez de una lista de features vacia.
const BENEFICIOS = [
  { texto: 'Tablero kanban', icono: 'tablero' },
  { texto: 'Tareas en tiempo real', icono: 'reloj' },
  { texto: 'Chat del equipo', icono: 'chat' },
];

/* Iconos SVG inline: sin dependencias, con aria-hidden cuando son decorativos */
const Icono = ({ nombre, className = 'w-5 h-5' }) => {
  const paths = {
    tablero: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="14" rx="1.5" /></>,
    grafica: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" /></>,
    chat: <><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8z" strokeLinejoin="round" /></>,
    mas: <><path d="M12 5v14M5 12h14" strokeLinecap="round" /></>,
    filtro: <><path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" /></>,
    buscar: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></>,
    volver: <><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></>,
    inicio: <><path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" strokeLinecap="round" strokeLinejoin="round" /></>,
    cerrar: <><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></>,
    check: <><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></>,
    circulo: <circle cx="12" cy="12" r="9" />,
    alerta: <><path d="M12 9v4M12 17h.01" strokeLinecap="round" /><path d="M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round" /></>,
    reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></>,
    enviar: <><path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z" strokeLinejoin="round" /></>,
    usuarios: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3.5" /><path d="M17 4.2a3.5 3.5 0 0 1 0 6.6M22 20v-1.5a4 4 0 0 0-3-3.9" strokeLinecap="round" /></>,
    copiar: <><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5.5A2.5 2.5 0 0 1 7.5 3H15" strokeLinecap="round" /></>,
    basura: <><path d="M4 7h16M10 4h4M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" /></>,
    spinner: <><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" strokeLinecap="round" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" strokeLinecap="round" /></>,
    editar: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" strokeLinejoin="round" /></>,
    salir: <><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" strokeLinecap="round" strokeLinejoin="round" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></>,
    abajo: <><path d="M6 9.5l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></>,
    siguiente: <><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></>,
    responder: <><path d="M9 14 4 9l5-5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 9h10a6 6 0 0 1 6 6v4" strokeLinecap="round" strokeLinejoin="round" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      {paths[nombre]}
    </svg>
  );
};

const getUsuarioId = () => {
  const id = localStorage.getItem('usuario_id');
  if (id) return id;
  const token = localStorage.getItem('token');
  if (token) {
    try {
      return String(JSON.parse(atob(token.split('.')[1])).id);
    } catch {
      return null;
    }
  }
  return null;
};

// Color estable derivado del nombre: mismo nombre, mismo avatar
const TONOS_AVATAR = [
  'from-blue-500 to-indigo-500',
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-blue-500',
  'from-violet-500 to-purple-500',
  'from-cyan-500 to-sky-500',
];

const tonoDesdeNombre = (nombre = '') => {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 9973;
  return TONOS_AVATAR[h % TONOS_AVATAR.length];
};

const getDiasRestantes = (fecha) => {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const entrega = new Date(fecha);
  entrega.setHours(0, 0, 0, 0);
  return Math.ceil((entrega - hoy) / 86400000);
};

const pct = (parte, total) => (total === 0 ? 0 : Math.round((parte / total) * 100));

// Clave YYYY-MM-DD en hora local, para comparar contra filtroFecha sin que
// el UTC corra el dia. Debe coincidir con la que genera el calendario.
const claveDiaLocal = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

const StatCard = ({ etiqueta, valor, detalle, icono, gradiente, anillo, delay }) => (
  <article className={`ev-stat ev-panel-glass rounded-2xl p-5 ev-enter ${delay || ''}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{etiqueta}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{valor}</p>
        {detalle && <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-400">{detalle}</p>}
      </div>
      <span className={`grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br ${gradiente} text-white shadow-md shrink-0`}>
        <Icono nombre={icono} className="w-5 h-5" />
      </span>
    </div>
    {anillo !== undefined && (
      <div className="mt-4 ev-progress-track" role="img" aria-label={`${etiqueta}: ${valor}`}>
        <div className={`ev-progress-fill bg-gradient-to-r ${gradiente}`} style={{ width: `${anillo}%` }} />
      </div>
    )}
  </article>
);

const Donut = ({ segmentos, total }) => {
  if (total === 0) {
    return (
      <div className="ev-donut ev-donut-vacio h-40 w-40 grid place-items-center">
        <div className="ev-donut-hueco h-28 w-28 grid place-items-center">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400">Sin datos</span>
        </div>
      </div>
    );
  }

  // conic-gradient necesita los tramos acumulados en grados.
  // Se calcula con reduce para no mutar una variable durante el render.
  const tramos = segmentos.reduce(
    (acc, s) => {
      const desde = (acc.acumulado / total) * 360;
      const acumulado = acc.acumulado + s.valor;
      const hasta = (acumulado / total) * 360;
      return { acumulado, tramos: [...acc.tramos, `${s.color} ${desde}deg ${hasta}deg`] };
    },
    { acumulado: 0, tramos: [] }
  ).tramos;

  return (
    <div
      className="ev-donut h-40 w-40 grid place-items-center"
      style={{ background: `conic-gradient(${tramos.join(', ')})` }}
      role="img"
      aria-label={segmentos.map((s) => `${s.label}: ${s.valor}`).join(', ')}
    >
      <div className="ev-donut-hueco h-28 w-28 grid place-items-center">
        <div className="text-center">
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{total}</p>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">tareas</p>
        </div>
      </div>
    </div>
  );
};

const Chip = ({ activo, onClick, children, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activo}
    aria-label={ariaLabel}
    className={`ev-chip ev-focusable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
      activo ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm' : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:text-blue-700'
    }`}
  >
    {children}
  </button>
);

const GestorEquipos = () => {
  const socketRef = useRef(null);
  const chatRef = useRef(null);
  const chatAbiertoRef = useRef(false);
  // Si el chat está al final del scroll. Ref y no estado porque lo consultan
  // el listener del socket y el efecto de auto-scroll, que corren fuera del
  // ciclo de render y se quedarían con el valor del último render.
  const estaAbajoRef = useRef(true);
  const equipoActivoRef = useRef(null); // para el socket: evita que mensajes de otro equipo se cuelen
  const tareaEditandoRef = useRef(null);
  const rafRef = useRef(0);
  // Tarea en curso de arrastre. Ref y no estado: ver handleDragStart.
  const tareaArrastradaRef = useRef(null);

  // Hero del selector de equipos: la frase rota sola y el glow sigue al mouse.
  const heroRef = useRef(null);
  const heroGlowRef = useRef(null);
  const heroRafRef = useRef(0);
  const [fraseHeroIdx, setFraseHeroIdx] = useState(0);
  const [fraseMascotaIdx, setFraseMascotaIdx] = useState(0);
  const [tareasPorEquipo, setTareasPorEquipo] = useState({});

  // Cifras del dashboard. Se guardan aparte del valor final porque las
  // animaciones de conteo necesitan mutarlas por frame.
  const [cifras, setCifras] = useState({ equipos: 0, tareas: 0, completadas: 0, vencidas: 0, tasa: 0 });
  const cifrasRafRef = useRef(0);

  const usuario = getUsuarioId();

  const [equipos, setEquipos] = useState([]);
  const [equipoActivo, setEquipoActivo] = useState(null);
  // Admin de ESTE equipo (miembros_equipo.rol). No confundir con el admin
  // global de la plataforma (usuarios.rol), que no autoriza nada sobre los
  // chats de otros equipos.
  const soyAdminEquipo = equipoActivo?.rol === 'admin';
  const [miembros, setMiembros] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [vista, setVista] = useState('dashboard');

  const [showCrearEquipo, setShowCrearEquipo] = useState(false);
  const [showUnirse, setShowUnirse] = useState(false);
  const [showCrearTarea, setShowCrearTarea] = useState(false);
  const [nombreEquipo, setNombreEquipo] = useState('');
  const [codigoUnirse, setCodigoUnirse] = useState('');
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  const [sidebarMinimizado, setSidebarMinimizado] = useState(false);

  // Botón "ir al final" del chat: visible solo cuando el usuario sube del último mensaje
  const [mostrarBotonChat, setMostrarBotonChat] = useState(false);
  const [nuevosSinVer, setNuevosSinVer] = useState(0);

  // Mensaje al que se está respondiendo (null = envío normal).
  const [respondiendoA, setRespondiendoA] = useState(null);
  // Menú contextual de "Responder" abierto por clic derecho: guarda mensaje y posición.
  const [menuResponder, setMenuResponder] = useState(null);

  // Mensaje pendiente de confirmar borrado (solo para admins del equipo).
  const [mensajeABorrar, setMensajeABorrar] = useState(null);
  // Modal de vaciado completo: null = cerrado. Guardamos además lo que el
  // admin está escribiendo, porque el botón solo se habilita con "BORRAR".
  const [modalVaciar, setModalVaciar] = useState(false);
  const [confirmacionVaciar, setConfirmacionVaciar] = useState('');

  // Salir del equipo (abandona la membresía) y expulsar a otro miembro.
  const [modalSalirEquipo, setModalSalirEquipo] = useState(false);
  const [miembroAExpulsar, setMiembroAExpulsar] = useState(null);

  // Buscador de mensajes del chat
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [busquedaChat, setBusquedaChat] = useState('');
  const [coincidenciaActual, setCoincidenciaActual] = useState(0);

  // Paginación de mensajes antiguos (scroll hacia arriba)
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [sinMasMensajes, setSinMasMensajes] = useState(false);

  // Inserción deduplicada por mensaje_id — usada por socket y por el envío local
  const agregarMensaje = useCallback((msg, prev) => {
    if (msg.mensaje_id && prev.some((m) => m.mensaje_id === msg.mensaje_id)) return prev;
    return [...prev, msg];
  }, []);

  const [sidebarMovil, setSidebarMovil] = useState(false);
  // En pantallas grandes el chat siempre esta visible; en chica es un drawer
  const [chatMovil, setChatMovil] = useState(false);

  const [nuevaTarea, setNuevaTarea] = useState({ titulo: '', descripcion: '', prioridad: 'verde', fecha_entrega: '', asignado_a: '' });
  const [tareaAEliminar, setTareaAEliminar] = useState(null);
  const [tareaEditando, setTareaEditando] = useState(null);
  const [tareaEditForm, setTareaEditForm] = useState({ titulo: '', descripcion: '', prioridad: 'verde', fecha_entrega: '', asignado_a: '', estado: 'pendiente' });
  const [comentariosTarea, setComentariosTarea] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');

  const [columnaSobre, setColumnaSobre] = useState(null);
  const [calendarioVisible, setCalendarioVisible] = useState(leerCalendarioVisible);
  const [filtroPrioridad, setFiltroPrioridad] = useState('todas');
  const [filtroMiembro, setFiltroMiembro] = useState('todos');
  // Clave YYYY-MM-DD. Viene del calendario: al elegir un dia, el tablero
  // queda reducido a las tareas que vencen ese dia.
  const [filtroFecha, setFiltroFecha] = useState('');
  const [busqueda, setBusqueda] = useState('');

  /* ---------------- datos ---------------- */

  const cargarEquipos = useCallback(async () => {
    if (!usuario) return;
    try {
      const res = await api.get(`${API_URL}/equipos/mis-equipos/${usuario}`);
      setEquipos(res.data);
    } catch {
      // silencioso: la vista de equipos ya muestra el empty state
    }
  }, [usuario]);

  const cargarTareas = useCallback(async (equipoId) => {
    try {
      setTareas((await api.get(`${API_URL}/tareas/equipo/${equipoId}`)).data);
    } catch {
      // silencioso
    }
  }, []);

  const cargarMiembros = useCallback(async (equipoId) => {
    try {
      const datos = (await api.get(`${API_URL}/equipos/${equipoId}/miembros`)).data;
      setMiembros(datos);
      // Si otro admin salió y ascendió a este usuario, los controles de admin
      // deben aparecer sin recargar la página.
      setEquipoActivo((prev) => {
        if (!prev || String(prev.equipo_id) !== String(equipoId)) return prev;
        const yo = datos.find((m) => String(m.usuario_id) === String(usuario));
        return yo ? { ...prev, rol: yo.rol } : prev;
      });
    } catch {
      // silencioso
    }
  }, [usuario]);

  const cargarMensajes = useCallback(async (equipoId) => {
    try {
      setMensajes((await api.get(`${API_URL}/chat/${equipoId}`)).data);
      setSinMasMensajes(false); // reset al cargar conversación nueva
    } catch {
      // silencioso
    }
  }, []);

  // Carga mensajes anteriores al primer mensaje actual (paginación hacia arriba)
  const cargarMensajesAnteriores = useCallback(async (equipoId, primerMensajeId) => {
    if (cargandoAnteriores || sinMasMensajes || !primerMensajeId) return;
    setCargandoAnteriores(true);
    try {
      const res = await api.get(`${API_URL}/chat/${equipoId}`, { params: { antes: primerMensajeId } });
      const anteriores = res.data;
      if (anteriores.length === 0) {
        setSinMasMensajes(true);
      } else {
        // Prepend manteniendo orden cronológico (los nuevos vienen más viejos)
        setMensajes((prev) => {
          // Evitar duplicados por mensaje_id
          const existentes = new Set(prev.map((m) => m.mensaje_id));
          const unicos = anteriores.filter((m) => !existentes.has(m.mensaje_id));
          return [...unicos, ...prev];
        });
      }
    } catch {
      // silencioso
    } finally {
      setCargandoAnteriores(false);
    }
  }, [cargandoAnteriores, sinMasMensajes]);

  const cargarComentariosTarea = useCallback(async (tareaId) => {
    try {
      setComentariosTarea((await api.get(`${API_URL}/tareas/${tareaId}/comentarios`)).data);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    cargarEquipos();
  }, [cargarEquipos]);

  /* ---------------- realtime ---------------- */

  /* Estas tres van ANTES de los efectos que las usan. Un useCallback
     declarado más abajo queda en zona muerta temporal cuando el array de
     dependencias del efecto —que se evalúa durante el render— lo referencia
     antes, y eso revienta el componente entero con ReferenceError. El build
     no lo detecta: compilar no es ejecutar. */
  // Deja el panel de chat como recién abierto. Se usa tras vaciar el historial,
  // y no solo para `mensajes`: si no se limpian la búsqueda, la respuesta en
  // curso y el contador de pendientes, quedan apuntando a filas que ya no existen.
  const resetearChat = useCallback(() => {
    setMensajes([]);
    setSinMasMensajes(true);
    setCargandoAnteriores(false);
    setBusquedaChat('');
    setCoincidenciaActual(0);
    setRespondiendoA(null);
    setMenuResponder(null);
    setMensajeABorrar(null);
    setNuevosSinVer(0);
    setMensajesNoLeidos(0);
    estaAbajoRef.current = true;
    setMostrarBotonChat(false);
  }, []);

  const cerrarModalVaciar = useCallback(() => {
    setModalVaciar(false);
    setConfirmacionVaciar('');
  }, []);

  const vaciarHistorial = useCallback(async () => {
    const equipoId = equipoActivoRef.current;
    if (!equipoId) return;
    cerrarModalVaciar();
    try {
      const res = await api.delete(`${API_URL}/chat/historial/${equipoId}`);
      resetearChat();
      toast.success(`Se borraron ${res.data.borrados} mensaje(s)`);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Solo el administrador del equipo puede vaciar el historial');
      } else {
        toast.error('Error al vaciar el historial');
      }
    }
  }, [resetearChat, cerrarModalVaciar]);

  useEffect(() => {
    // El servidor exige el JWT en el handshake. Se pasa como función para que
    // cada reconexión use el token vigente del localStorage.
    const socket = io(API_URL, {
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
    });
    socketRef.current = socket;

    socket.on('tarea-creada', ({ tarea }) =>
      setTareas((prev) => (prev.some((t) => t.tarea_id === tarea.tarea_id) ? prev : [tarea, ...prev])));

    socket.on('tarea-movida', ({ tarea }) =>
      setTareas((prev) => prev.map((t) => (t.tarea_id === tarea.tarea_id ? tarea : t))));

    socket.on('tarea-editada', ({ tarea }) =>
      setTareas((prev) => prev.map((t) => (t.tarea_id === tarea.tarea_id ? tarea : t))));

    socket.on('tarea-eliminada', ({ tarea_id }) =>
      setTareas((prev) => prev.filter((t) => t.tarea_id !== tarea_id)));

    socket.on('comentario-nuevo', ({ tarea_id, comentario }) => {
      if (tareaEditandoRef.current?.tarea_id === tarea_id) {
        setComentariosTarea((prev) =>
          prev.some((c) => c.comentario_id === comentario.comentario_id) ? prev : [...prev, comentario]);
      }
    });

    socket.on('nuevo-mensaje', (msg) => {
      // Evita que mensajes de otro equipo aparezcan si el usuario cambió
      // de equipo rápido y el socket tarda en emitir.
      if (msg.equipo_id !== equipoActivoRef.current) return;
      setMensajes((prev) => agregarMensaje(msg, prev));
      if (!chatAbiertoRef.current) {
        setMensajesNoLeidos((prev) => prev + 1);
      } else if (!estaAbajoRef.current) {
        // Chat abierto pero usuario scrolleado arriba: cuenta para el botón.
        // Antes se leía `mostrarBotonChat` desde este efecto, que solo
        // depende de [agregarMensaje]: closure congelada en false, nunca contaba.
        setNuevosSinVer((prev) => prev + 1);
      }
    });

    // El admin del equipo borra un mensaje: desaparece para todos, en vivo.
    socket.on('mensaje-eliminado', ({ mensaje_id }) => {
      if (!mensaje_id) return;
      setMensajes((prev) => prev.filter((m) => m.mensaje_id !== mensaje_id));
      // Si estabas respondiéndole, la cita quedaría colgando de algo que ya no existe.
      setRespondiendoA((prev) => (prev?.mensaje_id === mensaje_id ? null : prev));
    });

    // El admin vació el historial. Guardado por equipo_id: si el socket
    // llega tarde tras cambiar de equipo, no debe vaciar el panel equivocado.
    socket.on('chat-vaciado', ({ equipo_id, borrados }) => {
      if (equipo_id !== equipoActivoRef.current) return;
      resetearChat();
      toast(`Un administrador vació el chat (${borrados} mensaje(s))`);
    });

    // Alguien salió o fue expulsado: refresca la lista de miembros sin recargar.
    socket.on('miembros-actualizados', ({ equipo_id }) => {
      if (equipo_id === equipoActivoRef.current) cargarMiembros(equipo_id);
    });

    // El equipo se quedó sin miembros y se eliminó en el backend.
    socket.on('equipo-eliminado', ({ equipo_id }) => {
      setEquipos((prev) => prev.filter((e) => e.equipo_id !== equipo_id));
      if (equipoActivoRef.current === equipo_id) {
        equipoActivoRef.current = null;
        setEquipoActivo(null);
        setTareas([]);
        setMensajes([]);
        setMiembros([]);
      }
    });

    // Un admin expulsó al usuario: sale de la sala y vuelve a la lista.
    socket.on('expulsado-equipo', ({ equipo_id }) => {
      setEquipos((prev) => prev.filter((e) => e.equipo_id !== equipo_id));
      if (equipoActivoRef.current === equipo_id) {
        socket.emit('salir-equipo', equipo_id);
        equipoActivoRef.current = null;
        setEquipoActivo(null);
        setTareas([]);
        setMensajes([]);
        setMiembros([]);
        setMensajesNoLeidos(0);
        setSidebarMovil(false);
        setVista('dashboard');
        toast.error('Un administrador te expulsó del equipo');
      }
    });

    return () => socket.disconnect();
  // Sin deps más allá de agregarMensaje: el resto del estado que lee el
  // listener (chatAbiertoRef, estaAbajoRef, equipoActivoRef) vive en refs,
  // que no cambian de identidad entre renders.
  }, [agregarMensaje, resetearChat, cargarMiembros]);

  useEffect(() => {
    if (!chatRef.current) return;
    const el = chatRef.current;
    // Solo auto-scroll si el usuario ya estaba abajo (dentro de 50px).
    // Si subió a leer historial, no le arrebatamos la posición.
    const estabaAbajo = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (estabaAbajo) {
      el.scrollTop = el.scrollHeight;
      estaAbajoRef.current = true;
      // Si estaba abajo, oculta el botón y resetea contador.
      // Functional updates evitan dependencias en el array.
      setMostrarBotonChat(false);
      setNuevosSinVer(0);
    }
  }, [mensajes]);

  // Handler de scroll del chat: muestra/oculta botón "ir al final", cuenta nuevos,
  // y carga mensajes anteriores al llegar al tope.
  const handleChatScroll = useCallback((e) => {
    const el = e.currentTarget;
    const distanciaAlFinal = el.scrollHeight - el.scrollTop - el.clientHeight;
    const hayEspacio = el.scrollHeight > el.clientHeight;
    const abajo = !hayEspacio || distanciaAlFinal < UMBRAL_FINAL_CHAT;

    // Ref primero: el listener del socket lo consulta en cualquier momento.
    estaAbajoRef.current = abajo;
    setMostrarBotonChat(!abajo);

    // El contador se borra SOLO al llegar al final. Antes se reseteaba en
    // cualquier evento de scroll, así que scrollear arriba o abajo borraba
    // el "+N" sin que el usuario hubiera leído nada. El +1 vive únicamente
    // en el listener 'nuevo-mensaje'.
    if (abajo) setNuevosSinVer(0);
    setMenuResponder(null);

    // Cargar mensajes antiguos al llegar arriba (scrollTop < 80px)
    if (el.scrollTop < 80 && hayEspacio && !cargandoAnteriores && !sinMasMensajes) {
      const primerMensaje = mensajes[0];
      if (primerMensaje?.mensaje_id) {
        // Guardar scrollHeight actual para restaurar posición después del prepend
        const alturaAntes = el.scrollHeight;
        setTimeout(() => {
          if (chatRef.current) {
            const diff = chatRef.current.scrollHeight - alturaAntes;
            chatRef.current.scrollTop += diff;
          }
        }, 0);
        cargarMensajesAnteriores(equipoActivoRef.current, primerMensaje.mensaje_id);
      }
    }
  }, [cargandoAnteriores, sinMasMensajes, mensajes, equipoActivoRef, cargarMensajesAnteriores]);

  // Scroll programático al final (botón)
  const irAlFinalChat = useCallback(() => {
    if (!chatRef.current) return;
    const el = chatRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    estaAbajoRef.current = true;
    setMostrarBotonChat(false);
    setNuevosSinVer(0);
  }, []);

  /* ---------------- Responder mensajes (estilo WhatsApp) ---------------- */

  const iniciarRespuesta = useCallback((msg) => {
    setRespondiendoA(msg);
    setMenuResponder(null);
    // El foco al input hace que el usuario pueda escribir de inmediato.
    requestAnimationFrame(() => document.getElementById('chat-input')?.focus());
  }, []);

  const cancelarRespuesta = useCallback(() => setRespondiendoA(null), []);

  // Clic derecho sobre una burbuja: abre el mini-menú de "Responder".
  const abrirMenuResponder = useCallback((e, msg) => {
    e.preventDefault();
    e.stopPropagation();
    // Acotamos contra el viewport: sin esto, un clic cerca del borde inferior
    // abre el menú fuera de la pantalla.
    const ANCHO = 176;
    const ALTO = 48;
    setMenuResponder({
      msg,
      x: Math.min(e.clientX, window.innerWidth - ANCHO - 8),
      y: Math.min(e.clientY, window.innerHeight - ALTO - 8),
    });
  }, []);

  // El menú es flotante y vive en un overlay; cualquier click fuera lo cierra.
  useEffect(() => {
    if (!menuResponder) return;
    const cerrar = () => setMenuResponder(null);
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('click', cerrar);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', cerrar);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuResponder]);

  // Borrado de mensajes. La autorización real la hace el backend (rol 'admin'
  // dentro de ese equipo); esto es solo la UI.
  const confirmarBorrar = useCallback(async () => {
    if (!mensajeABorrar?.mensaje_id) return;
    const id = mensajeABorrar.mensaje_id;
    setMensajeABorrar(null);
    try {
      await api.delete(`${API_URL}/chat/mensajes/${id}`);
      setMensajes((prev) => prev.filter((m) => m.mensaje_id !== id));
      setRespondiendoA((prev) => (prev?.mensaje_id === id ? null : prev));
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Solo el administrador del equipo puede borrar mensajes');
      } else if (err.response?.status === 404) {
        toast.error('El mensaje ya no existe');
      } else {
        toast.error('Error al borrar el mensaje');
      }
    }
  }, [mensajeABorrar]);

  // Sube al mensaje citado. Busca por id en el DOM ya renderizado.
  const irAlMensaje = useCallback((mensajeId) => {
    const el = chatRef.current?.querySelector(`[data-msg-id="${mensajeId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Destello para que el usuario ubique el mensaje entre el historial.
    el.classList.add('ev-msg-resaltada');
    setTimeout(() => el.classList.remove('ev-msg-resaltada'), 1400);
  }, []);

  /* ---------------- Buscador de mensajes ---------------- */

  // Índices de los mensajes que contienen la consulta, en orden cronológico.
  // Busca también en el texto citado: si alguien te respondsió con una
  // palabra, quieres poder encontrarla desde su mensaje original.
  const coincidencias = useMemo(() => {
    const q = busquedaChat.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    mensajes.forEach((m, i) => {
      const propio = (m.texto || '').toLowerCase();
      const citado = (m.respuesta_texto || '').toLowerCase();
      if (propio.includes(q) || citado.includes(q)) out.push(i);
    });
    return out;
  }, [mensajes, busquedaChat]);

  // Parte el texto en segmentos y envuelve las coincidencias en <mark>.
  // Usa indexOf y no RegExp a propósito: lo que escribe el usuario se iría
  // directo al patrón, y sin escapar un "(" revienta la búsqueda.
  const resaltar = (texto, claveActiva) => {
    const q = busquedaChat.trim();
    if (!q || !texto) return texto;
    const bajo = texto.toLowerCase();
    const aguja = q.toLowerCase();
    const out = [];
    let i = 0;
    let n = 0;
    while (i < bajo.length) {
      const p = bajo.indexOf(aguja, i);
      if (p === -1) { out.push(texto.slice(i)); break; }
      if (p > i) out.push(texto.slice(i, p));
      const esActiva = claveActiva === n;
      out.push(
        <mark key={`${p}-${n}`} className={`ev-coincidencia${esActiva ? ' ev-coincidencia-activa' : ''}`}>
          {texto.slice(p, p + aguja.length)}
        </mark>
      );
      i = p + aguja.length;
      n += 1;
    }
    return out;
  };

  // Con socket pueden llegar mensajes y la lista de coincidencias cambia
  // sola, así que el índice se acota para no salirse de rango.
  const totalCoincidencias = coincidencias.length;
  const indiceSeguro = totalCoincidencias
    ? Math.min(coincidenciaActual, totalCoincidencias - 1)
    : 0;

  const moverCoincidencia = useCallback((delta) => {
    if (!totalCoincidencias) return;
    const base = Math.min(coincidenciaActual, totalCoincidencias - 1);
    // Módulo para que en los extremos siga dando la vuelta.
    setCoincidenciaActual((base + delta + totalCoincidencias) % totalCoincidencias);
  }, [coincidenciaActual, totalCoincidencias]);

  // Salta al mensaje de la coincidencia activa.
  useEffect(() => {
    if (!totalCoincidencias) return;
    const msg = mensajes[coincidencias[Math.min(coincidenciaActual, totalCoincidencias - 1)]];
    if (!msg?.mensaje_id) return;
    const el = chatRef.current?.querySelector(`[data-msg-id="${msg.mensaje_id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [coincidencias, coincidenciaActual, mensajes, totalCoincidencias]);

  // Cada cambio de texto vuelve a la primera coincidencia.
  useEffect(() => {
    setCoincidenciaActual(0);
  }, [busquedaChat]);

  const cerrarBuscador = useCallback(() => {
    setBuscadorAbierto(false);
    setBusquedaChat('');
    setCoincidenciaActual(0);
  }, []);

  const abrirBuscador = useCallback(() => {
    setBuscadorAbierto(true);
    setCoincidenciaActual(0);
    requestAnimationFrame(() => document.getElementById('chat-buscar')?.focus());
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => () => cancelAnimationFrame(heroRafRef.current), []);

  /* ---------------- resumen global (solo vista de equipos) ---------------- */

  // El backend no tiene un endpoint agregado, asi que se pide el tablero de
  // cada equipo en paralelo. Un equipo que falle no tumba el resumen: se
  // resuelve con lista vacia y el resto de las metricas siguen valiendo.
  useEffect(() => {
    if (equipoActivo || equipos.length === 0) {
      setTareasPorEquipo({});
      return undefined;
    }

    let vigente = true;
    (async () => {
      const resultados = await Promise.all(
        equipos.map(async (eq) => {
          try {
            const res = await api.get(`${API_URL}/tareas/equipo/${eq.equipo_id}`);
            return [eq.equipo_id, res.data];
          } catch {
            return [eq.equipo_id, []];
          }
        })
      );
      if (vigente) setTareasPorEquipo(Object.fromEntries(resultados));
    })();

    return () => {
      vigente = false;
    };
  }, [equipos, equipoActivo]);

  // Solo rota la frase cuando no hay equipo seleccionado: dentro de un
  // equipo el hero no existe y el intervalo no tendria a que animar.
  useEffect(() => {
    if (equipoActivo) return undefined;
    const interval = window.setInterval(() => {
      setFraseHeroIdx((prev) => (prev + 1) % FRASES_HERO.length);
    }, INTERVALO_FRASE_HERO);
    return () => window.clearInterval(interval);
  }, [equipoActivo]);

  // El letrero de la mascota es el caso contrario: solo existe DENTRO de un
  // equipo, asi que el intervalo se arma cuando hay equipo activo y se apaga
  // en la vista de equipos. Sin esta guarda correria en la pagina donde el
  // letrero no esta en pantalla.
  useEffect(() => {
    if (!equipoActivo) return undefined;
    const interval = window.setInterval(() => {
      setFraseMascotaIdx((prev) => (prev + 1) % FRASES_MASCOTA.length);
    }, INTERVALO_FRASE_HERO);
    return () => window.clearInterval(interval);
  }, [equipoActivo]);

  // El glow se mueve con transform (no left/top) para no provocar reflow
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

  /* ---------------- metricas del dashboard ---------------- */

  const metricas = useMemo(() => {
    const total = tareas.length;
    const porEstado = ORDEN_ESTADOS.map((k) => ({
      clave: k,
      label: ESTADOS[k].label,
      valor: tareas.filter((t) => t.estado === k).length,
      punto: ESTADOS[k].punto,
    }));
    const completadas = porEstado.find((e) => e.clave === 'completada')?.valor ?? 0;
    const vencidas = tareas.filter((t) => {
      const d = getDiasRestantes(t.fecha_entrega);
      return d !== null && d < 0 && t.estado !== 'completada';
    });
    const porPrioridad = Object.entries(PRIORIDADES).map(([clave, p]) => ({
      clave,
      label: p.label,
      color: p.color,
      valor: tareas.filter((t) => (t.prioridad || 'verde') === clave).length,
    }));
    const carga = miembros
      .map((m) => ({
        nombre: m.nombre,
        usuario_id: m.usuario_id,
        abiertas: tareas.filter((t) => String(t.asignado_a) === String(m.usuario_id) && t.estado !== 'completada').length,
        total: tareas.filter((t) => String(t.asignado_a) === String(m.usuario_id)).length,
      }))
      .sort((a, b) => b.abiertas - a.abiertas);
    const sinAsignar = tareas.filter((t) => !t.asignado_a && t.estado !== 'completada').length;

    return {
      total,
      porEstado,
      completadas,
      activas: total - completadas,
      vencidas: vencidas.length,
      vencidasLista: vencidas,
      tasa: pct(completadas, total),
      porPrioridad,
      carga,
      sinAsignar,
      proximas: tareas
        .filter((t) => t.estado !== 'completada' && getDiasRestantes(t.fecha_entrega) !== null)
        .sort((a, b) => new Date(a.fecha_entrega) - new Date(b.fecha_entrega))
        .slice(0, 5),
    };
  }, [tareas, miembros]);

  /* ---------------- metricas globales del selector ---------------- */

  const resumenGlobal = useMemo(() => {
    const todas = Object.values(tareasPorEquipo).flat();
    const completadas = todas.filter((t) => t.estado === 'completada').length;
    const vencidas = todas.filter((t) => {
      const d = getDiasRestantes(t.fecha_entrega);
      return d !== null && d < 0 && t.estado !== 'completada';
    });

    // Avance por equipo: el tablero es el dato que el usuario ya conoce de
    // cada equipo, asi que se lee sin entrar a ninguno.
    const porEquipo = equipos
      .map((eq) => {
        const lista = tareasPorEquipo[eq.equipo_id] || [];
        const hechas = lista.filter((t) => t.estado === 'completada').length;
        const porHacer = lista.length - hechas;
        const dias = lista.filter((t) => {
          const d = getDiasRestantes(t.fecha_entrega);
          return d !== null && d < 0 && t.estado !== 'completada';
        }).length;
        return {
          equipo: eq,
          total: lista.length,
          avance: pct(hechas, lista.length),
          urgente: porHacer > 0 && dias > 0,
        };
      })
      .sort((a, b) => b.urgente - a.urgente || b.total - a.total);

    return {
      tareas: todas.length,
      completadas,
      pendientes: todas.length - completadas,
      vencidas: vencidas.length,
      // Count separate: lo que ya paso (red de "Vencidas") y lo que vence
      // hoy (urgente pero aun recuperable) no son lo mismo.
      hoy: todas.filter((t) => {
        const d = getDiasRestantes(t.fecha_entrega);
        return d === 0 && t.estado !== 'completada';
      }).length,
      tasa: pct(completadas, todas.length),
      admins: equipos.filter((eq) => eq.rol === 'admin').length,
      porEquipo,
      // Las 5 entregas mas cercanas de todos los equipos, no solo del abierto.
      proximas: Object.entries(tareasPorEquipo)
        .flatMap(([equipoId, lista]) => {
          const eq = equipos.find((e) => String(e.equipo_id) === String(equipoId));
          return lista
            .filter((t) => t.estado !== 'completada' && getDiasRestantes(t.fecha_entrega) !== null)
            .map((t) => ({ ...t, equipo_id: equipoId, equipo_nombre: eq?.nombre || 'Equipo' }));
        })
        .sort((a, b) => new Date(a.fecha_entrega) - new Date(b.fecha_entrega))
        .slice(0, 5),
    };
  }, [equipos, tareasPorEquipo]);

  /* ---------------- conteo animado de las cifras ---------------- */

  // Un solo rAF para las cinco cifras: interpolan juntas hacia su valor
  // real. Si el usuario entra a un equipo, el panel se desmonta y el rAF
  // se cancela, asi que no queda contando a ciegas.
  useEffect(() => {
    if (equipoActivo) {
      cancelAnimationFrame(cifrasRafRef.current);
      return undefined;
    }

    const objetivo = {
      equipos: equipos.length,
      tareas: resumenGlobal.tareas,
      completadas: resumenGlobal.completadas,
      vencidas: resumenGlobal.vencidas,
      tasa: resumenGlobal.tasa,
    };
    const duracion = 900;
    const inicio = performance.now();

    const paso = (ahora) => {
      // easeOutCubic: rapido al principio, frena al final
      const t = Math.min((ahora - inicio) / duracion, 1);
      const eased = 1 - (1 - t) ** 3;
      setCifras({
        equipos: Math.round(objetivo.equipos * eased),
        tareas: Math.round(objetivo.tareas * eased),
        completadas: Math.round(objetivo.completadas * eased),
        vencidas: Math.round(objetivo.vencidas * eased),
        tasa: Math.round(objetivo.tasa * eased),
      });
      if (t < 1) cifrasRafRef.current = requestAnimationFrame(paso);
    };

    cifrasRafRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cifrasRafRef.current);
  }, [equipos.length, resumenGlobal.tareas, resumenGlobal.completadas, resumenGlobal.vencidas, resumenGlobal.tasa, equipoActivo]);

  const tareasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    // 'vencidas' es un valor especial de filtroPrioridad, no una prioridad
    const soloVencidas = filtroPrioridad === 'vencidas';
    return tareas.filter((t) => {
      if (soloVencidas) {
        const d = getDiasRestantes(t.fecha_entrega);
        if (d === null || d >= 0 || t.estado === 'completada') return false;
      } else if (filtroPrioridad !== 'todas' && (t.prioridad || 'verde') !== filtroPrioridad) return false;
      if (filtroMiembro === 'sin_asignar' && t.asignado_a) return false;
      if (filtroMiembro !== 'todos' && filtroMiembro !== 'sin_asignar' && String(t.asignado_a) !== filtroMiembro) return false;
      if (filtroFecha) {
        const f = new Date(t.fecha_entrega);
        if (Number.isNaN(f.getTime())) return false;
        if (claveDiaLocal(f) !== filtroFecha) return false;
      }
      if (q && !`${t.titulo} ${t.descripcion || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tareas, filtroPrioridad, filtroMiembro, filtroFecha, busqueda]);

  /* ---------------- acciones ---------------- */

  const alternarVencidas = () => {
    setFiltroPrioridad((prev) => (prev === 'vencidas' ? 'todas' : 'vencidas'));
  };

  const limpiarFiltros = () => {
    setFiltroPrioridad('todas');
    setFiltroMiembro('todos');
    setFiltroFecha('');
    setBusqueda('');
  };

  // El calendario pide filtrar por un dia concreto y saltar al tablero.
  const verFechaEnTablero = (clave) => {
    limpiarFiltros();
    setFiltroFecha(clave);
    setVista('tablero');
  };

  const alternarCalendario = () => {
    setCalendarioVisible((prev) => {
      const siguiente = !prev;
      try {
        localStorage.setItem(CLAVE_CALENDARIO, siguiente ? '1' : '0');
      } catch {
        // Sin permiso de escritura: el toggle funciona igual en esta sesion.
      }
      return siguiente;
    });
  };

  // El ref lo lee el listener del socket. El chat ya no es un tab: esta
  // siempre montado en escritorio y es un drawer en movil, asi que solo
  // cuenta como "no leido" cuando el drawer esta cerrado.
  // En escritorio el chat siempre está visible cuando hay equipo activo.
  const abrirChatMovil = () => {
    chatAbiertoRef.current = true;
    setMensajesNoLeidos(0);
    setChatMovil(true);
  };

  const cerrarChatMovil = () => {
    chatAbiertoRef.current = false;
    setChatMovil(false);
  };

  // Sincroniza chatAbiertoRef: en escritorio (xl:flex) el chat es siempre
  // visible cuando hay equipo; en móvil sigue el estado del drawer.
  useEffect(() => {
    const esEscritorio = window.matchMedia('(min-width: 1280px)').matches;
    if (esEscritorio && equipoActivo) {
      chatAbiertoRef.current = true;
    } else if (!esEscritorio) {
      chatAbiertoRef.current = chatMovil;
    }
  }, [equipoActivo, chatMovil]);

  // Escape cierra el drawer del chat en móvil (igual que el menú de la navbar)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && chatMovil) cerrarChatMovil();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatMovil]);

  const cambiarVista = (siguiente) => {
    setVista(siguiente);
  };

  const seleccionarEquipo = async (equipo) => {
    if (socketRef.current && equipoActivo) socketRef.current.emit('salir-equipo', equipoActivo.equipo_id);
    const equipoId = equipo.equipo_id;
    setEquipoActivo(equipo);
    equipoActivoRef.current = equipoId; // para el listener del socket
    setMensajesNoLeidos(0);
    setFiltroPrioridad('todas');
    setFiltroMiembro('todos');
    setFiltroFecha('');
    setBusqueda('');
    setRespondiendoA(null);
    setMenuResponder(null);
    setBuscadorAbierto(false);
    setBusquedaChat('');
    socketRef.current?.emit('unirse-equipo', equipoId);

    // Guarda de carrera: si el usuario cambia de equipo antes de que terminen
    // las peticiones, ignoramos las respuestas del equipo anterior.
    let vigente = true;
    const promesas = [
      cargarTareas(equipoId),
      cargarMiembros(equipoId),
      cargarMensajes(equipoId),
    ];
    try {
      await Promise.all(promesas);
    } finally {
      vigente = false;
    }
    // Si ya no es el equipo activo, limpiamos lo que llegó tarde.
    if (!vigente && equipoActivoRef.current !== equipoId) {
      setMensajes([]);
      setTareas([]);
      setMiembros([]);
    }
  };

  // Vuelve a la lista de equipos sin abandonar la membresía.
  const volverAEquipos = () => {
    socketRef.current?.emit('salir-equipo', equipoActivo.equipo_id);
    setEquipoActivo(null);
    equipoActivoRef.current = null;
    setTareas([]);
    setMensajes([]);
    setMiembros([]);
    chatAbiertoRef.current = false;
    setMensajesNoLeidos(0);
    setRespondiendoA(null);
    setMenuResponder(null);
    setBuscadorAbierto(false);
    setBusquedaChat('');
    setSidebarMovil(false);
    setVista('dashboard');
  };

  const getToastMsg = (err) => {
    const data = err?.response?.data;
    if (typeof data === 'string') return data;
    if (data?.mensaje) return data.mensaje;
    return 'Ocurrió un error';
  };

  const abandonarEquipo = async () => {
    if (!equipoActivo) return;
    try {
      const res = await api.post(`${API_URL}/equipos/${equipoActivo.equipo_id}/salir`);
      toast.success(res.data?.mensaje || 'Saliste del equipo');
      setModalSalirEquipo(false);
      socketRef.current?.emit('salir-equipo', equipoActivo.equipo_id);
      await cargarEquipos();
      volverAEquipos();
    } catch (err) {
      toast.error(getToastMsg(err));
    }
  };

  const expulsarMiembro = async () => {
    if (!miembroAExpulsar || !equipoActivo) return;
    try {
      await api.delete(`${API_URL}/equipos/${equipoActivo.equipo_id}/miembros/${miembroAExpulsar.usuario_id}`);
      setMiembros((prev) => prev.filter((m) => String(m.usuario_id) !== String(miembroAExpulsar.usuario_id)));
      if (String(filtroMiembro) === String(miembroAExpulsar.usuario_id)) setFiltroMiembro('todos');
      toast.success(`${miembroAExpulsar.nombre} fue expulsado del equipo`);
      setMiembroAExpulsar(null);
    } catch (err) {
      toast.error(getToastMsg(err));
    }
  };

  const crearEquipo = async () => {
    if (!nombreEquipo.trim()) return;
    try {
      const res = await api.post(`${API_URL}/equipos/crear`, { nombre: nombreEquipo, usuario_id: usuario });
      setEquipos((prev) => [res.data.equipo, ...prev]);
      setNombreEquipo('');
      setShowCrearEquipo(false);
      toast.success('Equipo creado');
      await seleccionarEquipo(res.data.equipo);
    } catch (err) {
      toast.error(getToastMsg(err));
    }
  };

  const unirseEquipo = async () => {
    if (!codigoUnirse.trim()) return;
    try {
      const res = await api.post(`${API_URL}/equipos/unirse`, { codigo: codigoUnirse.toUpperCase(), usuario_id: usuario });
      await cargarEquipos();
      setCodigoUnirse('');
      setShowUnirse(false);
      toast.success('Te uniste al equipo');
      await seleccionarEquipo(res.data.equipo);
    } catch (err) {
      toast.error(getToastMsg(err));
    }
  };

  const crearTarea = async () => {
    if (!nuevaTarea.titulo.trim()) return;
    try {
      const res = await api.post(`${API_URL}/tareas/crear`, {
        equipo_id: equipoActivo.equipo_id,
        titulo: nuevaTarea.titulo,
        descripcion: nuevaTarea.descripcion,
        prioridad: nuevaTarea.prioridad,
        fecha_entrega: nuevaTarea.fecha_entrega || null,
        asignado_a: nuevaTarea.asignado_a || null,
        creado_por: usuario,
      });
      // Sin duplicar: el servidor también emite 'tarea-creada' y el listener
      // deduplica por tarea_id, pero la respuesta puede llegar antes que el evento.
      setTareas((prev) => (prev.some((t) => t.tarea_id === res.data.tarea.tarea_id) ? prev : [res.data.tarea, ...prev]));
      setNuevaTarea({ titulo: '', descripcion: '', prioridad: 'verde', fecha_entrega: '', asignado_a: '' });
      setShowCrearTarea(false);
      toast.success('Tarea creada');
    } catch {
      toast.error('Error al crear tarea');
    }
  };

  const moverTarea = async (tareaId, nuevoEstado) => {
    const tarea = tareas.find((t) => t.tarea_id === tareaId);
    if (!tarea || tarea.estado === nuevoEstado) return;
    // Optimista: la UI responde al instante y el socket confirma
    setTareas((prev) => prev.map((t) => (t.tarea_id === tareaId ? { ...t, estado: nuevoEstado } : t)));
    try {
      const res = await api.put(`${API_URL}/tareas/${tareaId}/mover`, { estado: nuevoEstado });
      setTareas((prev) => prev.map((t) => (t.tarea_id === tareaId ? res.data.tarea : t)));
    } catch {
      setTareas((prev) => prev.map((t) => (t.tarea_id === tareaId ? tarea : t)));
      toast.error('No se pudo mover la tarea');
    }
  };

  const eliminarTarea = async (tareaId) => {
    try {
      await api.delete(`${API_URL}/tareas/${tareaId}`);
      // La tarjeta se quita al llegar 'tarea-eliminada' del servidor; se quita
      // también aquí por si el evento tarda o el socket está reconectando.
      setTareas((prev) => prev.filter((t) => t.tarea_id !== tareaId));
      toast.success('Tarea eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const abrirEditorTarea = (tarea) => {
    setTareaEditando(tarea);
    tareaEditandoRef.current = tarea;
    setTareaEditForm({
      titulo: tarea.titulo,
      descripcion: tarea.descripcion || '',
      prioridad: tarea.prioridad || 'verde',
      fecha_entrega: tarea.fecha_entrega ? new Date(tarea.fecha_entrega).toISOString().split('T')[0] : '',
      asignado_a: tarea.asignado_a || '',
      estado: tarea.estado || 'pendiente',
    });
    cargarComentariosTarea(tarea.tarea_id);
  };

  const cerrarEditorTarea = () => {
    setTareaEditando(null);
    tareaEditandoRef.current = null;
    setComentariosTarea([]);
    setNuevoComentario('');
  };

  const agregarComentario = async () => {
    if (!nuevoComentario.trim() || !tareaEditando) return;
    try {
      const res = await api.post(`${API_URL}/tareas/${tareaEditando.tarea_id}/comentarios`, { texto: nuevoComentario });
      // El servidor emite 'comentario-nuevo' a toda la sala (incluido quien
      // comenta); se agrega aquí también, deduplicando por comentario_id.
      setComentariosTarea((prev) =>
        prev.some((c) => c.comentario_id === res.data.comentario_id) ? prev : [...prev, res.data]);
      setNuevoComentario('');
    } catch {
      toast.error('Error al enviar comentario');
    }
  };

  const guardarEdicionTarea = async () => {
    if (!tareaEditForm.titulo.trim()) return;
    try {
      const res = await api.put(`${API_URL}/tareas/${tareaEditando.tarea_id}`, {
        titulo: tareaEditForm.titulo,
        descripcion: tareaEditForm.descripcion,
        prioridad: tareaEditForm.prioridad,
        fecha_entrega: tareaEditForm.fecha_entrega || null,
        asignado_a: tareaEditForm.asignado_a || null,
        estado: tareaEditForm.estado || tareaEditando.estado,
      });
      setTareas((prev) => prev.map((t) => (t.tarea_id === res.data.tarea.tarea_id ? res.data.tarea : t)));
      cerrarEditorTarea();
      toast.success('Tarea actualizada');
    } catch {
      toast.error('Error al guardar cambios');
    }
  };

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim()) return;
    const texto = nuevoMensaje;
    const citaMsg = respondiendoA;
    const cita = citaMsg?.mensaje_id ?? null;
    setNuevoMensaje('');
    setRespondiendoA(null);
    try {
      const res = await api.post(`${API_URL}/chat/enviar`, {
        equipo_id: equipoActivo.equipo_id,
        usuario_id: usuario,
        texto,
        respuesta_a: cita,
      });
      setMensajes((prev) => agregarMensaje(res.data, prev));
      if (res.data.censurado) {
        try {
          toast('Tu mensaje contiene lenguaje ofensivo y fue filtrado', { icon: '⚠️' });
        } catch { /* toast no disponible */ }
      }
    } catch (err) {
      setNuevoMensaje(texto);
      setRespondiendoA(citaMsg); // si falló, la respuesta sigue en pie
      if (err.response?.status === 403) {
        toast.error('No eres miembro de este equipo');
      } else {
        toast.error('Error al enviar');
      }
    }
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(equipoActivo.codigo_invitacion);
      toast.success('Código copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  /* ---------------- drag and drop ---------------- */

  // El id de la tarea arrastrada vive en un REF, no en estado. Si estuviera
  // en un useState, el setState de dragstart provocaria un re-render que
  // cambia la clase del elemento que se esta arrastrando (opacity y
  // transform). El navegador ya tomo su drag image, y mutar el nodo origen
  // a mitad de arrastre es exactamente lo que hace que el primer arrastre
  // quede trabado y el drop nunca dispare.
  const handleDragStart = (e, tarea) => {
    tareaArrastradaRef.current = tarea;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tarea.tarea_id));

    // Feedback visual imperativo: marcar la tarjeta con la misma clase que
    // usaba el estado, pero sin pasar por React.
    e.currentTarget.classList.add('ev-tarea-arrastrando');
  };

  const limpiarArrastre = () => {
    tareaArrastradaRef.current = null;
    setColumnaSobre(null);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('ev-tarea-arrastrando');
    limpiarArrastre();
  };

  const handleDrop = (e, estado) => {
    e.preventDefault();
    e.stopPropagation();
    const tarea = tareaArrastradaRef.current;
    limpiarArrastre();
    if (tarea && tarea.estado !== estado) moverTarea(tarea.tarea_id, estado);
  };

/* ---------------- vista: selector de equipos ---------------- */

  if (!equipoActivo) {
    return (
      /* El alto del navbar NO es fijo: se arma con py-3.5 (28px) + el logo
         (h-10 = 40px en movil, sm:h-11 = 44px en escritorio) + border-b (1px).
         Eso da 69px en movil y 75px en escritorio. Estas clases tienen que
         restar eso y no los 64px que usan el resto de paginas: con 64 la raiz
         se pasaba 5-11px y aparecia un segundo scrollbar pegado al primero.
         Si cambias el padding o la altura del logo en Navbar, ajusta aqui. */
      <div className="ev-bg-nexo min-h-[calc(100vh-69px)] sm:min-h-[calc(100vh-75px)] font-['Fredoka',sans-serif] relative">
        <div className="ev-gridfield absolute inset-0 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <header
            ref={heroRef}
            onMouseMove={handleHeroPointerMove}
            className="ev-mesh rounded-[2rem] text-white shadow-lg relative overflow-hidden ev-enter ev-d-0"
          >
            <div ref={heroGlowRef} className="ev-glow" />

            {/* Círculos decorativos de fondo */}
            <div aria-hidden="true" className="absolute -top-14 -left-14 w-48 h-48 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div aria-hidden="true" className="absolute -bottom-20 -right-16 w-72 h-72 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
            <div aria-hidden="true" className="absolute top-1/3 -left-20 w-56 h-56 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

            {/* Patrón de puntos, muy tenue, para que el degradado no quede plano */}
            <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30 pointer-events-none" />

            <div className="relative grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center p-6 sm:p-10 lg:p-14">
              {/* COLUMNA IZQUIERDA: texto y acciones */}
              <div className="relative z-10 text-center lg:text-left">
                <p className="text-blue-200 text-sm sm:text-base font-semibold ev-enter ev-d-1">Colaboración en equipo</p>
                <h1 className="mt-2 text-3xl sm:text-6xl font-extrabold tracking-tight ev-enter ev-d-2">Gestor de Equipos</h1>
                <p className="mt-3 sm:mt-4 text-base sm:text-xl text-blue-100 max-w-xl mx-auto lg:mx-0 ev-enter ev-d-3">
                  Crea un equipo de estudio o únete con un código para repartir tareas y avanzar juntos.
                </p>

                {/* Datos de la escena */}
                <ul className="mt-5 sm:mt-8 flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-3 ev-enter ev-d-4">
                  {BENEFICIOS.map((b) => (
                    <li key={b.texto} className="inline-flex items-center gap-2 px-3.5 sm:gap-2.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white/12 border border-white/25 text-sm sm:text-base font-semibold text-white">
                      <span className="grid place-items-center w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-white/20 text-amber-200 shrink-0">
                        <Icono nombre={b.icono} className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                      </span>
                      {b.texto}
                    </li>
                  ))}
                </ul>
              </div>

              {/* COLUMNA DERECHA: ilustracion del equipo. Es un boton:
                  la imagen es la via rapida para crear el primer equipo. */}
              <div className="relative z-10 flex justify-center ev-enter ev-d-3">
                <div className="ev-float inline-block">
                  <button
                    type="button"
                    onClick={() => { setShowCrearEquipo(true); setShowUnirse(false); }}
                    aria-label="Crear un equipo nuevo"
                    className="ev-focusable group relative block cursor-pointer rounded-3xl"
                  >
                    {/* Aro decorativo detras de la imagen */}
                    <div aria-hidden="true" className="absolute inset-0 rounded-full bg-amber-300/20 blur-2xl scale-90 transition-opacity duration-300 group-hover:opacity-80" />
                    <img
                      src="/Imagenes_Diseño/super_equipo_web.png"
                      alt="Equipo de estudiantes uniendose para trabajar en un proyecto. Crear un equipo nuevo."
                      className="ev-lift-mascota relative w-40 h-auto object-contain drop-shadow-2xl sm:w-56 lg:w-64"
                    />
                    <span
                      key={fraseHeroIdx}
                      className="ev-bubble absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-blue-950 font-black text-[11px] sm:-top-4 sm:text-base px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-2xl shadow-lg border-2 border-white whitespace-nowrap max-w-[92vw]"
                    >
                      {FRASES_HERO[fraseHeroIdx]}
                    </span>

                    {/* Pista de que la imagen es accionable */}
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white text-blue-700 text-xs sm:text-base font-black px-3 sm:px-4 py-1.5 sm:py-2 shadow-lg border border-blue-100 dark:border-blue-500/30 whitespace-nowrap">
                      <Icono nombre="mas" className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                      Crear equipo
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* BARRA DE ACCIONES: fuera del header, sobre el fondo blanco.
              Aqui viven las dos vias de entrada al gestor. */}
          <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 ev-enter ev-d-2">
            <button type="button" onClick={() => { setShowCrearEquipo(true); setShowUnirse(false); }} className="ev-btn ev-shimmer ev-focusable inline-flex cursor-pointer items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl font-bold text-lg sm:text-xl shadow-md hover:bg-blue-700">
              <Icono nombre="mas" className="w-5 sm:w-6 h-5 sm:h-6" />
              Crear equipo
            </button>
            <button type="button" onClick={() => { setShowUnirse(true); setShowCrearEquipo(false); }} className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 bg-white text-blue-700 px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl font-bold text-lg sm:text-xl border border-blue-200 dark:border-blue-500/35 hover:border-blue-400 hover:bg-blue-50">
              <Icono nombre="copiar" className="w-5 sm:w-6 h-5 sm:h-6" />
              Unirme con código
            </button>

            {/* Salir del gestor. Mismo destino que el boton del header de la
                vista de equipo, para que las dos pantallas ofrezcan la misma
                salida. */}
            <Link
              to="/"
              className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 bg-white text-slate-600 px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl font-bold text-lg sm:text-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-slate-800"
              aria-label="Volver al inicio"
            >
              <Icono nombre="inicio" className="w-5 sm:w-6 h-5 sm:h-6" />
              Volver al inicio
            </Link>
          </div>

          {(showCrearEquipo || showUnirse) && (
            <div className="ev-panel-glass rounded-2xl p-5 sm:p-7 mt-5 ev-view max-w-md">
              {showCrearEquipo ? (
                <>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Nuevo equipo</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Genera un código para invitar a tus compañeros.</p>
                  <div className="ev-field relative mt-4">
                    <input
                      type="text"
                      placeholder="Ej. Calculus II - Proyecto Final"
                      value={nombreEquipo}
                      onChange={(e) => setNombreEquipo(e.target.value)}
                      aria-label="Nombre del equipo"
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={crearEquipo} className="ev-btn ev-focusable flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">Crear equipo</button>
                    <button type="button" onClick={() => setShowCrearEquipo(false)} className="ev-focusable px-4 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Unirme a un equipo</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pide el código de 6 caracteres a quien administra el equipo.</p>
                  <div className="ev-field relative mt-4">
                    <input
                      type="text"
                      placeholder="ABC123"
                      value={codigoUnirse}
                      onChange={(e) => setCodigoUnirse(e.target.value.toUpperCase())}
                      maxLength={6}
                      aria-label="Código de invitación"
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center font-mono tracking-[0.35em] text-lg text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 uppercase"
                    />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={unirseEquipo} className="ev-btn ev-focusable flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">Unirme</button>
                    <button type="button" onClick={() => setShowUnirse(false)} className="ev-focusable px-4 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                  </div>
                </>
              )}
            </div>
          )}

          <section className="mt-6 sm:mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            {/* COLUMNA IZQUIERDA: los equipos */}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 sm:mb-5">
                Tus equipos ({equipos.length})
              </h2>
              {equipos.length === 0 ? (
              <div className="ev-panel-glass relative overflow-hidden rounded-[2rem] px-6 py-12 sm:py-20 text-center ev-enter ev-d-2">
                {/* Círculos decorativos: el mismo lenguaje del header */}
                <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-12 w-44 h-44 bg-blue-200/40 rounded-full blur-2xl" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-14 w-56 h-56 bg-amber-300/30 rounded-full blur-2xl" />
                <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />

                <div className="relative">
                  {/* Ilustracion del equipo */}
                  <div className="ev-float inline-block">
                    <img
                      src="/Imagenes_Diseño/super_equipo_web.png"
                      alt=""
                      aria-hidden="true"
                      className="w-40 h-auto object-contain drop-shadow-xl sm:w-64"
                    />
                  </div>

                  <h3 className="mt-5 sm:mt-7 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    Tu primer equipo te espera
                  </h3>
                  <p className="mt-2 sm:mt-3 text-slate-600 dark:text-slate-400 text-base sm:text-xl font-medium max-w-xl mx-auto">
                    Reúne a tus compañeros, reparte el trabajo y mira cómo avanza el proyecto en tiempo real.
                  </p>

                  <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                    <button type="button" onClick={() => { setShowCrearEquipo(true); setShowUnirse(false); }} className="ev-btn ev-shimmer ev-focusable inline-flex cursor-pointer items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl font-bold text-lg sm:text-xl shadow-md hover:bg-blue-700">
                      <Icono nombre="mas" className="w-5 sm:w-6 h-5 sm:h-6" />
                      Crear mi primer equipo
                    </button>
                    <button type="button" onClick={() => { setShowUnirse(true); setShowCrearEquipo(false); }} className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 bg-white text-blue-700 px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl font-bold text-lg sm:text-xl border border-blue-200 dark:border-blue-500/35 hover:border-blue-400 hover:bg-blue-50">
                      <Icono nombre="copiar" className="w-5 sm:w-6 h-5 sm:h-6" />
                      Tengo un código
                    </button>

                    <Link
                      to="/"
                      className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 bg-white text-slate-600 px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl font-bold text-lg sm:text-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-slate-800"
                      aria-label="Volver al inicio"
                    >
                      <Icono nombre="inicio" className="w-5 sm:w-6 h-5 sm:h-6" />
                      Volver al inicio
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {resumenGlobal.porEquipo.map(({ equipo: eq, total, avance, urgente }, i) => (
                  <button
                    key={eq.equipo_id}
                    type="button"
                    onClick={() => seleccionarEquipo(eq)}
                    className={`ev-stat ev-panel-glass ev-focusable cursor-pointer rounded-2xl p-5 sm:p-6 text-left ev-enter ${['ev-d-1', 'ev-d-2', 'ev-d-3'][i % 3]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid place-items-center w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shrink-0">
                        <Icono nombre="usuarios" className="w-5 sm:w-6 h-5 sm:h-6" />
                      </span>
                      <span className="text-[10px] sm:text-xs font-black uppercase px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 shrink-0">
                        {ETIQUETA_ROL[eq.rol] || eq.rol}
                      </span>
                    </div>
                    <h3 className="mt-4 sm:mt-5 font-extrabold text-lg sm:text-xl text-slate-900 dark:text-slate-100 leading-tight">{eq.nombre}</h3>

                    {/* Avance del equipo, sin necesidad de entrar */}
                    <div className="mt-3.5 sm:mt-4">
                      <div className="flex items-baseline justify-between text-xs font-bold mb-2">
                        <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {total === 0 ? 'Sin tareas' : `${avance}% completado`}
                        </span>
                        {urgente && (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <Icono nombre="alerta" className="w-3.5 h-3.5" />
                            Vencidas
                          </span>
                        )}
                      </div>
                      <div className="ev-progress-track" role="img" aria-label={`${eq.nombre}: ${avance}% completado`}>
                        <div
                          className={`ev-progress-fill ${avance === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}
                          style={{ width: `${avance}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3.5 sm:mt-4 flex items-center justify-between rounded-xl bg-blue-50/70 border border-blue-100 dark:border-blue-500/30 px-3.5 sm:px-4 py-2 sm:py-2.5">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-blue-500 tracking-wider">Código</p>
                        <p className="font-mono font-black text-blue-800 tracking-[0.25em] text-base sm:text-lg">{eq.codigo_invitacion}</p>
                      </div>
                      <Icono nombre="copiar" className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                    </div>
                  </button>
                ))}
              </div>
              )}
            </div>

            {/* COLUMNA DERECHA: resumen global. Se oculta sin equipos porque
                el empty state ya ofrece las dos vias de entrada. */}
            {equipos.length > 0 && (
              <aside className="space-y-4 sm:space-y-5 lg:sticky lg:top-20" aria-label="Resumen de tu actividad">
                {/* Cifras globales */}
                <div className="ev-panel-glass ev-card-dash ev-slide-right ev-sr-0 relative overflow-hidden rounded-2xl p-5 sm:p-6">
                  <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />
                  <div aria-hidden="true" className="pointer-events-none absolute -top-14 -right-10 w-36 h-36 bg-blue-200/40 rounded-full blur-2xl" />
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-8 w-32 h-32 bg-amber-300/25 rounded-full blur-2xl" />
                  <span aria-hidden="true" className="ev-esquina" />

                  <div className="relative">
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Tu actividad</h3>

                    <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-3 sm:gap-3.5">
                      {[
                        { etiqueta: 'Equipos', valor: cifras.equipos, gradiente: 'from-blue-600 to-indigo-700', icono: 'usuarios' },
                        { etiqueta: 'Tareas', valor: cifras.tareas, gradiente: 'from-indigo-500 to-violet-600', icono: 'tablero' },
                        { etiqueta: 'Completadas', valor: cifras.completadas, gradiente: 'from-emerald-500 to-teal-600', icono: 'check' },
                        { etiqueta: 'Vencidas', valor: cifras.vencidas, gradiente: 'from-rose-500 to-red-600', icono: 'alerta' },
                      ].map((s) => (
                        <div key={s.etiqueta} className="rounded-xl bg-white/85 dark:bg-slate-800/85 border border-white/70 px-3.5 py-3">
                          <span className={`ev-stat-icon grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br ${s.gradiente} text-white shadow-sm mb-2.5`}>
                            <Icono nombre={s.icono} className="w-5 h-5" />
                          </span>
                          <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-none tabular-nums">{s.valor}</p>
                          <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.etiqueta}</p>
                        </div>
                      ))}
                    </div>

                    <hr className="ev-divisor my-5" />

                    {/* Avance global */}
                    <div>
                      <div className="flex items-baseline justify-between text-sm font-bold mb-2">
                        <span className="text-slate-600 dark:text-slate-400">Avance global</span>
                        <span className="text-slate-900 dark:text-slate-100 tabular-nums">{cifras.tasa}%</span>
                      </div>
                      <div className="ev-progress-track ev-track-brillo" role="img" aria-label={`Avance global: ${resumenGlobal.tasa}%`}>
                        <div className="ev-progress-fill bg-gradient-to-r from-emerald-500 to-teal-600" style={{ width: `${resumenGlobal.tasa}%` }} />
                      </div>
                      <p className="mt-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {resumenGlobal.pendientes === 0
                          ? 'Todo al día, no te queda nada pendiente.'
                          : `${resumenGlobal.pendientes} ${resumenGlobal.pendientes === 1 ? 'tarea pendiente' : 'tareas pendientes'} en total.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Próximas entregas, mezcladas entre todos los equipos */}
                <div className="ev-panel-glass ev-card-dash ev-slide-right ev-sr-1 relative overflow-hidden rounded-2xl p-5 sm:p-6">
                  <span aria-hidden="true" className="ev-esquina" />

                  <div className="flex items-center gap-3.5">
                    <div className="ev-float shrink-0">
                      <img
                        src="/Imagenes_Diseño/asustado_web.png"
                        alt=""
                        aria-hidden="true"
                        className="w-12 sm:w-16 h-auto object-contain drop-shadow-md"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Próximas entregas</h3>
                      {resumenGlobal.hoy > 0 && (
                        <p className="mt-1 text-xs sm:text-sm font-bold text-red-600">
                          {resumenGlobal.hoy} {resumenGlobal.hoy === 1 ? 'vence hoy' : 'vencen hoy'}
                        </p>
                      )}
                    </div>
                  </div>

                  {resumenGlobal.proximas.length === 0 ? (
                    <p className="mt-5 text-base font-medium text-slate-500 dark:text-slate-400">
                      Sin fechas de entrega próximas. Asigna una a una tarea para verla aquí.
                    </p>
                  ) : (
                    <ul className="mt-5 space-y-3">
                      {resumenGlobal.proximas.map((p) => {
                        const dias = getDiasRestantes(p.fecha_entrega);
                        const venceHoy = dias !== null && dias === 0;
                        const urgente = dias !== null && dias <= 2;
                        return (
                          <li
                            key={`${p.equipo_id}-${p.tarea_id}`}
                            className={`rounded-xl border px-4 py-3 transition-colors ${
                              venceHoy
                                ? 'bg-red-50 border-red-200 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]'
                                : 'bg-white/85 dark:bg-slate-800/85 border-white/70 hover:border-blue-300'
                            }`}
                          >
                            <p className={`text-base font-bold leading-snug truncate ${venceHoy ? 'text-red-900' : 'text-slate-800 dark:text-slate-200'}`}>
                              {p.titulo}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{p.equipo_nombre}</span>
                              <span
                                className={`shrink-0 inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full ${
                                  venceHoy
                                    ? 'ev-badge-urgente bg-red-600 text-white'
                                    : urgente
                                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                <Icono nombre={venceHoy ? 'alerta' : 'reloj'} className="w-3 h-3" />
                                {dias === 0 ? '¡Hoy!' : dias === 1 ? 'Mañana' : `${dias} d`}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Recordatorio del rol: quien administra ve el código, no todos */}
                {resumenGlobal.admins > 0 && (
                  <div className="ev-slide-right ev-sr-2 relative overflow-hidden rounded-2xl bg-blue-600 p-5 sm:p-6 text-white shadow-md">
                    {/* Puntos tenues: la tarjeta azul es la unica sin glass,
                        el patron evita que quede como un bloque plano */}
                    <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-20 pointer-events-none" />
                    <div aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-12 w-36 h-36 bg-indigo-400/40 rounded-full blur-2xl" />

                    <div className="relative">
                      <p className="text-xs font-black uppercase tracking-widest text-blue-200">Tu rol</p>
                      <p className="mt-1.5 text-base sm:text-lg font-bold leading-snug">
                        {resumenGlobal.admins === equipos.length
                          ? 'Administras todos tus equipos.'
                          : `Administras ${resumenGlobal.admins} de ${equipos.length} equipos.`}
                      </p>
                      <p className="mt-1.5 text-sm text-blue-100">
                        Comparte el código de cada equipo para invitar a más compañeros.
                      </p>
                    </div>
                  </div>
                )}
              </aside>
            )}
          </section>
        </div>
      </div>
    );
  }

  /* ---------------- vista: dashboard del equipo ---------------- */

  return (
    <div className="h-[calc(100vh-69px)] sm:h-[calc(100vh-75px)] overflow-hidden bg-slate-50 dark:bg-slate-900 font-['Fredoka',sans-serif]">
      <div className="flex h-full">
        {sidebarMovil && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden ev-overlay" onClick={() => setSidebarMovil(false)} />}
        {chatMovil && <div className="fixed inset-0 bg-slate-900/40 z-40 xl:hidden ev-overlay" onClick={cerrarChatMovil} />}

        {/* Sidebar */}
        <aside
          className={`ev-panel-glass fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 lg:relative lg:z-auto
            ${sidebarMovil ? 'w-72 translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${sidebarMinimizado ? 'lg:w-16' : 'lg:w-64'}`}
        >
          <div className={`${sidebarMinimizado ? 'p-2' : 'p-4'} flex items-center border-b border-slate-200/70 dark:border-slate-700/70 gap-2`}>
            {!sidebarMinimizado && (
              <button type="button" onClick={volverAEquipos} className="ev-focusable inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-700 transition-colors">
                <Icono nombre="volver" className="w-4 h-4" />
                Equipos
              </button>
            )}
            <button
              type="button"
              onClick={() => setSidebarMinimizado(!sidebarMinimizado)}
              className="ev-focusable hidden lg:grid place-items-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-blue-700 transition-colors shrink-0 ml-auto"
              aria-label={sidebarMinimizado ? 'Expandir panel' : 'Minimizar panel'}
            >
              <Icono nombre="menu" className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setSidebarMovil(false)} className="ev-focusable lg:hidden grid place-items-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 ml-auto" aria-label="Cerrar panel">
              <Icono nombre="cerrar" className="w-4 h-4" />
            </button>
          </div>

          {!sidebarMinimizado ? (
            <>
              <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/70">
                <h2 className="font-extrabold text-slate-900 dark:text-slate-100 leading-tight">{equipoActivo.nombre}</h2>
                <button
                  type="button"
                  onClick={copiarCodigo}
                  className="ev-focusable mt-2.5 w-full flex items-center justify-between rounded-xl bg-blue-50/80 border border-blue-100 dark:border-blue-500/30 px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                  aria-label="Copiar código de invitación"
                >
                  <span className="text-left">
                    <span className="block text-[9px] font-bold uppercase text-blue-500 tracking-wider">Código</span>
                    <span className="block font-mono font-black text-blue-800 tracking-[0.3em]">{equipoActivo.codigo_invitacion}</span>
                  </span>
                  <Icono nombre="copiar" className="w-4 h-4 text-blue-400 shrink-0" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                <h3 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-widest mb-3 flex items-center justify-between">
                  <span>Miembros ({miembros.length})</span>
                  {filtroMiembro !== 'todos' && (
                    <button type="button" onClick={() => setFiltroMiembro('todos')} className="ev-focusable text-[10px] font-bold text-blue-600 hover:underline">
                      Quitar filtro
                    </button>
                  )}
                </h3>
                <ul className="space-y-1">
                  {miembros.map((m) => {
                    const carga = metricas.carga.find((c) => String(c.usuario_id) === String(m.usuario_id));
                    const abiertas = carga?.abiertas ?? 0;
                    const total = carga?.total ?? 0;
                    const maxAbiertas = Math.max(...metricas.carga.map((c) => c.abiertas), 1);
                    return (
                      <li key={m.usuario_id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFiltroMiembro(filtroMiembro === String(m.usuario_id) ? 'todos' : String(m.usuario_id))}
                          className={`ev-chip ev-focusable flex-1 min-w-0 flex items-center gap-2.5 p-2 rounded-lg text-left ${
                            filtroMiembro === String(m.usuario_id) ? 'bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/35' : 'border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                          aria-pressed={filtroMiembro === String(m.usuario_id)}
                        >
                          <span className={`ev-avatar grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br ${tonoDesdeNombre(m.nombre)} text-white text-xs font-bold shrink-0`}>
                            {m.nombre.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-1.5">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{m.nombre}</span>
                              {m.rol === 'admin' && (
                                <span className="text-[8px] font-black uppercase text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 px-1 rounded shrink-0">Admin</span>
                              )}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5">
                              <span className="ev-progress-mini flex-1">
                                <span className="ev-progress-mini-fill block bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${pct(abiertas, maxAbiertas)}%` }} />
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 shrink-0 tabular-nums">
                                {abiertas}/{total}
                              </span>
                            </span>
                          </span>
                        </button>
                        {soyAdminEquipo && String(m.usuario_id) !== String(usuario) && (
                          <button
                            type="button"
                            onClick={() => setMiembroAExpulsar(m)}
                            className="ev-focusable shrink-0 grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors"
                            aria-label={`Expulsar a ${m.nombre} del equipo`}
                            title="Expulsar del equipo"
                          >
                            <Icono nombre="cerrar" className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {metricas.sinAsignar > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiltroMiembro(filtroMiembro === 'sin_asignar' ? 'todos' : 'sin_asignar')}
                    aria-pressed={filtroMiembro === 'sin_asignar'}
                    className={`ev-chip ev-focusable mt-2 w-full flex items-center gap-2.5 p-2 rounded-lg text-left ${
                      filtroMiembro === 'sin_asignar' ? 'bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35' : 'border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="grid place-items-center w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold shrink-0">?</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">Sin asignar</span>
                      <span className="block text-[9px] text-slate-400 dark:text-slate-400">{metricas.sinAsignar} {metricas.sinAsignar === 1 ? 'tarea abierta' : 'tareas abiertas'}</span>
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setModalSalirEquipo(true)}
                  className="ev-focusable mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Icono nombre="salir" className="w-3.5 h-3.5" />
                  Salir del equipo
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center py-3 gap-2">
              <span className={`ev-avatar grid place-items-center w-8 h-8 rounded-full bg-gradient-to-br ${tonoDesdeNombre(equipoActivo.nombre)} text-white text-xs font-bold`} title={equipoActivo.nombre}>
                {equipoActivo.nombre.charAt(0).toUpperCase()}
              </span>
              {miembros.map((m) => (
                <span key={m.usuario_id} className={`ev-avatar grid place-items-center w-7 h-7 rounded-full bg-gradient-to-br ${tonoDesdeNombre(m.nombre)} text-white text-[10px] font-bold`} title={m.nombre}>
                  {m.nombre.charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </aside>

        {/* Contenido */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
          <header className="ev-mesh text-white relative overflow-hidden shrink-0">
            {/* Mascota. Va como hija DIRECTA del header y antes del div de
                contenido: ese div es `relative`, asi que al entrar despues
                pinta encima y la mascota queda de fondo.
                pointer-events-none es obligatorio: sin esto la imagen
                interceptaria los clicks de los tabs y los botones.
                SIN translate-y a proposito: el recorte la dejaba partida a
                la mitad. El alto depende de `calendarioVisible` porque el header cambia:
                medido en la app va de 96px (calendario oculto) a 413px (visible).
                Con un tamano fijo de 128px se pasaba 32px por arriba cuando el
                calendario estaba apagado y el birrete salia cortado.
                En movil se oculta (hidden lg:flex): ahi el calendario ocupa
                casi todo el header y la fila de tabs+botones queda justo en la
                zona inferior, donde la mascotita se montaba encima y tapaba
                la pestana "Tablero". */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 z-0 hidden lg:flex items-end gap-3 pointer-events-none select-none">
              <img
                src="/Imagenes_Diseño/mascota_asomada_header.png"
                alt=""
                aria-hidden="true"
                className={`object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)] ${calendarioVisible ? 'h-32' : 'h-20'}`}
              />
              {/* El `key` re-dispara la animacion de entrada del letrero en
                  cada cambio de frase. pointer-events-none sube desde el
                  contenedor: sin esto el letrero taparia los botones. */}
              <span
                key={fraseMascotaIdx}
                className="ev-bubble mb-2 whitespace-nowrap rounded-2xl border-2 border-white bg-amber-400 px-3 py-1.5 font-black text-blue-950 shadow-lg"
              >
                {FRASES_MASCOTA[fraseMascotaIdx]}
              </span>
            </div>
            <div aria-hidden="true" className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
            <div className="relative px-4 sm:px-6 py-5 sm:py-6">
              {/* Calendario de vencimientos: va antes de la fila del nombre
                  para que en movil quede arriba de todo sin scroll. */}
              {calendarioVisible && (
                <div className="flex justify-center lg:hidden mb-4 ev-enter ev-d-1">
                  <CalendarioVencimientos
                    tareas={tareas}
                    prioridades={PRIORIDADES}
                    onVerEnTablero={verFechaEnTablero}
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setSidebarMovil(true)} className="ev-focusable lg:hidden grid place-items-center w-10 h-10 rounded-xl bg-white/15 shrink-0" aria-label="Abrir panel de equipos">
                    <Icono nombre="menu" className="w-5 h-5" />
                  </button>

                  {/* Tabs */}
                  <div role="tablist" aria-label="Vistas del equipo" className="flex gap-1 rounded-xl bg-white/15 p-1 w-full sm:w-auto">
                    {[
                      { id: 'dashboard', label: 'Resumen', icono: 'grafica' },
                      { id: 'tablero', label: 'Tablero', icono: 'tablero' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={vista === t.id}
                        onClick={() => cambiarVista(t.id)}
                        className={`ev-tab ev-focusable flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold ${
                          vista === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-white hover:bg-white/15'
                        }`}
                      >
                        <Icono nombre={t.icono} className="w-4 h-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {/* En escritorio el calendario va en la misma fila */}
                  {calendarioVisible && (
                    <div className="hidden lg:block shrink-0 ev-enter ev-d-2">
                      <CalendarioVencimientos
                        tareas={tareas}
                        prioridades={PRIORIDADES}
                        onVerEnTablero={verFechaEnTablero}
                      />
                    </div>
                  )}

                  {/* Toggle del calendario. Va siempre visible (tb en movil) para
                      que se pueda volver a mostrar sin entrar a otro equipo. */}
                  <button
                    type="button"
                    onClick={alternarCalendario}
                    aria-pressed={calendarioVisible}
                    aria-label={calendarioVisible ? 'Ocultar calendario' : 'Mostrar calendario'}
                    title={calendarioVisible ? 'Ocultar calendario' : 'Mostrar calendario'}
                    className={`ev-btn ev-focusable grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors ${
                      calendarioVisible
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="17" rx="2.5" />
                      <path d="M3 10h18M8 2v4M16 2v4" strokeLinecap="round" />
                      {!calendarioVisible && (
                        <path d="M4 20L20 4" strokeLinecap="round" strokeWidth="2.2" />
                      )}
                    </svg>
                  </button>

                  <button type="button" onClick={() => setShowCrearTarea(true)} className="ev-btn ev-shimmer ev-shimmer-claro ev-focusable inline-flex cursor-pointer items-center gap-2 bg-white text-blue-700 px-3 sm:px-5 py-2.5 rounded-xl font-bold shadow-md shrink-0" aria-label="Nueva tarea" title="Nueva tarea">
                    <Icono nombre="mas" className="w-4 h-4" />
                    {/* Antes el texto solo aparecia desde sm y en movil
                        quedaba un cuadrito con un "+" suelto, sin decir que
                        lo que abria era una tarea. */}
                    <span className="hidden sm:inline">Nueva tarea</span>
                  </button>
                  <button
                    type="button"
                    onClick={abrirChatMovil}
                    className="ev-focusable xl:hidden grid place-items-center w-10 h-10 rounded-xl bg-white/15 shrink-0"
                    aria-label="Abrir chat del equipo"
                  >
                    <Icono nombre="chat" className="w-5 h-5" />
                    {mensajesNoLeidos > 0 && (
                      <span className="absolute top-1.5 right-1.5 grid place-items-center min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black">
                        {Math.min(mensajesNoLeidos, 99)}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* ---------------- DASHBOARD ---------------- */}
          {vista === 'dashboard' && (
            <div className="ev-view p-4 sm:p-6 space-y-5 shrink-0">
              {metricas.total === 0 ? (
                <div className="ev-panel-glass rounded-2xl py-16 text-center">
                  <img
                    src="/Imagenes_Diseño/mascota_mirando_web.png"
                    alt=""
                    aria-hidden="true"
                    className="mx-auto w-32 h-auto object-contain drop-shadow-md ev-float"
                  />
                  <p className="mt-5 text-slate-700 dark:text-slate-300 font-bold text-lg">Este equipo todavía no tiene tareas</p>
                  <p className="mt-1 text-slate-400 dark:text-slate-400 text-sm">Crea la primera para empezar a repartir el trabajo.</p>
                  <button type="button" onClick={() => setShowCrearTarea(true)} className="ev-btn ev-focusable mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold">
                    <Icono nombre="mas" className="w-4 h-4" />
                    Nueva tarea
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard etiqueta="Tareas totales" valor={metricas.total} detalle={`${metricas.completadas} completadas`} icono="tablero" gradiente="from-blue-600 to-indigo-600" delay="ev-d-0" />
                    <StatCard etiqueta="En curso" valor={metricas.activas} detalle={metricas.sinAsignar ? `${metricas.sinAsignar} sin asignar` : 'Todo asignado'} icono="reloj" gradiente="from-indigo-500 to-violet-600" delay="ev-d-1" />
                    <StatCard etiqueta="Vencidas" valor={metricas.vencidas} detalle={metricas.vencidas ? 'Requieren atención' : 'Al día'} icono="alerta" gradiente="from-rose-500 to-red-600" delay="ev-d-2" />
                    <StatCard etiqueta="Avance" valor={`${metricas.tasa}%`} detalle={`${metricas.completadas} de ${metricas.total}`} icono="check" gradiente="from-emerald-500 to-teal-600" anillo={metricas.tasa} delay="ev-d-3" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* Estados */}
                    <section className="ev-panel-glass rounded-2xl p-5 ev-enter ev-d-2">
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Tareas por estado</h2>
                      <div className="mt-4 space-y-3.5">
                        {metricas.porEstado.map((e) => (
                          <div key={e.clave}>
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{e.label}</span>
                              <span className="font-extrabold text-slate-900 dark:text-slate-100">{e.valor}</span>
                            </div>
                            <div className="ev-bar-track">
                              <div className="ev-bar-fill" style={{ width: `${pct(e.valor, metricas.total)}%`, backgroundColor: e.punto }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Prioridad */}
                    <section className="ev-panel-glass rounded-2xl p-5 ev-enter ev-d-3">
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Tareas por prioridad</h2>
                      <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
                        <Donut segmentos={metricas.porPrioridad} total={metricas.total} />
                        <ul className="flex-1 w-full space-y-2.5">
                          {metricas.porPrioridad.map((p) => (
                            <li key={p.clave}>
                              <button
                                type="button"
                                onClick={() => { setFiltroPrioridad(filtroPrioridad === p.clave ? 'todas' : p.clave); setVista('tablero'); }}
                                className="ev-focusable w-full flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                aria-label={`Filtrar por ${p.label}`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{p.label}</span>
                                </span>
                                <span className="font-extrabold text-slate-900 dark:text-slate-100">{p.valor}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* Carga por miembro */}
                    <section className="ev-panel-glass rounded-2xl p-5 ev-enter ev-d-4">
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Carga por miembro</h2>
                      {metricas.carga.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-400 dark:text-slate-400">Sin miembros asignados todavía.</p>
                      ) : (
                        <ul className="mt-4 space-y-3">
                          {metricas.carga.map((c) => (
                            <li key={c.usuario_id} className="flex items-center gap-3">
                              <span className={`ev-avatar grid place-items-center w-8 h-8 rounded-full bg-gradient-to-br ${tonoDesdeNombre(c.nombre)} text-white text-xs font-bold shrink-0`}>
                                {c.nombre.charAt(0).toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{c.nombre}</span>
                                  <span className="font-bold text-slate-400 dark:text-slate-400 shrink-0 ml-2">{c.abiertas} abiertas</span>
                                </div>
                                <div className="ev-bar-track" style={{ height: 8 }}>
                                  <div className="ev-bar-fill bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${pct(c.abiertas, Math.max(...metricas.carga.map((x) => x.abiertas), 1))}%` }} />
                                </div>
                              </div>
                            </li>
                          ))}
                          {metricas.sinAsignar > 0 && (
                            <li className="flex items-center gap-3 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                              <span className="grid place-items-center w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold shrink-0">?</span>
                              <div className="flex-1">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Sin asignar</span>
                                <p className="text-[11px] text-slate-400 dark:text-slate-400">{metricas.sinAsignar} {metricas.sinAsignar === 1 ? 'tarea abierta' : 'tareas abiertas'}</p>
                              </div>
                            </li>
                          )}
                        </ul>
                      )}
                    </section>

                    {/* Próximas entregas */}
                    <section className="ev-panel-glass rounded-2xl p-5 ev-enter ev-d-5">
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Próximas entregas</h2>
                      {metricas.proximas.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-400 dark:text-slate-400">No hay tareas con fecha de entrega pendiente.</p>
                      ) : (
                        <ul className="mt-4 space-y-2">
                          {metricas.proximas.map((t) => {
                            const dias = getDiasRestantes(t.fecha_entrega);
                            const urgente = dias !== null && dias <= 2;
                            return (
                              <li key={t.tarea_id}>
                                <button
                                  type="button"
                                  onClick={() => { abrirEditorTarea(t); }}
                                  className="ev-focusable w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${urgente ? 'bg-red-500' : 'bg-blue-500'}`} aria-hidden="true" />
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{t.titulo}</span>
                                    <span className="block text-[11px] text-slate-400 dark:text-slate-400">{t.asignado_nombre || 'Sin asignar'}</span>
                                  </span>
                                  <span className={`shrink-0 text-xs font-black ${urgente ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `${dias} d`}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------------- TABLERO ---------------- */}
          {vista === 'tablero' && (
            <div className="ev-view flex-1 flex flex-col min-h-0">
              <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl flex flex-wrap items-center gap-2">
                <div className="ev-field relative flex-1 min-w-[180px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400 pointer-events-none">
                    <Icono nombre="buscar" className="w-4 h-4" />
                  </span>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar tareas..."
                    aria-label="Buscar tareas"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Chip
                    activo={filtroPrioridad === 'todas' && filtroMiembro === 'todos' && !filtroFecha && !busqueda}
                    onClick={limpiarFiltros}
                    ariaLabel="Sin filtros"
                  >
                    Todas
                  </Chip>

                  {/* Chip del filtro por fecha: lo inyecta el calendario y
                      es la unica forma visible de loosen, porque el tablero
                      no muestra ningun otro rastro de que esta filtrado. */}
                  {filtroFecha && (
                    <button
                      type="button"
                      onClick={() => setFiltroFecha('')}
                      aria-pressed="true"
                      aria-label="Quitar el filtro de fecha"
                      className="ev-chip ev-focusable inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      <Icono nombre="reloj" className="w-3 h-3" />
                      {new Date(`${filtroFecha}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                      <Icono nombre="cerrar" className="w-3 h-3" />
                    </button>
                  )}
                  {metricas.vencidas > 0 && (
                    <Chip activo={filtroPrioridad === 'vencidas'} onClick={alternarVencidas} ariaLabel={`Mostrar solo tareas vencidas, ${metricas.vencidas} en total`}>
                      <Icono nombre="alerta" className="w-3 h-3" />
                      Vencidas ({metricas.vencidas})
                    </Chip>
                  )}
                  {Object.entries(PRIORIDADES).map(([clave, p]) => (
                    <Chip key={clave} activo={filtroPrioridad === clave} onClick={() => setFiltroPrioridad(filtroPrioridad === clave ? 'todas' : clave)} ariaLabel={`Filtrar por ${p.label}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </Chip>
                  ))}
                  <select
                    value={filtroMiembro}
                    onChange={(e) => setFiltroMiembro(e.target.value)}
                    aria-label="Filtrar por miembro"
                    className="ev-focusable text-xs font-bold px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="todos">Todos los miembros</option>
                    <option value="sin_asignar">Sin asignar</option>
                    {miembros.map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex-1 flex gap-3 sm:gap-4 p-4 sm:p-6 overflow-x-auto">
                {ORDEN_ESTADOS.map((key) => {
                  const est = ESTADOS[key];
                  const lista = tareasFiltradas.filter((t) => t.estado === key);
                  const sobre = columnaSobre === key;
                  // Cada columna muestra su avance sobre el total del equipo
                  const avance = pct(lista.length, metricas.total);
                  return (
                    <section
                      key={key}
                      onDragEnter={() => setColumnaSobre(key)}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDragLeave={(e) => {
                        // relatedTarget es el elemento al que se entra. Si
                        // sigue dentro de la columna, el evento se disparo
                        // por cruzar un hijo y no hay que apagar nada.
                        // relatedTarget llega como null al salir de la ventana.
                        if (e.currentTarget.contains(e.relatedTarget)) return;
                        setColumnaSobre((prev) => (prev === key ? null : prev));
                      }}
                      onDrop={(e) => handleDrop(e, key)}
                      className={`ev-columna flex-1 min-w-[264px] rounded-2xl ${est.bg} p-3 flex flex-col ${sobre ? 'ev-columna-sobre' : ''}`}
                    >
                      <div className="mb-3 px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: est.punto }} aria-hidden="true" />
                          <h2 className={`font-extrabold text-sm ${est.text}`}>{est.label}</h2>
                          <span className="ml-auto text-xs font-black text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full">{lista.length}</span>
                        </div>
                        <div className="mt-2 ev-progress-mini" role="img" aria-label={`${est.label}: ${avance}% del total`}>
                          <div className="ev-progress-mini-fill" style={{ width: `${avance}%`, backgroundColor: est.punto }} />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[120px]">
                        {lista.length === 0 ? (
                          <p className="text-center py-8 text-xs font-semibold text-slate-400 dark:text-slate-400">Arrastra tareas aquí</p>
                        ) : (
                          lista.map((t) => (
                            <TaskCard
                              key={t.tarea_id}
                              tarea={t}
                              prioridades={PRIORIDADES}
                              ordenEstados={ORDEN_ESTADOS}
                              estados={ESTADOS}
                              getDiasRestantes={getDiasRestantes}
                              tonoDesdeNombre={tonoDesdeNombre}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onAbrir={abrirEditorTarea}
                              onEliminar={setTareaAEliminar}
                              onMover={moverTarea}
                            />
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>

          {/* ---------------- CHAT: panel fijo derecho ---------------- */}
        <aside
          className={`ev-panel-glass shrink-0 border-l border-slate-200/70 dark:border-slate-700/70 flex flex-col
            ${chatMovil ? 'fixed inset-y-0 right-0 z-50 w-full max-w-sm' : 'hidden xl:flex xl:w-[340px]'}`}
          role="log"
          aria-live="polite"
          aria-label="Chat del equipo"
        >
          {/* El header se convierte en el buscador al activarlo: en 340px de
              panel no caben el título y un campo a la vez sin que uno estorbe. */}
          {buscadorAbierto ? (
            <div className="px-3 py-2.5 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center gap-2">
              <span className="text-slate-400 shrink-0 pointer-events-none">
                <Icono nombre="buscar" className="w-4 h-4" />
              </span>
              <input
                id="chat-buscar"
                type="text"
                value={busquedaChat}
                onChange={(e) => setBusquedaChat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); moverCoincidencia(e.shiftKey ? -1 : 1); }
                  if (e.key === 'ArrowDown') { e.preventDefault(); moverCoincidencia(1); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); moverCoincidencia(-1); }
                  if (e.key === 'Escape') { e.preventDefault(); cerrarBuscador(); }
                }}
                placeholder="Buscar en el chat..."
                aria-label="Buscar mensajes"
                className="flex-1 min-w-0 px-2 py-1.5 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={cerrarBuscador}
                className="ev-focusable grid place-items-center w-7 h-7 shrink-0 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Cerrar buscador"
              >
                <Icono nombre="cerrar" className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icono nombre="chat" className="w-4 h-4 text-blue-600 shrink-0" />
                <h2 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">Chat del equipo</h2>
              </div>
              <button
                type="button"
                onClick={abrirBuscador}
                className="ev-focusable grid place-items-center w-8 h-8 rounded-lg text-slate-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 transition-colors shrink-0"
                aria-label="Buscar mensajes"
                title="Buscar mensajes"
              >
                <Icono nombre="buscar" className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 shrink-0">{mensajes.length} mensajes</span>
              <button
                type="button"
                onClick={cerrarChatMovil}
                className="ev-focusable xl:hidden grid place-items-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 transition-colors shrink-0"
                aria-label="Cerrar chat"
              >
                <Icono nombre="cerrar" className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Navegación entre coincidencias */}
          {buscadorAbierto && busquedaChat.trim() && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/70 dark:border-slate-700/70 ev-burbuja">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                {totalCoincidencias === 0
                  ? 'Sin coincidencias'
                  : `${indiceSeguro + 1} de ${totalCoincidencias}`}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moverCoincidencia(-1)}
                  disabled={!totalCoincidencias}
                  className="ev-focusable grid place-items-center w-6 h-6 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Coincidencia anterior"
                >
                  <Icono nombre="volver" className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moverCoincidencia(1)}
                  disabled={!totalCoincidencias}
                  className="ev-focusable grid place-items-center w-6 h-6 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Coincidencia siguiente"
                >
                  <Icono nombre="siguiente" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* El relative vive acá y no en el <aside>: el botón flotante se
              ancla al área de mensajes, así no depende de la altura del
              composer ni de si el chat es panel fijo o drawer móvil. */}
          <div className="relative flex-1 min-h-0">
          <div ref={chatRef} className="h-full overflow-y-auto p-4 space-y-3" onScroll={handleChatScroll}>
            {mensajes.length === 0 ? (
              <div className="h-full grid place-items-center text-center">
                <div>
                  <img
                    src="/Imagenes_Diseño/mascota_mirando_web.png"
                    alt=""
                    aria-hidden="true"
                    className="mx-auto w-24 h-auto object-contain drop-shadow-sm"
                  />
                  <p className="mt-3 font-bold text-slate-700 dark:text-slate-300">Sin mensajes todavía</p>
                  <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">Escribe el primero para coordinar al equipo.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Indicador de carga de mensajes antiguos */}
                {cargandoAnteriores && (
                  <div key="loading-older" className="flex justify-center py-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400">
                      <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Cargando mensajes anteriores…
                    </div>
                  </div>
                )}
                {/* Fin del historial */}
                {sinMasMensajes && !cargandoAnteriores && (
                  <div key="no-more" className="text-center py-2">
                    <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">
                      Ese es el primer mensaje del equipo
                    </p>
                  </div>
                )}
                {mensajes.map((msg, i) => {
                const mio = String(msg.usuario_id) === String(usuario);
                const previo = mensajes[i - 1];
                // Agrupa mensajes consecutivos del mismo autor
                const agrupado = previo && String(previo.usuario_id) === String(msg.usuario_id);

                // Separador de día: muestra la fecha cuando cambia el día
                const fechaMsg = new Date(msg.fecha_envio);
                const fechaStr = fechaMsg.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                const fechaPrev = previo ? new Date(previo.fecha_envio) : null;
                const mismaFecha = fechaPrev && fechaMsg.toDateString() === fechaPrev.toDateString();
                const mostrarSeparador = !mismaFecha;

                const keyMsg = msg.mensaje_id || `msg-${i}`;

                // Posición de este mensaje dentro de la lista de
                // coincidencias, o -1. Solo una coincide a la vez; el
                // resaltado se actualiza solo porque la lista cambia
                // cuando cambia la consulta.
                const posCoincidencia = busquedaChat.trim()
                  ? coincidencias.indexOf(i)
                  : -1;

                // Foto del autor, ya normalizada. null = toca iniciales.
                const fotoAutor = urlFoto(msg.autor_foto);

                return (
                  <React.Fragment key={keyMsg}>
                    {mostrarSeparador && (
                      <div key={`sep-${i}`} className="flex items-center gap-2 my-2 text-center">
                        <div className="flex-1 border-t border-slate-200/50 dark:border-slate-700/50" />
                        <span className="px-2 text-xs font-medium text-slate-400 dark:text-slate-400 whitespace-nowrap">
                          {fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1)}
                        </span>
                        <div className="flex-1 border-t border-slate-200/50 dark:border-slate-700/50" />
                      </div>
                    )}
                    <div
                      data-msg-id={msg.mensaje_id}
                      className={`group flex gap-2.5 ${mio ? 'justify-end' : 'justify-start'}`}
                      onContextMenu={(e) => abrirMenuResponder(e, msg)}
                    >
                      {!mio && (
                        <span className={`ev-avatar relative grid place-items-center w-8 h-8 rounded-full text-white text-xs font-bold shrink-0 overflow-hidden ${agrupado ? 'opacity-0' : `bg-gradient-to-br ${tonoDesdeNombre(msg.autor_nombre)}`}`}>
                          {/* Foto si hay; si la URL está rota (varias filas de
                              usuarios apuntan a default-avatar.png, que no
                              existe) el onError destapa las iniciales de abajo. */}
                          {fotoAutor && (
                            <img
                              src={fotoAutor}
                              alt=""
                              aria-hidden="true"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          )}
                          <span className="relative">{(msg.autor_nombre || '?').charAt(0).toUpperCase()}</span>
                        </span>
                      )}
                      <div className={`max-w-[85%] relative ${agrupado ? '' : 'ev-burbuja'}`}>
                        {!mio && !agrupado && (
                          <p className="text-xs font-bold text-blue-600 mb-1">{msg.autor_nombre}</p>
                        )}
                        <div className={`px-3.5 py-2.5 rounded-2xl ${mio ? 'bg-blue-600 hover:bg-blue-700 text-white rounded-br-md' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-md'}`}>
                          {/* Acciones sobre la burbuja. Van sobre la esquina en vez de como
                              hermanos del flex: el panel es de 340px y sumarle
                              el ancho del avatar lo desbordaba. En escritorio
                              solo aparecen al hover; en móvil siempre, porque
                              no hay hover. */}
                          <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                            {soyAdminEquipo && (
                              <button
                                type="button"
                                onClick={() => setMensajeABorrar(msg)}
                                className="ev-focusable grid place-items-center w-7 h-7 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 border border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md transition-all xl:opacity-0 xl:scale-90 xl:group-hover:opacity-100 xl:group-hover:scale-100"
                                aria-label={`Borrar el mensaje de ${msg.autor_nombre || 'este usuario'}`}
                                title="Borrar mensaje"
                              >
                                <Icono nombre="basura" className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => iniciarRespuesta(msg)}
                              className="ev-focusable grid place-items-center w-7 h-7 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-600 border border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md transition-all xl:opacity-0 xl:scale-90 xl:group-hover:opacity-100 xl:group-hover:scale-100"
                              aria-label={`Responder a ${msg.autor_nombre || 'este mensaje'}`}
                              title="Responder"
                            >
                              <Icono nombre="responder" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Cita del mensaje original, si esta es una respuesta */}
                          {msg.respuesta_a && (
                            <button
                              type="button"
                              onClick={() => irAlMensaje(msg.respuesta_a)}
                              className={`ev-focusable block w-full text-left mb-1.5 py-1.5 pl-2.5 pr-2 rounded-lg border-l-[3px] transition-colors ${
                                mio
                                  ? 'bg-white/15 border-white/60 hover:bg-white/25'
                                  : 'bg-slate-50 dark:bg-slate-800/60 border-blue-400 dark:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <p className={`text-[11px] font-bold truncate ${mio ? 'text-white' : 'text-blue-600 dark:text-blue-300'}`}>
                                {msg.respuesta_autor_nombre || 'Mensaje eliminado'}
                              </p>
                              <p className={`text-xs truncate ${mio ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                {/* El buscador también mira el texto citado, así que
                                    se resalta igual que el cuerpo del mensaje. */}
                                {msg.respuesta_texto
                                  ? resaltar(msg.respuesta_texto, posCoincidencia === indiceSeguro ? 0 : -1)
                                  : 'Mensaje eliminado'}
                              </p>
                            </button>
                          )}
                          <p className="text-sm leading-relaxed break-words">
                            {/* En el mensaje activo se pinta la primera
                                coincidencia en naranja; `resaltar` cuenta
                                por mensaje, no globalmente. */}
                            {posCoincidencia >= 0
                              ? resaltar(msg.texto, posCoincidencia === indiceSeguro ? 0 : -1)
                              : msg.texto}
                          </p>
                        </div>
                        <p className={`mt-1 text-[10px] text-slate-400 dark:text-slate-400 ${mio ? 'text-right' : ''}`}>
                          {fechaMsg.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </>          )}
          </div>

          {/* Botón "ir al final": oculto cuando ya estás en el último mensaje,
              visible al subir. Antes se anclaba con absolute al viewport
              porque ningún ancestro tenía position: relative. */}
          {mostrarBotonChat && (
            <button
              type="button"
              onClick={irAlFinalChat}
              className="ev-scroll-abajo ev-focusable absolute bottom-3 right-3 z-10 flex items-center gap-1.5 pl-2.5 pr-3 py-2 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-lg shadow-blue-600/40 transition-transform"
              aria-label={nuevosSinVer > 0 ? `Ir al último mensaje (${nuevosSinVer} sin ver)` : 'Ir al último mensaje'}
            >
              <Icono nombre="abajo" className="w-4 h-4" />
              {nuevosSinVer > 0 && <span className="text-xs font-bold tabular-nums">{nuevosSinVer}</span>}
            </button>
          )}
          </div>

          {/* Vista previa de la respuesta, sobre el input (como WhatsApp) */}
          {respondiendoA && (
            <div className="flex items-start gap-2.5 mx-3 mb-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 ev-burbuja">
              <Icono nombre="responder" className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
              <button
                type="button"
                onClick={() => irAlMensaje(respondiendoA.mensaje_id)}
                className="flex-1 min-w-0 text-left ev-focusable"
              >
                <p className="text-[11px] font-bold text-blue-600 dark:text-blue-300 truncate">
                  Respondiendo a {respondiendoA.autor_nombre || '—'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{respondiendoA.texto}</p>
              </button>
              <button
                type="button"
                onClick={cancelarRespuesta}
                className="ev-focusable grid place-items-center w-6 h-6 shrink-0 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Cancelar respuesta"
              >
                <Icono nombre="cerrar" className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="p-3 border-t border-slate-200/70 dark:border-slate-700/70 pt-0">
            <div className="flex gap-2">
              <input
                id="chat-input"
                type="text"
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') enviarMensaje(); }}
                placeholder={respondiendoA ? `Respondiendo a ${respondiendoA.autor_nombre || '...'}` : 'Escribe un mensaje...'}
                aria-label="Mensaje de chat"
                maxLength={500}
                className="ev-field flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={enviarMensaje}
                disabled={!nuevoMensaje.trim()}
                aria-label="Enviar mensaje"
                className="ev-btn ev-focusable grid place-items-center w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icono nombre="enviar" className="w-4 h-4" />
              </button>
            </div>

            {/* Zona destructiva, separada de las acciones del día a día.
                Enlace y no botón/icono: a 340px un icono de papelera junto
                al buscador se pulsaría por accidente. */}
            {soyAdminEquipo && mensajes.length > 0 && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => setModalVaciar(true)}
                  className="ev-focusable text-[11px] font-semibold text-red-500/80 hover:text-red-600 dark:text-red-400/80 dark:hover:text-red-300 hover:underline transition-colors"
                >
                  Vaciar chat del equipo
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Menú contextual de "Responder" (clic derecho sobre un mensaje).
            Va fuera del <aside> para poder posicionarse en coordenadas de
            pantalla y no quedar recortado por el panel. */}
      {menuResponder && (
        <div
          className="fixed z-[60] ev-menu-chat"
          style={{ left: menuResponder.x, top: menuResponder.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => iniciarRespuesta(menuResponder.msg)}
            className="ev-focusable flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Icono nombre="responder" className="w-4 h-4 text-blue-500" />
            Responder
          </button>
        </div>
      )}
      </div>

      {/* ---------------- MODAL CREAR TAREA ---------------- */}
      {showCrearTarea && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center p-4 z-50 ev-overlay" onClick={() => setShowCrearTarea(false)}>
          <div className="ev-panel-glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ev-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200/70 dark:border-slate-700/70 sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-t-2xl z-10">
              <h2 className="font-extrabold text-slate-900 dark:text-slate-100">Nueva tarea</h2>
              <button type="button" onClick={() => setShowCrearTarea(false)} className="ev-focusable grid place-items-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Cerrar">
                <Icono nombre="cerrar" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="nueva-titulo" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Título</label>
                <input
                  id="nueva-titulo"
                  type="text"
                  value={nuevaTarea.titulo}
                  onChange={(e) => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })}
                  placeholder="¿Qué hay que hacer?"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label htmlFor="nueva-desc" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Descripción <span className="font-normal text-slate-400 dark:text-slate-400">(opcional)</span></label>
                <textarea
                  id="nueva-desc"
                  value={nuevaTarea.descripcion}
                  onChange={(e) => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 resize-none"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nueva-fecha" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Fecha de entrega</label>
                  <input
                    id="nueva-fecha"
                    type="date"
                    value={nuevaTarea.fecha_entrega}
                    onChange={(e) => {
                      const fecha = e.target.value;
                      const dias = getDiasRestantes(fecha);
                      // La prioridad se sugiere segun la fecha, el usuario puede cambiarla
                      const prioridad = dias === null ? 'verde' : dias <= 2 ? 'rojo' : dias <= 5 ? 'amarillo' : 'verde';
                      setNuevaTarea((prev) => ({ ...prev, prioridad, fecha_entrega: fecha }));
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="nueva-asignado" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Asignar a</label>
                  <select
                    id="nueva-asignado"
                    value={nuevaTarea.asignado_a}
                    onChange={(e) => setNuevaTarea({ ...nuevaTarea, asignado_a: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Prioridad</span>
                <div className="flex gap-2">
                  {Object.entries(PRIORIDADES).map(([clave, p]) => (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => setNuevaTarea({ ...nuevaTarea, prioridad: clave })}
                      aria-pressed={nuevaTarea.prioridad === clave}
                      className={`ev-chip ev-focusable flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border ${
                        nuevaTarea.prioridad === clave ? `${p.bg} ${p.text} border-current` : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200/70 dark:border-slate-700/70 flex gap-3 sticky bottom-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-b-2xl">
              <button type="button" onClick={() => setShowCrearTarea(false)} className="ev-focusable flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 transition-colors">Cancelar</button>
              <button type="button" onClick={crearTarea} className="ev-btn ev-focusable flex-1 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white">Crear tarea</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL EDITAR TAREA ---------------- */}
      {tareaEditando && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center p-4 z-50 ev-overlay" onClick={cerrarEditorTarea}>
          <div className="ev-panel-glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ev-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200/70 dark:border-slate-700/70 sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-t-2xl z-10">
              <h2 className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Icono nombre="editar" className="w-4 h-4" />
                Editar tarea
              </h2>
              <button type="button" onClick={cerrarEditorTarea} className="ev-focusable grid place-items-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Cerrar">
                <Icono nombre="cerrar" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="edit-titulo" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Título</label>
                <input
                  id="edit-titulo"
                  type="text"
                  value={tareaEditForm.titulo}
                  onChange={(e) => setTareaEditForm({ ...tareaEditForm, titulo: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label htmlFor="edit-desc" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Descripción</label>
                <textarea
                  id="edit-desc"
                  value={tareaEditForm.descripcion}
                  onChange={(e) => setTareaEditForm({ ...tareaEditForm, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 resize-none"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-fecha" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Fecha de entrega</label>
                  <input
                    id="edit-fecha"
                    type="date"
                    value={tareaEditForm.fecha_entrega}
                    onChange={(e) => setTareaEditForm({ ...tareaEditForm, fecha_entrega: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="edit-asignado" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Asignar a</label>
                  <select
                    id="edit-asignado"
                    value={tareaEditForm.asignado_a}
                    onChange={(e) => setTareaEditForm({ ...tareaEditForm, asignado_a: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Estado</span>
                <div className="flex gap-2">
                  {ORDEN_ESTADOS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTareaEditForm({ ...tareaEditForm, estado: key })}
                      aria-pressed={tareaEditForm.estado === key}
                      className={`ev-chip ev-focusable flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border ${
                        tareaEditForm.estado === key ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {ESTADOS[key].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Prioridad</span>
                <div className="flex gap-2">
                  {Object.entries(PRIORIDADES).map(([clave, p]) => (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => setTareaEditForm({ ...tareaEditForm, prioridad: clave })}
                      aria-pressed={tareaEditForm.prioridad === clave}
                      className={`ev-chip ev-focusable flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border ${
                        tareaEditForm.prioridad === clave ? `${p.bg} ${p.text} border-current` : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200/70 dark:border-slate-700/70 pt-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Comentarios ({comentariosTarea.length})</h3>
                <div className="max-h-44 overflow-y-auto space-y-2 mb-3 pr-1">
                  {comentariosTarea.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-400">Sin comentarios todavía.</p>
                  ) : (
                    comentariosTarea.map((c) => {
                      const mio = String(c.usuario_id) === String(usuario);
                      return (
                        <div key={c.comentario_id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mio ? 'bg-blue-600 hover:bg-blue-700 text-white rounded-br-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'}`}>
                            {!mio && <p className="text-[10px] font-bold text-blue-600 mb-0.5">{c.autor_nombre}</p>}
                            <p className="text-xs leading-relaxed break-words">{c.texto}</p>
                            <p className={`text-[9px] mt-1 ${mio ? 'text-blue-200' : 'text-slate-400 dark:text-slate-400'}`}>
                              {new Date(c.fecha).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') agregarComentario(); }}
                    placeholder="Escribe un comentario..."
                    aria-label="Comentario de la tarea"
                    className="ev-field flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  />
                  <button type="button" onClick={agregarComentario} disabled={!nuevoComentario.trim()} aria-label="Enviar comentario" className="ev-btn ev-focusable grid place-items-center w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0 disabled:opacity-50">
                    <Icono nombre="enviar" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200/70 dark:border-slate-700/70 flex gap-3 sticky bottom-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-b-2xl">
              <button type="button" onClick={cerrarEditorTarea} className="ev-focusable flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 transition-colors">Cancelar</button>
              <button type="button" onClick={guardarEdicionTarea} className="ev-btn ev-focusable flex-1 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white">Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL ELIMINAR TAREA ---------------- */}
      {tareaAEliminar && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center p-4 z-50 ev-overlay" onClick={() => setTareaAEliminar(null)}>
          <div className="ev-panel-glass rounded-2xl w-full max-w-sm p-6 ev-modal" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-red-50 text-red-500">
              <Icono nombre="basura" className="w-6 h-6" />
            </span>
            <h2 className="mt-4 text-center font-extrabold text-slate-900 dark:text-slate-100 text-lg">Eliminar tarea</h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              ¿Seguro que quieres eliminar <span className="font-bold text-slate-700 dark:text-slate-300">"{tareaAEliminar.titulo}"</span>?
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setTareaAEliminar(null)} className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 transition-colors">Cancelar</button>
              <button type="button" onClick={() => { eliminarTarea(tareaAEliminar.tarea_id); setTareaAEliminar(null); }} className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- CONFIRMAR BORRADO DE MENSAJE ---------------- */}
      {mensajeABorrar && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center p-4 z-50 ev-overlay" onClick={() => setMensajeABorrar(null)}>
          <div className="ev-panel-glass rounded-2xl w-full max-w-sm p-6 ev-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label="Confirmar borrado de mensaje">
            <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-500">
              <Icono nombre="basura" className="w-6 h-6" />
            </span>
            <h2 className="mt-4 text-center font-extrabold text-slate-900 dark:text-slate-100 text-lg">Borrar mensaje</h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              ¿Seguro que quieres borrar el mensaje de{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{mensajeABorrar.autor_nombre || 'este usuario'}</span>?
            </p>
            <div className="mt-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 max-h-24 overflow-y-auto">
              <p className="text-xs text-slate-600 dark:text-slate-300 break-words">{mensajeABorrar.texto}</p>
            </div>
            <p className="mt-3 text-center text-xs text-red-600 dark:text-red-400 font-semibold">
              Desaparece para todos y no se puede deshacer.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setMensajeABorrar(null)} className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 transition-colors">Cancelar</button>
              <button type="button" onClick={confirmarBorrar} className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors">Borrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- VACIAR HISTORIAL DEL EQUIPO ---------------- */}
      {modalVaciar && (
        <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50 ev-overlay" onClick={cerrarModalVaciar}>
          <div
            className="ev-panel-glass rounded-2xl w-full max-w-sm p-6 ev-modal"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-vaciar"
          >
            <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-500">
              <Icono nombre="basura" className="w-6 h-6" />
            </span>
            <h2 id="titulo-vaciar" className="mt-4 text-center font-extrabold text-slate-900 dark:text-slate-100 text-lg">
              Vaciar el chat de {equipoActivo?.nombre}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              Se borrarán los <span className="font-bold text-slate-700 dark:text-slate-300">{mensajes.length} mensajes</span> del historial
              {' '}para <span className="font-bold text-slate-700 dark:text-slate-300">todos los miembros</span>, incluidos los que no has cargado aún.
            </p>
            <p className="mt-3 text-center text-xs text-red-600 dark:text-red-400 font-semibold">
              Esta acción no se puede deshacer.
            </p>

            <label className="block mt-5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">
              Escribe <span className="font-black text-red-600 dark:text-red-400">BORRAR</span> para confirmar
            </label>
            <input
              type="text"
              value={confirmacionVaciar}
              onChange={(e) => setConfirmacionVaciar(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && confirmacionVaciar.trim().toUpperCase() === 'BORRAR') vaciarHistorial(); }}
              placeholder="BORRAR"
              aria-label="Escribe BORRAR para confirmar"
              autoComplete="off"
              className="ev-field w-full mt-2 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center text-sm font-bold tracking-widest outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20"
            />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={cerrarModalVaciar}
                className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={vaciarHistorial}
                disabled={confirmacionVaciar.trim().toUpperCase() !== 'BORRAR'}
                className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600 transition-colors"
              >
                Vaciar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SALIR DEL EQUIPO ---------------- */}
      {modalSalirEquipo && (
        <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50 ev-overlay" onClick={() => setModalSalirEquipo(false)}>
          <div
            className="ev-panel-glass rounded-2xl w-full max-w-sm p-6 ev-modal"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-salir-equipo"
          >
            <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-500">
              <Icono nombre="salir" className="w-6 h-6" />
            </span>
            <h2 id="titulo-salir-equipo" className="mt-4 text-center font-extrabold text-slate-900 dark:text-slate-100 text-lg">
              Salir de {equipoActivo?.nombre}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              Perderás acceso al chat, las tareas y los archivos del equipo.
            </p>
            <p className="mt-3 text-center text-xs text-red-600 dark:text-red-400 font-semibold">
              {soyAdminEquipo
                ? miembros.length === 1
                  ? 'Eres el último miembro: el equipo se eliminará.'
                  : 'Eres administrador: el rol pasará a otro miembro.'
                : 'Esta acción no se puede deshacer.'}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setModalSalirEquipo(false)}
                className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={abandonarEquipo}
                className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- EXPULSAR MIEMBRO ---------------- */}
      {miembroAExpulsar && (
        <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50 ev-overlay" onClick={() => setMiembroAExpulsar(null)}>
          <div
            className="ev-panel-glass rounded-2xl w-full max-w-sm p-6 ev-modal"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-expulsar"
          >
            <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-500">
              <Icono nombre="cerrar" className="w-6 h-6" />
            </span>
            <h2 id="titulo-expulsar" className="mt-4 text-center font-extrabold text-slate-900 dark:text-slate-100 text-lg">
              Expulsar a {miembroAExpulsar.nombre}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              Dejará de ser miembro de <span className="font-bold text-slate-700 dark:text-slate-300">{equipoActivo?.nombre}</span> y perderá acceso al chat y a las tareas.
            </p>
            <p className="mt-3 text-center text-xs text-red-600 dark:text-red-400 font-semibold">
              Para volver tendrá que unirse con el código de invitación.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setMiembroAExpulsar(null)}
                className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={expulsarMiembro}
                className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Expulsar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestorEquipos;
