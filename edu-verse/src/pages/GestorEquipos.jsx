import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

// Resumen global del selector de equipos. El backend no expone un endpoint
// agregado, asi que las tareas de cada equipo se traen en paralelo y se
// aplanan por equipo_id para poder derivar las metricas de abajo.
const ETIQUETA_ROL = { admin: 'Administrador', miembro: 'Miembro' };

const PRIORIDADES = {
  verde: { label: 'No urgente', color: '#22c55e', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  amarillo: { label: 'Urgente', color: '#eab308', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  rojo: { label: 'Pocos días', color: '#ef4444', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
};

const ESTADOS = {
  pendiente: { label: 'Pendiente', icon: 'clipboard', bg: 'bg-blue-50', text: 'text-blue-700', punto: '#3b82f6' },
  en_progreso: { label: 'En progreso', icon: 'spinner', bg: 'bg-indigo-50', text: 'text-indigo-700', punto: '#6366f1' },
  completada: { label: 'Completada', icon: 'check', bg: 'bg-emerald-50', text: 'text-emerald-700', punto: '#10b981' },
};

const ORDEN_ESTADOS = ['pendiente', 'en_progreso', 'completada'];

const INTERVALO_FRASE_HERO = 4500;

// Frases del hero: rotan en la burbuja sobre la ilustracion del equipo.
const FRASES_HERO = ['¡Juntos rendimos más! ', 'Reparte y avanza en equipo ', '¡Nunca estudies solo! ', 'Tareas claras, equipo fuerte '];

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

const StatCard = ({ etiqueta, valor, detalle, icono, gradiente, anillo, delay }) => (
  <article className={`ev-stat ev-panel-glass rounded-2xl p-5 ev-enter ${delay || ''}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-500">{etiqueta}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{valor}</p>
        {detalle && <p className="mt-1 text-xs font-medium text-slate-400">{detalle}</p>}
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
      <div className="ev-donut h-40 w-40 grid place-items-center" style={{ background: 'conic-gradient(rgba(226,232,240,0.7) 0deg 360deg)' }}>
        <div className="ev-donut-hueco h-28 w-28 grid place-items-center">
          <span className="text-xs font-semibold text-slate-400">Sin datos</span>
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
          <p className="text-2xl font-extrabold text-slate-900">{total}</p>
          <p className="text-[11px] font-semibold text-slate-400">tareas</p>
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
      activo ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white/80 text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
    }`}
  >
    {children}
  </button>
);

const GestorEquipos = () => {
  const socketRef = useRef(null);
  const chatRef = useRef(null);
  const chatAbiertoRef = useRef(false);
  const tareaEditandoRef = useRef(null);
  const rafRef = useRef(0);
  // Contador de dragenter/dragleave: sin el, el highlight parpadea
  // porque ambos eventos se disparan al cruzar elementos hijos.
  const contadorDrag = useRef(0);

  // Hero del selector de equipos: la frase rota sola y el glow sigue al mouse.
  const heroRef = useRef(null);
  const heroGlowRef = useRef(null);
  const heroRafRef = useRef(0);
  const [fraseHeroIdx, setFraseHeroIdx] = useState(0);
  const [tareasPorEquipo, setTareasPorEquipo] = useState({});

  // Cifras del dashboard. Se guardan aparte del valor final porque las
  // animaciones de conteo necesitan mutarlas por frame.
  const [cifras, setCifras] = useState({ equipos: 0, tareas: 0, completadas: 0, vencidas: 0, tasa: 0 });
  const cifrasRafRef = useRef(0);

  const usuario = getUsuarioId();
  const usuarioNombre = localStorage.getItem('usuario');

  const [equipos, setEquipos] = useState([]);
  const [equipoActivo, setEquipoActivo] = useState(null);
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
  const [sidebarMovil, setSidebarMovil] = useState(false);
  // En pantallas grandes el chat siempre esta visible; en chica es un drawer
  const [chatMovil, setChatMovil] = useState(false);

  const [nuevaTarea, setNuevaTarea] = useState({ titulo: '', descripcion: '', prioridad: 'verde', fecha_entrega: '', asignado_a: '' });
  const [tareaAEliminar, setTareaAEliminar] = useState(null);
  const [tareaEditando, setTareaEditando] = useState(null);
  const [tareaEditForm, setTareaEditForm] = useState({ titulo: '', descripcion: '', prioridad: 'verde', fecha_entrega: '', asignado_a: '', estado: 'pendiente' });
  const [comentariosTarea, setComentariosTarea] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');

  const [draggedTask, setDraggedTask] = useState(null);
  const [columnaSobre, setColumnaSobre] = useState(null);
  const [filtroPrioridad, setFiltroPrioridad] = useState('todas');
  const [filtroMiembro, setFiltroMiembro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  /* ---------------- datos ---------------- */

  const cargarEquipos = useCallback(async () => {
    if (!usuario) return;
    try {
      const res = await axios.get(`${API_URL}/equipos/mis-equipos/${usuario}`);
      setEquipos(res.data);
    } catch {
      // silencioso: la vista de equipos ya muestra el empty state
    }
  }, [usuario]);

  const cargarTareas = useCallback(async (equipoId) => {
    try {
      setTareas((await axios.get(`${API_URL}/tareas/equipo/${equipoId}`)).data);
    } catch {
      // silencioso
    }
  }, []);

  const cargarMiembros = useCallback(async (equipoId) => {
    try {
      setMiembros((await axios.get(`${API_URL}/equipos/${equipoId}/miembros`)).data);
    } catch {
      // silencioso
    }
  }, []);

  const cargarMensajes = useCallback(async (equipoId) => {
    try {
      setMensajes((await axios.get(`${API_URL}/chat/${equipoId}`)).data);
    } catch {
      // silencioso
    }
  }, []);

  const cargarComentariosTarea = useCallback(async (tareaId) => {
    try {
      setComentariosTarea((await axios.get(`${API_URL}/tareas/${tareaId}/comentarios`)).data);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    cargarEquipos();
  }, [cargarEquipos]);

  /* ---------------- realtime ---------------- */

  useEffect(() => {
    const socket = io(API_URL);
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
      setMensajes((prev) => [...prev, msg]);
      if (!chatAbiertoRef.current) setMensajesNoLeidos((prev) => prev + 1);
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [mensajes]);

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
            const res = await axios.get(`${API_URL}/tareas/equipo/${eq.equipo_id}`);
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
      if (q && !`${t.titulo} ${t.descripcion || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tareas, filtroPrioridad, filtroMiembro, busqueda]);

  /* ---------------- acciones ---------------- */

  const alternarVencidas = () => {
    setFiltroPrioridad((prev) => (prev === 'vencidas' ? 'todas' : 'vencidas'));
  };

  const limpiarFiltros = () => {
    setFiltroPrioridad('todas');
    setFiltroMiembro('todos');
    setBusqueda('');
  };

  // El ref lo lee el listener del socket. El chat ya no es un tab: esta
  // siempre montado en escritorio y es un drawer en movil, asi que solo
  // cuenta como "no leido" cuando el drawer esta cerrado.
  const abrirChatMovil = () => {
    chatAbiertoRef.current = true;
    setMensajesNoLeidos(0);
    setChatMovil(true);
  };

  const cerrarChatMovil = () => {
    chatAbiertoRef.current = false;
    setChatMovil(false);
  };

  const cambiarVista = (siguiente) => {
    setVista(siguiente);
  };

  const seleccionarEquipo = async (equipo) => {
    if (socketRef.current && equipoActivo) socketRef.current.emit('salir-equipo', equipoActivo.equipo_id);
    setEquipoActivo(equipo);
    chatAbiertoRef.current = false;
    setMensajesNoLeidos(0);
    setFiltroPrioridad('todas');
    setFiltroMiembro('todos');
    setBusqueda('');
    socketRef.current?.emit('unirse-equipo', equipo.equipo_id);
    await Promise.all([
      cargarTareas(equipo.equipo_id),
      cargarMiembros(equipo.equipo_id),
      cargarMensajes(equipo.equipo_id),
    ]);
  };

  const salirDeEquipo = () => {
    socketRef.current?.emit('salir-equipo', equipoActivo.equipo_id);
    setEquipoActivo(null);
    setTareas([]);
    setMensajes([]);
    setMiembros([]);
    chatAbiertoRef.current = false;
    setMensajesNoLeidos(0);
    setSidebarMovil(false);
    setVista('dashboard');
  };

  const getToastMsg = (err) => {
    const data = err?.response?.data;
    if (typeof data === 'string') return data;
    if (data?.mensaje) return data.mensaje;
    return 'Ocurrió un error';
  };

  const crearEquipo = async () => {
    if (!nombreEquipo.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/equipos/crear`, { nombre: nombreEquipo, usuario_id: usuario });
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
      const res = await axios.post(`${API_URL}/equipos/unirse`, { codigo: codigoUnirse.toUpperCase(), usuario_id: usuario });
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
      const res = await axios.post(`${API_URL}/tareas/crear`, {
        equipo_id: equipoActivo.equipo_id,
        titulo: nuevaTarea.titulo,
        descripcion: nuevaTarea.descripcion,
        prioridad: nuevaTarea.prioridad,
        fecha_entrega: nuevaTarea.fecha_entrega || null,
        asignado_a: nuevaTarea.asignado_a || null,
        creado_por: usuario,
      });
      setTareas((prev) => [res.data.tarea, ...prev]);
      socketRef.current?.emit('nueva-tarea', { equipo_id: equipoActivo.equipo_id, tarea: res.data.tarea });
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
      const res = await axios.put(`${API_URL}/tareas/${tareaId}/mover`, { estado: nuevoEstado });
      setTareas((prev) => prev.map((t) => (t.tarea_id === tareaId ? res.data.tarea : t)));
      socketRef.current?.emit('mover-tarea', { equipo_id: equipoActivo.equipo_id, tarea: res.data.tarea });
    } catch {
      setTareas((prev) => prev.map((t) => (t.tarea_id === tareaId ? tarea : t)));
      toast.error('No se pudo mover la tarea');
    }
  };

  const eliminarTarea = async (tareaId) => {
    try {
      await axios.delete(`${API_URL}/tareas/${tareaId}`);
      socketRef.current?.emit('eliminar-tarea', { equipo_id: equipoActivo.equipo_id, tarea_id: tareaId });
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
      const res = await axios.post(`${API_URL}/tareas/${tareaEditando.tarea_id}/comentarios`, { texto: nuevoComentario });
      socketRef.current?.emit('comentario-tarea', {
        equipo_id: equipoActivo.equipo_id,
        tarea_id: tareaEditando.tarea_id,
        comentario: res.data,
      });
      setNuevoComentario('');
    } catch {
      toast.error('Error al enviar comentario');
    }
  };

  const guardarEdicionTarea = async () => {
    if (!tareaEditForm.titulo.trim()) return;
    try {
      const res = await axios.put(`${API_URL}/tareas/${tareaEditando.tarea_id}`, {
        titulo: tareaEditForm.titulo,
        descripcion: tareaEditForm.descripcion,
        prioridad: tareaEditForm.prioridad,
        fecha_entrega: tareaEditForm.fecha_entrega || null,
        asignado_a: tareaEditForm.asignado_a || null,
        estado: tareaEditForm.estado || tareaEditando.estado,
      });
      socketRef.current?.emit('editar-tarea', { equipo_id: equipoActivo.equipo_id, tarea: res.data.tarea });
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
    setNuevoMensaje('');
    try {
      await axios.post(`${API_URL}/chat/enviar`, { equipo_id: equipoActivo.equipo_id, usuario_id: usuario, texto });
      socketRef.current?.emit('mensaje-chat', {
        equipo_id: equipoActivo.equipo_id,
        usuario_id: usuario,
        autor_nombre: usuarioNombre,
        texto,
        fecha_envio: new Date().toISOString(),
      });
    } catch {
      setNuevoMensaje(texto);
      toast.error('Error al enviar');
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

  const handleDragStart = (e, tarea) => {
    setDraggedTask(tarea);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox/Chrome necesitan datos para que el drop se dispare
    e.dataTransfer.setData('text/plain', String(tarea.tarea_id));
  };

  const handleDrop = (e, estado) => {
    e.preventDefault();
    e.stopPropagation();
    contadorDrag.current = 0;
    setColumnaSobre(null);
    if (draggedTask && draggedTask.estado !== estado) moverTarea(draggedTask.tarea_id, estado);
    setDraggedTask(null);
  };

const TarjetaTarea = ({ tarea, arrastrando, onDragStart, onDragEnd, onAbrir, onEliminar, onMover }) => {
  const pri = PRIORIDADES[tarea.prioridad] || PRIORIDADES.verde;
  const dias = getDiasRestantes(tarea.fecha_entrega);

  let claseFecha = 'bg-slate-100 text-slate-600';
  let textoFecha = null;
  if (dias !== null) {
    if (dias < 0) {
      claseFecha = 'bg-red-100 text-red-700';
      textoFecha = dias === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(dias)} d`;
    } else if (dias === 0) {
      claseFecha = 'bg-red-100 text-red-700';
      textoFecha = 'Vence hoy';
    } else if (dias <= 2) {
      claseFecha = 'bg-amber-100 text-amber-800';
      textoFecha = `${dias} d`;
    } else {
      textoFecha = `${dias} d`;
    }
  }

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart(e, tarea)}
      onDragEnd={onDragEnd}
      onClick={() => onAbrir(tarea)}
      className={`ev-tarea cursor-grab active:cursor-grabbing rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm ${arrastrando ? 'ev-tarea-arrastrando' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-sm leading-snug text-slate-800 flex-1">{tarea.titulo}</h4>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEliminar(tarea); }}
          className="ev-focusable grid place-items-center w-8 h-8 -mt-1 -mr-1 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
          aria-label={`Eliminar ${tarea.titulo}`}
        >
          <Icono nombre="basura" className="w-4 h-4" />
        </button>
      </div>

      {tarea.descripcion && <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{tarea.descripcion}</p>}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${pri.bg} ${pri.text}`}>
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pri.color }} />
          {pri.label}
        </span>
        {tarea.fecha_entrega && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${claseFecha}`}>
            <Icono nombre="reloj" className="w-3 h-3" />
            {textoFecha || new Date(tarea.fecha_entrega).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {tarea.asignado_nombre && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className={`ev-avatar grid place-items-center w-5 h-5 rounded-full bg-gradient-to-br ${tonoDesdeNombre(tarea.asignado_nombre)} text-white text-[9px] font-bold`}>
            {tarea.asignado_nombre.charAt(0).toUpperCase()}
          </span>
          <span className="text-[10px] text-slate-500 font-medium truncate">{tarea.asignado_nombre}</span>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1">
        {ORDEN_ESTADOS.filter((e) => e !== tarea.estado).map((est) => (
          <button
            key={est}
            type="button"
            onClick={(e) => { e.stopPropagation(); onMover(tarea.tarea_id, est); }}
            className="ev-focusable text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            aria-label={`Mover a ${ESTADOS[est].label}`}
          >
            → {ESTADOS[est].label}
          </button>
        ))}
      </div>
    </article>
  );
};

/* ---------------- vista: selector de equipos ---------------- */

  if (!equipoActivo) {
    return (
      <div className="ev-bg-nexo min-h-[calc(100vh-64px)] font-['Fredoka',sans-serif] relative">
        <div className="ev-gridfield absolute inset-0 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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

            <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center p-8 sm:p-12">
              {/* COLUMNA IZQUIERDA: texto y acciones */}
              <div className="relative z-10 text-center lg:text-left">
                <p className="text-blue-200 text-sm font-semibold ev-enter ev-d-1">Colaboración en equipo</p>
                <h1 className="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight ev-enter ev-d-2">Gestor de Equipos</h1>
                <p className="mt-3 text-blue-100 text-lg max-w-lg mx-auto lg:mx-0 ev-enter ev-d-3">
                  Crea un equipo de estudio o únete con un código para repartir tareas y avanzar juntos.
                </p>

                {/* Datos de la escena */}
                <ul className="mt-7 flex flex-wrap justify-center lg:justify-start gap-2.5 ev-enter ev-d-4">
                  {BENEFICIOS.map((b) => (
                    <li key={b.texto} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/12 border border-white/25 text-sm font-semibold text-white">
                      <span className="grid place-items-center w-6 h-6 rounded-full bg-white/20 text-amber-200 shrink-0">
                        <Icono nombre={b.icono} className="w-3.5 h-3.5" />
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
                      src="/Imagenes_Diseño/super_equipo.png"
                      alt="Equipo de estudiantes uniendose para trabajar en un proyecto. Crear un equipo nuevo."
                      className="ev-lift-mascota relative w-40 h-auto object-contain drop-shadow-2xl sm:w-48 lg:w-56"
                    />
                    <span
                      key={fraseHeroIdx}
                      className="ev-bubble absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-blue-950 font-black text-xs sm:text-sm px-3 py-1 rounded-2xl shadow-lg border-2 border-white whitespace-nowrap"
                    >
                      {FRASES_HERO[fraseHeroIdx]}
                    </span>

                    {/* Pista de que la imagen es accionable */}
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-white text-blue-700 text-[11px] sm:text-xs font-black px-3 py-1.5 shadow-lg border border-blue-100 whitespace-nowrap">
                      <Icono nombre="mas" className="w-3.5 h-3.5" />
                      Crear equipo
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* BARRA DE ACCIONES: fuera del header, sobre el fondo blanco.
              Aqui viven las dos vias de entrada al gestor. */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 ev-enter ev-d-2">
            <button type="button" onClick={() => { setShowCrearEquipo(true); setShowUnirse(false); }} className="ev-btn ev-shimmer ev-focusable inline-flex cursor-pointer items-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold text-lg shadow-md hover:bg-blue-700">
              <Icono nombre="mas" className="w-5 h-5" />
              Crear equipo
            </button>
            <button type="button" onClick={() => { setShowUnirse(true); setShowCrearEquipo(false); }} className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 bg-white text-blue-700 px-6 py-3.5 rounded-2xl font-bold text-lg border border-blue-200 hover:border-blue-400 hover:bg-blue-50">
              <Icono nombre="copiar" className="w-5 h-5" />
              Unirme con código
            </button>
          </div>

          {(showCrearEquipo || showUnirse) && (
            <div className="ev-panel-glass rounded-2xl p-6 sm:p-7 mt-6 ev-view max-w-md">
              {showCrearEquipo ? (
                <>
                  <h2 className="text-lg font-extrabold text-slate-900">Nuevo equipo</h2>
                  <p className="text-sm text-slate-500 mt-1">Genera un código para invitar a tus compañeros.</p>
                  <div className="ev-field relative mt-4">
                    <input
                      type="text"
                      placeholder="Ej. Calculus II - Proyecto Final"
                      value={nombreEquipo}
                      onChange={(e) => setNombreEquipo(e.target.value)}
                      aria-label="Nombre del equipo"
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={crearEquipo} className="ev-btn ev-focusable flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold">Crear equipo</button>
                    <button type="button" onClick={() => setShowCrearEquipo(false)} className="ev-focusable px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-extrabold text-slate-900">Unirme a un equipo</h2>
                  <p className="text-sm text-slate-500 mt-1">Pide el código de 6 caracteres a quien administra el equipo.</p>
                  <div className="ev-field relative mt-4">
                    <input
                      type="text"
                      placeholder="ABC123"
                      value={codigoUnirse}
                      onChange={(e) => setCodigoUnirse(e.target.value.toUpperCase())}
                      maxLength={6}
                      aria-label="Código de invitación"
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-center font-mono tracking-[0.35em] text-lg text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 uppercase"
                    />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={unirseEquipo} className="ev-btn ev-focusable flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold">Unirme</button>
                    <button type="button" onClick={() => setShowUnirse(false)} className="ev-focusable px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
                  </div>
                </>
              )}
            </div>
          )}

          <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
            {/* COLUMNA IZQUIERDA: los equipos */}
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">
                Tus equipos ({equipos.length})
              </h2>
              {equipos.length === 0 ? (
              <div className="ev-panel-glass relative overflow-hidden rounded-[2rem] px-6 py-14 sm:py-16 text-center ev-enter ev-d-2">
                {/* Círculos decorativos: el mismo lenguaje del header */}
                <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-12 w-44 h-44 bg-blue-200/40 rounded-full blur-2xl" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-14 w-56 h-56 bg-amber-300/30 rounded-full blur-2xl" />
                <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />

                <div className="relative">
                  {/* Ilustracion del equipo */}
                  <div className="ev-float inline-block">
                    <img
                      src="/Imagenes_Diseño/super_equipo.png"
                      alt=""
                      aria-hidden="true"
                      className="w-40 h-auto object-contain drop-shadow-xl sm:w-52"
                    />
                  </div>

                  <h3 className="mt-6 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                    Tu primer equipo te espera
                  </h3>
                  <p className="mt-2 text-slate-500 text-lg font-medium max-w-lg mx-auto">
                    Reúne a tus compañeros, reparte el trabajo y mira cómo avanza el proyecto en tiempo real.
                  </p>

                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <button type="button" onClick={() => { setShowCrearEquipo(true); setShowUnirse(false); }} className="ev-btn ev-shimmer ev-focusable inline-flex cursor-pointer items-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold text-lg shadow-md hover:bg-blue-700">
                      <Icono nombre="mas" className="w-5 h-5" />
                      Crear mi primer equipo
                    </button>
                    <button type="button" onClick={() => { setShowUnirse(true); setShowCrearEquipo(false); }} className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 bg-white text-blue-700 px-6 py-3.5 rounded-2xl font-bold text-lg border border-blue-200 hover:border-blue-400 hover:bg-blue-50">
                      <Icono nombre="copiar" className="w-5 h-5" />
                      Tengo un código
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {resumenGlobal.porEquipo.map(({ equipo: eq, total, avance, urgente }, i) => (
                  <button
                    key={eq.equipo_id}
                    type="button"
                    onClick={() => seleccionarEquipo(eq)}
                    className={`ev-stat ev-panel-glass ev-focusable cursor-pointer rounded-2xl p-5 text-left ev-enter ${['ev-d-1', 'ev-d-2', 'ev-d-3'][i % 3]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shrink-0">
                        <Icono nombre="usuarios" className="w-5 h-5" />
                      </span>
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 shrink-0">
                        {ETIQUETA_ROL[eq.rol] || eq.rol}
                      </span>
                    </div>
                    <h3 className="mt-4 font-extrabold text-lg text-slate-900 leading-tight">{eq.nombre}</h3>

                    {/* Avance del equipo, sin necesidad de entrar */}
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-[11px] font-bold mb-1.5">
                        <span className="text-slate-400 uppercase tracking-wider">
                          {total === 0 ? 'Sin tareas' : `${avance}% completado`}
                        </span>
                        {urgente && (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <Icono nombre="alerta" className="w-3 h-3" />
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

                    <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50/70 border border-blue-100 px-3 py-2">
                      <div>
                        <p className="text-[9px] font-bold uppercase text-blue-500 tracking-wider">Código</p>
                        <p className="font-mono font-black text-blue-800 tracking-[0.25em]">{eq.codigo_invitacion}</p>
                      </div>
                      <Icono nombre="copiar" className="w-4 h-4 text-blue-400" />
                    </div>
                  </button>
                ))}
              </div>
              )}
            </div>

            {/* COLUMNA DERECHA: resumen global. Se oculta sin equipos porque
                el empty state ya ofrece las dos vias de entrada. */}
            {equipos.length > 0 && (
              <aside className="lg:sticky lg:top-20 space-y-4" aria-label="Resumen de tu actividad">
                {/* Cifras globales */}
                <div className="ev-panel-glass ev-card-dash ev-slide-right ev-sr-0 relative overflow-hidden rounded-2xl p-5">
                  <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-40 pointer-events-none" />
                  <div aria-hidden="true" className="pointer-events-none absolute -top-14 -right-10 w-36 h-36 bg-blue-200/40 rounded-full blur-2xl" />
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-8 w-32 h-32 bg-amber-300/25 rounded-full blur-2xl" />
                  <span aria-hidden="true" className="ev-esquina" />

                  <div className="relative">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Tu actividad</h3>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        { etiqueta: 'Equipos', valor: cifras.equipos, gradiente: 'from-blue-600 to-indigo-700', icono: 'usuarios' },
                        { etiqueta: 'Tareas', valor: cifras.tareas, gradiente: 'from-indigo-500 to-violet-600', icono: 'tablero' },
                        { etiqueta: 'Completadas', valor: cifras.completadas, gradiente: 'from-emerald-500 to-teal-600', icono: 'check' },
                        { etiqueta: 'Vencidas', valor: cifras.vencidas, gradiente: 'from-rose-500 to-red-600', icono: 'alerta' },
                      ].map((s) => (
                        <div key={s.etiqueta} className="rounded-xl bg-white/85 border border-white/70 px-3 py-2.5">
                          <span className={`ev-stat-icon grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br ${s.gradiente} text-white shadow-sm mb-2`}>
                            <Icono nombre={s.icono} className="w-4 h-4" />
                          </span>
                          <p className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none tabular-nums">{s.valor}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.etiqueta}</p>
                        </div>
                      ))}
                    </div>

                    <hr className="ev-divisor my-4" />

                    {/* Avance global */}
                    <div>
                      <div className="flex items-baseline justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-500">Avance global</span>
                        <span className="text-slate-900 tabular-nums">{cifras.tasa}%</span>
                      </div>
                      <div className="ev-progress-track ev-track-brillo" role="img" aria-label={`Avance global: ${resumenGlobal.tasa}%`}>
                        <div className="ev-progress-fill bg-gradient-to-r from-emerald-500 to-teal-600" style={{ width: `${resumenGlobal.tasa}%` }} />
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-slate-400">
                        {resumenGlobal.pendientes === 0
                          ? 'Todo al día, no te queda nada pendiente.'
                          : `${resumenGlobal.pendientes} ${resumenGlobal.pendientes === 1 ? 'tarea pendiente' : 'tareas pendientes'} en total.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Próximas entregas, mezcladas entre todos los equipos */}
                <div className="ev-panel-glass ev-card-dash ev-slide-right ev-sr-1 relative overflow-hidden rounded-2xl p-5">
                  <span aria-hidden="true" className="ev-esquina" />

                  <div className="flex items-center gap-3">
                    <div className="ev-float shrink-0">
                      <img
                        src="/Imagenes_Diseño/asustado.png"
                        alt=""
                        aria-hidden="true"
                        className="w-12 h-auto object-contain drop-shadow-md sm:w-14"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Próximas entregas</h3>
                      {resumenGlobal.hoy > 0 && (
                        <p className="mt-0.5 text-xs font-bold text-red-600">
                          {resumenGlobal.hoy} {resumenGlobal.hoy === 1 ? 'vence hoy' : 'vencen hoy'}
                        </p>
                      )}
                    </div>
                  </div>

                  {resumenGlobal.proximas.length === 0 ? (
                    <p className="mt-4 text-sm font-medium text-slate-400">
                      Sin fechas de entrega próximas. Asigna una a una tarea para verla aquí.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-2.5">
                      {resumenGlobal.proximas.map((p) => {
                        const dias = getDiasRestantes(p.fecha_entrega);
                        const venceHoy = dias !== null && dias === 0;
                        const urgente = dias !== null && dias <= 2;
                        return (
                          <li
                            key={`${p.equipo_id}-${p.tarea_id}`}
                            className={`rounded-xl border px-3 py-2.5 transition-colors ${
                              venceHoy
                                ? 'bg-red-50 border-red-200 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]'
                                : 'bg-white/85 border-white/70 hover:border-blue-300'
                            }`}
                          >
                            <p className={`text-sm font-bold leading-snug truncate ${venceHoy ? 'text-red-900' : 'text-slate-800'}`}>
                              {p.titulo}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{p.equipo_nombre}</span>
                              <span
                                className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  venceHoy
                                    ? 'ev-badge-urgente bg-red-600 text-white'
                                    : urgente
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <Icono nombre={venceHoy ? 'alerta' : 'reloj'} className="w-2.5 h-2.5" />
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
                  <div className="ev-slide-right ev-sr-2 relative overflow-hidden rounded-2xl bg-blue-600 p-5 text-white shadow-md">
                    {/* Puntos tenues: la tarjeta azul es la unica sin glass,
                        el patron evita que quede como un bloque plano */}
                    <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-20 pointer-events-none" />
                    <div aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-12 w-36 h-36 bg-indigo-400/40 rounded-full blur-2xl" />

                    <div className="relative">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Tu rol</p>
                      <p className="mt-1 font-bold leading-snug">
                        {resumenGlobal.admins === equipos.length
                          ? 'Administras todos tus equipos.'
                          : `Administras ${resumenGlobal.admins} de ${equipos.length} equipos.`}
                      </p>
                      <p className="mt-1 text-xs text-blue-100">
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
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 font-['Fredoka',sans-serif]">
      <div className="flex">
        {sidebarMovil && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden ev-overlay" onClick={() => setSidebarMovil(false)} />}
        {chatMovil && <div className="fixed inset-0 bg-slate-900/40 z-40 xl:hidden ev-overlay" onClick={cerrarChatMovil} />}

        {/* Sidebar */}
        <aside
          className={`ev-panel-glass fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 lg:relative lg:z-auto
            ${sidebarMovil ? 'w-72 translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${sidebarMinimizado ? 'lg:w-16' : 'lg:w-64'}`}
        >
          <div className={`${sidebarMinimizado ? 'p-2' : 'p-4'} flex items-center border-b border-slate-200/70 gap-2`}>
            {!sidebarMinimizado && (
              <button type="button" onClick={salirDeEquipo} className="ev-focusable inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-700 transition-colors">
                <Icono nombre="volver" className="w-4 h-4" />
                Equipos
              </button>
            )}
            <button
              type="button"
              onClick={() => setSidebarMinimizado(!sidebarMinimizado)}
              className="ev-focusable hidden lg:grid place-items-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition-colors shrink-0 ml-auto"
              aria-label={sidebarMinimizado ? 'Expandir panel' : 'Minimizar panel'}
            >
              <Icono nombre="menu" className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setSidebarMovil(false)} className="ev-focusable lg:hidden grid place-items-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 shrink-0 ml-auto" aria-label="Cerrar panel">
              <Icono nombre="cerrar" className="w-4 h-4" />
            </button>
          </div>

          {!sidebarMinimizado ? (
            <>
              <div className="p-4 border-b border-slate-200/70">
                <h2 className="font-extrabold text-slate-900 leading-tight">{equipoActivo.nombre}</h2>
                <button
                  type="button"
                  onClick={copiarCodigo}
                  className="ev-focusable mt-2.5 w-full flex items-center justify-between rounded-xl bg-blue-50/80 border border-blue-100 px-3 py-2 hover:bg-blue-100 transition-colors"
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
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center justify-between">
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
                      <li key={m.usuario_id}>
                        <button
                          type="button"
                          onClick={() => setFiltroMiembro(filtroMiembro === String(m.usuario_id) ? 'todos' : String(m.usuario_id))}
                          className={`ev-chip ev-focusable w-full flex items-center gap-2.5 p-2 rounded-lg text-left ${
                            filtroMiembro === String(m.usuario_id) ? 'bg-blue-50 border border-blue-200' : 'border border-transparent hover:bg-slate-100'
                          }`}
                          aria-pressed={filtroMiembro === String(m.usuario_id)}
                        >
                          <span className={`ev-avatar grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br ${tonoDesdeNombre(m.nombre)} text-white text-xs font-bold shrink-0`}>
                            {m.nombre.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-1.5">
                              <span className="text-xs font-bold text-slate-800 truncate">{m.nombre}</span>
                              {m.rol === 'admin' && (
                                <span className="text-[8px] font-black uppercase text-blue-600 bg-blue-50 px-1 rounded shrink-0">Admin</span>
                              )}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5">
                              <span className="ev-progress-mini flex-1" style={{ backgroundColor: 'rgba(226,232,240,0.8)' }}>
                                <span className="ev-progress-mini-fill block bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${pct(abiertas, maxAbiertas)}%` }} />
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 shrink-0 tabular-nums">
                                {abiertas}/{total}
                              </span>
                            </span>
                          </span>
                        </button>
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
                      filtroMiembro === 'sin_asignar' ? 'bg-amber-50 border border-amber-200' : 'border border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <span className="grid place-items-center w-9 h-9 rounded-full bg-slate-200 text-slate-500 text-xs font-bold shrink-0">?</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-700">Sin asignar</span>
                      <span className="block text-[9px] text-slate-400">{metricas.sinAsignar} {metricas.sinAsignar === 1 ? 'tarea abierta' : 'tareas abiertas'}</span>
                    </span>
                  </button>
                )}
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
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="ev-mesh text-white relative overflow-hidden">
            <div aria-hidden="true" className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
            <div className="relative px-4 sm:px-6 py-5 sm:py-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button type="button" onClick={() => setSidebarMovil(true)} className="ev-focusable lg:hidden grid place-items-center w-10 h-10 rounded-xl bg-white/15 shrink-0" aria-label="Abrir panel de equipos">
                    <Icono nombre="menu" className="w-5 h-5" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg sm:text-2xl font-extrabold truncate">{equipoActivo.nombre}</h1>
                      <span className="ev-online shrink-0" aria-hidden="true" />
                    </div>
                    <p className="text-blue-100 text-xs sm:text-sm">{miembros.length} {miembros.length === 1 ? 'miembro' : 'miembros'} · {metricas.total} tareas</p>
                    {metricas.vencidas > 0 && (
                      <button
                        type="button"
                        onClick={() => { limpiarFiltros(); setVista('tablero'); setFiltroPrioridad('vencidas'); }}
                        className="ev-chip ev-focusable mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-[11px] font-bold hover:bg-red-500"
                      >
                        <Icono nombre="alerta" className="w-3 h-3" />
                        {metricas.vencidas} {metricas.vencidas === 1 ? 'tarea vencida' : 'tareas vencidas'}
                      </button>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => setShowCrearTarea(true)} className="ev-btn ev-shimmer ev-focusable inline-flex items-center gap-2 bg-white text-blue-700 px-4 sm:px-5 py-2.5 rounded-xl font-bold shadow-md shrink-0">
                  <Icono nombre="mas" className="w-4 h-4" />
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

              {/* Tabs: el chat ya no compite, vive en el panel derecho */}
              <div role="tablist" aria-label="Vistas del equipo" className="mt-5 flex gap-1 rounded-xl bg-white/15 p-1 w-full sm:w-auto sm:inline-flex">
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
          </header>

          {/* ---------------- DASHBOARD ---------------- */}
          {vista === 'dashboard' && (
            <div className="ev-view p-4 sm:p-6 space-y-5">
              {metricas.total === 0 ? (
                <div className="ev-panel-glass rounded-2xl py-20 text-center">
                  <span className="mx-auto grid place-items-center w-16 h-16 rounded-2xl bg-blue-50 text-blue-400">
                    <Icono nombre="tablero" className="w-8 h-8" />
                  </span>
                  <p className="mt-5 text-slate-700 font-bold text-lg">Este equipo todavía no tiene tareas</p>
                  <p className="mt-1 text-slate-400 text-sm">Crea la primera para empezar a repartir el trabajo.</p>
                  <button type="button" onClick={() => setShowCrearTarea(true)} className="ev-btn ev-focusable mt-6 inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold">
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
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Tareas por estado</h2>
                      <div className="mt-4 space-y-3.5">
                        {metricas.porEstado.map((e) => (
                          <div key={e.clave}>
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="font-bold text-slate-700">{e.label}</span>
                              <span className="font-extrabold text-slate-900">{e.valor}</span>
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
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Tareas por prioridad</h2>
                      <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
                        <Donut segmentos={metricas.porPrioridad} total={metricas.total} />
                        <ul className="flex-1 w-full space-y-2.5">
                          {metricas.porPrioridad.map((p) => (
                            <li key={p.clave}>
                              <button
                                type="button"
                                onClick={() => { setFiltroPrioridad(filtroPrioridad === p.clave ? 'todas' : p.clave); setVista('tablero'); }}
                                className="ev-focusable w-full flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
                                aria-label={`Filtrar por ${p.label}`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                  <span className="text-sm font-semibold text-slate-700 truncate">{p.label}</span>
                                </span>
                                <span className="font-extrabold text-slate-900">{p.valor}</span>
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
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Carga por miembro</h2>
                      {metricas.carga.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-400">Sin miembros asignados todavía.</p>
                      ) : (
                        <ul className="mt-4 space-y-3">
                          {metricas.carga.map((c) => (
                            <li key={c.usuario_id} className="flex items-center gap-3">
                              <span className={`ev-avatar grid place-items-center w-8 h-8 rounded-full bg-gradient-to-br ${tonoDesdeNombre(c.nombre)} text-white text-xs font-bold shrink-0`}>
                                {c.nombre.charAt(0).toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-bold text-slate-700 truncate">{c.nombre}</span>
                                  <span className="font-bold text-slate-400 shrink-0 ml-2">{c.abiertas} abiertas</span>
                                </div>
                                <div className="ev-bar-track" style={{ height: 8 }}>
                                  <div className="ev-bar-fill bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${pct(c.abiertas, Math.max(...metricas.carga.map((x) => x.abiertas), 1))}%` }} />
                                </div>
                              </div>
                            </li>
                          ))}
                          {metricas.sinAsignar > 0 && (
                            <li className="flex items-center gap-3 pt-1 border-t border-slate-200/70">
                              <span className="grid place-items-center w-8 h-8 rounded-full bg-slate-200 text-slate-500 text-xs font-bold shrink-0">?</span>
                              <div className="flex-1">
                                <span className="text-xs font-bold text-slate-600">Sin asignar</span>
                                <p className="text-[11px] text-slate-400">{metricas.sinAsignar} {metricas.sinAsignar === 1 ? 'tarea abierta' : 'tareas abiertas'}</p>
                              </div>
                            </li>
                          )}
                        </ul>
                      )}
                    </section>

                    {/* Próximas entregas */}
                    <section className="ev-panel-glass rounded-2xl p-5 ev-enter ev-d-5">
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Próximas entregas</h2>
                      {metricas.proximas.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-400">No hay tareas con fecha de entrega pendiente.</p>
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
                                  className="ev-focusable w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                                >
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${urgente ? 'bg-red-500' : 'bg-blue-500'}`} aria-hidden="true" />
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-bold text-slate-800 truncate">{t.titulo}</span>
                                    <span className="block text-[11px] text-slate-400">{t.asignado_nombre || 'Sin asignar'}</span>
                                  </span>
                                  <span className={`shrink-0 text-xs font-black ${urgente ? 'text-red-600' : 'text-slate-500'}`}>
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
              <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex flex-wrap items-center gap-2">
                <div className="ev-field relative flex-1 min-w-[180px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icono nombre="buscar" className="w-4 h-4" />
                  </span>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar tareas..."
                    aria-label="Buscar tareas"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Chip activo={filtroPrioridad === 'todas'} onClick={limpiarFiltros} ariaLabel="Sin filtros">
                    Todas
                  </Chip>
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
                    className="ev-focusable text-xs font-bold px-3 py-1.5 rounded-full bg-white/80 text-slate-600 border border-slate-200 outline-none"
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
                      onDragEnter={(e) => { e.preventDefault(); contadorDrag.current += 1; setColumnaSobre(key); }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        contadorDrag.current -= 1;
                        if (contadorDrag.current <= 0) { contadorDrag.current = 0; setColumnaSobre(null); }
                      }}
                      onDrop={(e) => handleDrop(e, key)}
                      className={`ev-columna flex-1 min-w-[264px] rounded-2xl ${est.bg} p-3 flex flex-col ${sobre ? 'ev-columna-sobre' : ''}`}
                    >
                      <div className="mb-3 px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: est.punto }} aria-hidden="true" />
                          <h2 className={`font-extrabold text-sm ${est.text}`}>{est.label}</h2>
                          <span className="ml-auto text-xs font-black text-slate-500 bg-white px-2 py-0.5 rounded-full">{lista.length}</span>
                        </div>
                        <div className="mt-2 ev-progress-mini" role="img" aria-label={`${est.label}: ${avance}% del total`}>
                          <div className="ev-progress-mini-fill" style={{ width: `${avance}%`, backgroundColor: est.punto }} />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[120px]">
                        {lista.length === 0 ? (
                          <p className="text-center py-8 text-xs font-semibold text-slate-400">Arrastra tareas aquí</p>
                        ) : (
                          lista.map((t) => (
                            <TarjetaTarea
                              key={t.tarea_id}
                              tarea={t}
                              arrastrando={draggedTask?.tarea_id === t.tarea_id}
                              onDragStart={handleDragStart}
                              onDragEnd={() => { setDraggedTask(null); contadorDrag.current = 0; setColumnaSobre(null); }}
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
          className={`ev-panel-glass shrink-0 border-l border-slate-200/70 flex flex-col
            ${chatMovil ? 'fixed inset-y-0 right-0 z-50 w-full max-w-sm' : 'hidden xl:flex xl:w-[340px]'}`}
        >
          <div className="p-4 border-b border-slate-200/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icono nombre="chat" className="w-4 h-4 text-blue-600 shrink-0" />
              <h2 className="font-extrabold text-sm text-slate-900 truncate">Chat del equipo</h2>
            </div>
            <span className="text-[10px] font-bold text-slate-400 shrink-0">{mensajes.length} mensajes</span>
            <button
              type="button"
              onClick={cerrarChatMovil}
              className="ev-focusable xl:hidden grid place-items-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
              aria-label="Cerrar chat"
            >
              <Icono nombre="cerrar" className="w-4 h-4" />
            </button>
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.length === 0 ? (
              <div className="h-full grid place-items-center text-center">
                <div>
                  <span className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-400">
                    <Icono nombre="chat" className="w-7 h-7" />
                  </span>
                  <p className="mt-4 font-bold text-slate-700">Sin mensajes todavía</p>
                  <p className="mt-1 text-sm text-slate-400">Escribe el primero para coordinar al equipo.</p>
                </div>
              </div>
            ) : (
              mensajes.map((msg, i) => {
                const mio = String(msg.usuario_id) === String(usuario);
                const previo = mensajes[i - 1];
                // Agrupa mensajes consecutivos del mismo autor
                const agrupado = previo && String(previo.usuario_id) === String(msg.usuario_id);
                return (
                  <div key={msg.mensaje_id || msg.fecha_envio} className={`flex gap-2.5 ${mio ? 'justify-end' : 'justify-start'}`}>
                    {!mio && (
                      <span className={`ev-avatar grid place-items-center w-8 h-8 rounded-full text-white text-xs font-bold shrink-0 ${agrupado ? 'opacity-0' : `bg-gradient-to-br ${tonoDesdeNombre(msg.autor_nombre)}`}`}>
                        {(msg.autor_nombre || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className={`max-w-[85%] ${agrupado ? '' : 'ev-burbuja'}`}>
                      {!mio && !agrupado && (
                        <p className="text-xs font-bold text-blue-600 mb-1">{msg.autor_nombre}</p>
                      )}
                      <div className={`px-3.5 py-2.5 rounded-2xl ${mio ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'}`}>
                        <p className="text-sm leading-relaxed break-words">{msg.texto}</p>
                      </div>
                      <p className={`mt-1 text-[10px] text-slate-400 ${mio ? 'text-right' : ''}`}>
                        {new Date(msg.fecha_envio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-slate-200/70">
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') enviarMensaje(); }}
                placeholder="Escribe un mensaje..."
                aria-label="Mensaje de chat"
                className="ev-field flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={enviarMensaje}
                disabled={!nuevoMensaje.trim()}
                aria-label="Enviar mensaje"
                className="ev-btn ev-focusable grid place-items-center w-11 h-11 rounded-xl bg-blue-600 text-white shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icono nombre="enviar" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ---------------- MODAL CREAR TAREA ---------------- */}
      {showCrearTarea && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center p-4 z-50 ev-overlay" onClick={() => setShowCrearTarea(false)}>
          <div className="ev-panel-glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ev-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200/70 sticky top-0 bg-white/90 backdrop-blur-xl rounded-t-2xl z-10">
              <h2 className="font-extrabold text-slate-900">Nueva tarea</h2>
              <button type="button" onClick={() => setShowCrearTarea(false)} className="ev-focusable grid place-items-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Cerrar">
                <Icono nombre="cerrar" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="nueva-titulo" className="block text-sm font-bold text-slate-700 mb-1.5">Título</label>
                <input
                  id="nueva-titulo"
                  type="text"
                  value={nuevaTarea.titulo}
                  onChange={(e) => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })}
                  placeholder="¿Qué hay que hacer?"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <div>
                <label htmlFor="nueva-desc" className="block text-sm font-bold text-slate-700 mb-1.5">Descripción <span className="font-normal text-slate-400">(opcional)</span></label>
                <textarea
                  id="nueva-desc"
                  value={nuevaTarea.descripcion}
                  onChange={(e) => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nueva-fecha" className="block text-sm font-bold text-slate-700 mb-1.5">Fecha de entrega</label>
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
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="nueva-asignado" className="block text-sm font-bold text-slate-700 mb-1.5">Asignar a</label>
                  <select
                    id="nueva-asignado"
                    value={nuevaTarea.asignado_a}
                    onChange={(e) => setNuevaTarea({ ...nuevaTarea, asignado_a: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-700 mb-1.5">Prioridad</span>
                <div className="flex gap-2">
                  {Object.entries(PRIORIDADES).map(([clave, p]) => (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => setNuevaTarea({ ...nuevaTarea, prioridad: clave })}
                      aria-pressed={nuevaTarea.prioridad === clave}
                      className={`ev-chip ev-focusable flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border ${
                        nuevaTarea.prioridad === clave ? `${p.bg} ${p.text} border-current` : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200/70 flex gap-3 sticky bottom-0 bg-white/90 backdrop-blur-xl rounded-b-2xl">
              <button type="button" onClick={() => setShowCrearTarea(false)} className="ev-focusable flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
              <button type="button" onClick={crearTarea} className="ev-btn ev-focusable flex-1 py-3 rounded-xl font-bold bg-blue-600 text-white">Crear tarea</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL EDITAR TAREA ---------------- */}
      {tareaEditando && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center p-4 z-50 ev-overlay" onClick={cerrarEditorTarea}>
          <div className="ev-panel-glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ev-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200/70 sticky top-0 bg-white/90 backdrop-blur-xl rounded-t-2xl z-10">
              <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
                <Icono nombre="editar" className="w-4 h-4" />
                Editar tarea
              </h2>
              <button type="button" onClick={cerrarEditorTarea} className="ev-focusable grid place-items-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Cerrar">
                <Icono nombre="cerrar" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="edit-titulo" className="block text-sm font-bold text-slate-700 mb-1.5">Título</label>
                <input
                  id="edit-titulo"
                  type="text"
                  value={tareaEditForm.titulo}
                  onChange={(e) => setTareaEditForm({ ...tareaEditForm, titulo: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <div>
                <label htmlFor="edit-desc" className="block text-sm font-bold text-slate-700 mb-1.5">Descripción</label>
                <textarea
                  id="edit-desc"
                  value={tareaEditForm.descripcion}
                  onChange={(e) => setTareaEditForm({ ...tareaEditForm, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-fecha" className="block text-sm font-bold text-slate-700 mb-1.5">Fecha de entrega</label>
                  <input
                    id="edit-fecha"
                    type="date"
                    value={tareaEditForm.fecha_entrega}
                    onChange={(e) => setTareaEditForm({ ...tareaEditForm, fecha_entrega: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="edit-asignado" className="block text-sm font-bold text-slate-700 mb-1.5">Asignar a</label>
                  <select
                    id="edit-asignado"
                    value={tareaEditForm.asignado_a}
                    onChange={(e) => setTareaEditForm({ ...tareaEditForm, asignado_a: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-700 mb-1.5">Estado</span>
                <div className="flex gap-2">
                  {ORDEN_ESTADOS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTareaEditForm({ ...tareaEditForm, estado: key })}
                      aria-pressed={tareaEditForm.estado === key}
                      className={`ev-chip ev-focusable flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border ${
                        tareaEditForm.estado === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {ESTADOS[key].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-700 mb-1.5">Prioridad</span>
                <div className="flex gap-2">
                  {Object.entries(PRIORIDADES).map(([clave, p]) => (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => setTareaEditForm({ ...tareaEditForm, prioridad: clave })}
                      aria-pressed={tareaEditForm.prioridad === clave}
                      className={`ev-chip ev-focusable flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border ${
                        tareaEditForm.prioridad === clave ? `${p.bg} ${p.text} border-current` : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200/70 pt-4">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Comentarios ({comentariosTarea.length})</h3>
                <div className="max-h-44 overflow-y-auto space-y-2 mb-3 pr-1">
                  {comentariosTarea.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin comentarios todavía.</p>
                  ) : (
                    comentariosTarea.map((c) => {
                      const mio = String(c.usuario_id) === String(usuario);
                      return (
                        <div key={c.comentario_id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mio ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'}`}>
                            {!mio && <p className="text-[10px] font-bold text-blue-600 mb-0.5">{c.autor_nombre}</p>}
                            <p className="text-xs leading-relaxed break-words">{c.texto}</p>
                            <p className={`text-[9px] mt-1 ${mio ? 'text-blue-200' : 'text-slate-400'}`}>
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
                    className="ev-field flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <button type="button" onClick={agregarComentario} disabled={!nuevoComentario.trim()} aria-label="Enviar comentario" className="ev-btn ev-focusable grid place-items-center w-11 h-11 rounded-xl bg-blue-600 text-white shrink-0 disabled:opacity-50">
                    <Icono nombre="enviar" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200/70 flex gap-3 sticky bottom-0 bg-white/90 backdrop-blur-xl rounded-b-2xl">
              <button type="button" onClick={cerrarEditorTarea} className="ev-focusable flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
              <button type="button" onClick={guardarEdicionTarea} className="ev-btn ev-focusable flex-1 py-3 rounded-xl font-bold bg-blue-600 text-white">Guardar cambios</button>
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
            <h2 className="mt-4 text-center font-extrabold text-slate-900 text-lg">Eliminar tarea</h2>
            <p className="mt-2 text-center text-sm text-slate-500">
              ¿Seguro que quieres eliminar <span className="font-bold text-slate-700">"{tareaAEliminar.titulo}"</span>?
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setTareaAEliminar(null)} className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
              <button type="button" onClick={() => { eliminarTarea(tareaAEliminar.tarea_id); setTareaAEliminar(null); }} className="ev-focusable flex-1 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestorEquipos;