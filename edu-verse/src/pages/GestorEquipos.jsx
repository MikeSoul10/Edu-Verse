import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

const PRIORIDADES = {
  verde: { label: 'No urgente', color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
  amarillo: { label: 'Urgente', color: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' },
  rojo: { label: 'Pocos días', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
};

const ESTADOS = {
  pendiente: { label: 'Pendiente', emoji: '📋', bg: 'bg-gray-100' },
  en_progreso: { label: 'En Progreso', emoji: '⚙️', bg: 'bg-blue-50' },
  completada: { label: 'Completada', emoji: '✅', bg: 'bg-green-50' },
};

const GestorEquipos = () => {
  const socketRef = useRef(null);
  const getUsuarioId = () => {
    let id = localStorage.getItem('usuario_id');
    if (id) return id;
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return String(payload.id);
      } catch(e) { return null; }
    }
    return null;
  };
  const usuario = getUsuarioId();
  const usuarioNombre = localStorage.getItem('usuario');
  const [equipos, setEquipos] = useState([]);
  const [equipoActivo, setEquipoActivo] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [showCrearEquipo, setShowCrearEquipo] = useState(false);
  const [showUnirse, setShowUnirse] = useState(false);
  const [showCrearTarea, setShowCrearTarea] = useState(false);
  const [nombreEquipo, setNombreEquipo] = useState('');
  const [codigoUnirse, setCodigoUnirse] = useState('');
  const chatRef = useRef(null);
  const [draggedTask, setDraggedTask] = useState(null);

  const [nuevaTarea, setNuevaTarea] = useState({
    titulo: '',
    descripcion: '',
    prioridad: 'verde',
    fecha_entrega: '',
    asignado_a: '',
  });
  const [chatAbierto, setChatAbierto] = useState(false);
  const chatAbiertoRef = useRef(false);
  const [sidebarMinimizado, setSidebarMinimizado] = useState(false);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  const [tareaAEliminar, setTareaAEliminar] = useState(null);
  const [tareaEditando, setTareaEditando] = useState(null);
  const [tareaEditForm, setTareaEditForm] = useState({ titulo: '', descripcion: '', prioridad: 'verde', fecha_entrega: '', asignado_a: '' });
  const [sidebarMovil, setSidebarMovil] = useState(false);

  const cargarEquipos = useCallback(async () => {
    if (!usuario) return;
    try {
      const res = await axios.get(`${API_URL}/equipos/mis-equipos/${usuario}`);
      setEquipos(res.data);
    } catch {
      // handled silently
    }
  }, [usuario]);

  const cargarTareas = useCallback(async (equipoId) => {
    try {
      const res = await axios.get(`${API_URL}/tareas/equipo/${equipoId}`);
      setTareas(res.data);
    } catch {
      // handled silently
    }
  }, []);

  const cargarMiembros = useCallback(async (equipoId) => {
    try {
      const res = await axios.get(`${API_URL}/equipos/${equipoId}/miembros`);
      setMiembros(res.data);
    } catch {
      // handled silently
    }
  }, []);

  const cargarMensajes = useCallback(async (equipoId) => {
    try {
      const res = await axios.get(`${API_URL}/chat/${equipoId}`);
      setMensajes(res.data);
    } catch {
      // handled silently
    }
  }, []);

  useEffect(() => {
    const cargarDatos = async () => {
      await cargarEquipos();
    };
    cargarDatos();
  }, [cargarEquipos]);

  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('tarea-creada', (data) => {
      setTareas((prev) => {
        if (prev.some((t) => t.tarea_id === data.tarea.tarea_id)) return prev;
        return [data.tarea, ...prev];
      });
    });
    socket.on('tarea-movida', (data) => {
      setTareas((prev) =>
        prev.map((t) => (t.tarea_id === data.tarea.tarea_id ? data.tarea : t))
      );
    });
    socket.on('tarea-editada', (data) => {
      setTareas((prev) =>
        prev.map((t) => (t.tarea_id === data.tarea.tarea_id ? data.tarea : t))
      );
    });
    socket.on('tarea-eliminada', (data) => {
      setTareas((prev) => prev.filter((t) => t.tarea_id !== data.tarea_id));
    });
    socket.on('nuevo-mensaje', (data) => {
      setMensajes((prev) => [...prev, data]);
      if (!chatAbiertoRef.current) {
        setMensajesNoLeidos((prev) => prev + 1);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    chatAbiertoRef.current = chatAbierto;
    if (chatAbierto) {
      setMensajesNoLeidos(0);
    }
  }, [chatAbierto]);

  useEffect(() => {
    if (chatAbierto && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [mensajes, chatAbierto]);

  const seleccionarEquipo = async (equipo) => {
    try {
      if (equipoActivo && socketRef.current) {
        socketRef.current.emit('salir-equipo', equipoActivo.equipo_id);
      }
      setEquipoActivo(equipo);
      setChatAbierto(false);
      chatAbiertoRef.current = false;
      setMensajesNoLeidos(0);
      if (socketRef.current) {
        socketRef.current.emit('unirse-equipo', equipo.equipo_id);
      }
      await Promise.all([
        cargarTareas(equipo.equipo_id),
        cargarMiembros(equipo.equipo_id),
        cargarMensajes(equipo.equipo_id),
      ]);
    } catch (err) {
      console.error('Error al seleccionar equipo:', err);
    }
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
      const payload = { nombre: nombreEquipo, usuario_id: usuario };
      const res = await axios.post(`${API_URL}/equipos/crear`, payload);
      toast.success('Equipo creado');
      setEquipos((prev) => [res.data.equipo, ...prev]);
      setNombreEquipo('');
      setShowCrearEquipo(false);
      await seleccionarEquipo(res.data.equipo);
    } catch (err) {
      toast.error(getToastMsg(err));
    }
  };

  const unirseEquipo = async () => {
    if (!codigoUnirse.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/equipos/unirse`, {
        codigo: codigoUnirse.toUpperCase(),
        usuario_id: usuario,
      });
      toast.success('Te uniste al equipo');
      await cargarEquipos();
      setCodigoUnirse('');
      setShowUnirse(false);
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
      const tarea = res.data.tarea;
      setTareas((prev) => [tarea, ...prev]);
      socketRef.current.emit('nueva-tarea', { equipo_id: equipoActivo.equipo_id, tarea });
      setNuevaTarea({ titulo: '', descripcion: '', prioridad: 'verde', fecha_entrega: '', asignado_a: '' });
      setShowCrearTarea(false);
      toast.success('Tarea creada');
    } catch {
      toast.error('Error al crear tarea');
    }
  };

  const moverTarea = async (tareaId, nuevoEstado) => {
    try {
      const res = await axios.put(`${API_URL}/tareas/${tareaId}/mover`, { estado: nuevoEstado });
      socketRef.current.emit('mover-tarea', { equipo_id: equipoActivo.equipo_id, tarea: res.data.tarea });
    } catch {
      toast.error('Error al mover tarea');
    }
  };

  const eliminarTarea = async (tareaId) => {
    try {
      await axios.delete(`${API_URL}/tareas/${tareaId}`);
      socketRef.current.emit('eliminar-tarea', { equipo_id: equipoActivo.equipo_id, tarea_id: tareaId });
      toast.success('Tarea eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const abrirEditorTarea = (tarea) => {
    setTareaEditando(tarea);
    setTareaEditForm({
      titulo: tarea.titulo,
      descripcion: tarea.descripcion || '',
      prioridad: tarea.prioridad || 'verde',
      fecha_entrega: tarea.fecha_entrega ? new Date(tarea.fecha_entrega).toISOString().split('T')[0] : '',
      asignado_a: tarea.asignado_a || '',
      estado: tarea.estado || 'pendiente',
    });
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
      socketRef.current.emit('editar-tarea', { equipo_id: equipoActivo.equipo_id, tarea: res.data.tarea });
      setTareaEditando(null);
      toast.success('Tarea actualizada');
    } catch {
      toast.error('Error al guardar cambios');
    }
  };

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim()) return;
    try {
      await axios.post(`${API_URL}/chat/enviar`, {
        equipo_id: equipoActivo.equipo_id,
        usuario_id: usuario,
        texto: nuevoMensaje,
      });
      socketRef.current.emit('mensaje-chat', {
        equipo_id: equipoActivo.equipo_id,
        usuario_id: usuario,
        autor_nombre: usuarioNombre,
        texto: nuevoMensaje,
        fecha_envio: new Date().toISOString(),
      });
      setNuevoMensaje('');
    } catch {
      toast.error('Error al enviar');
    }
  };

  const handleDragStart = (e, tarea) => {
    setDraggedTask(tarea);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, estado) => {
    e.preventDefault();
    if (draggedTask && draggedTask.estado !== estado) {
      moverTarea(draggedTask.tarea_id, estado);
    }
    setDraggedTask(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const getDiasRestantes = (fecha) => {
    if (!fecha) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const entrega = new Date(fecha);
    entrega.setHours(0, 0, 0, 0);
    const diff = Math.ceil((entrega - hoy) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const autoAsignarPrioridad = (fecha) => {
    if (!fecha) return;
    const dias = getDiasRestantes(fecha);
    if (dias <= 2) setNuevaTarea((prev) => ({ ...prev, prioridad: 'rojo', fecha_entrega: fecha }));
    else if (dias <= 5) setNuevaTarea((prev) => ({ ...prev, prioridad: 'amarillo', fecha_entrega: fecha }));
    else setNuevaTarea((prev) => ({ ...prev, prioridad: 'verde', fecha_entrega: fecha }));
  };

  const renderTarea = (tarea) => {
    const pri = PRIORIDADES[tarea.prioridad] || PRIORIDADES.verde;
    const dias = getDiasRestantes(tarea.fecha_entrega);
    return (
      <div
        key={tarea.tarea_id}
        draggable
        onDragStart={(e) => handleDragStart(e, tarea)}
        onClick={() => abrirEditorTarea(tarea)}
        className={`p-3 rounded-xl border-l-4 ${pri.border} bg-white shadow-sm mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all`}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-gray-800 text-sm leading-tight flex-1">{tarea.titulo}</h4>
          <button
            onClick={(e) => { e.stopPropagation(); setTareaAEliminar(tarea); }}
            className="text-gray-300 hover:text-red-500 transition-colors text-xs shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center"
            title="Eliminar tarea"
          >
            🗑
          </button>
        </div>

        {tarea.descripcion && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tarea.descripcion}</p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${pri.bg} ${pri.text}`}>
            <span className={`inline-block w-2 h-2 rounded-full ${pri.color} mr-1`}></span>
            {pri.label}
          </span>

          {tarea.fecha_entrega && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              dias !== null && dias < 0 ? 'bg-red-100 text-red-600' :
              dias !== null && dias <= 2 ? 'bg-red-100 text-red-600' :
              dias !== null && dias <= 5 ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              📅 {new Date(tarea.fecha_entrega).toLocaleDateString('es-MX')}
              {dias !== null && dias < 0 && ` (vencida)`}
              {dias !== null && dias === 0 && ` (hoy)`}
              {dias !== null && dias > 0 && ` (${dias}d)`}
            </span>
          )}
        </div>

        {tarea.asignado_nombre && (
          <div className="mt-2 flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[8px] font-bold">
              {tarea.asignado_nombre.charAt(0).toUpperCase()}
            </div>
            <span className="text-[10px] text-gray-500 font-medium">{tarea.asignado_nombre}</span>
          </div>
        )}

        <div className="flex gap-1 mt-2">
          {Object.keys(ESTADOS).map((est) => (
            est !== tarea.estado && (
              <button
                key={est}
                onClick={(e) => { e.stopPropagation(); moverTarea(tarea.tarea_id, est); }}
                className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-500 transition-colors"
              >
                → {ESTADOS[est].emoji}
              </button>
            )
          ))}
        </div>
      </div>
    );
  };

  if (!equipoActivo) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        <header className="mb-6 sm:mb-8 p-5 sm:p-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl sm:rounded-[2rem] shadow-xl text-white">
          <h1 className="text-xl sm:text-3xl font-black">👥 Gestor de Equipos</h1>
          <p className="opacity-90 mt-2 text-xs sm:text-base">Crea o únete a un equipo para empezar a colaborar</p>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => setShowCrearEquipo(true)}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md text-sm sm:text-base"
          >
            + Crear Equipo
          </button>
          <button
            onClick={() => setShowUnirse(true)}
            className="bg-white text-emerald-700 px-6 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors border border-emerald-200 shadow-sm text-sm sm:text-base"
          >
            🔗 Unirse con Código
          </button>
        </div>

        {showCrearEquipo && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border mb-8 max-w-md">
            <h3 className="font-bold text-gray-800 mb-3">Nuevo Equipo</h3>
            <input
              type="text"
              placeholder="Nombre del equipo"
              value={nombreEquipo}
              onChange={(e) => setNombreEquipo(e.target.value)}
              aria-label="Nombre del equipo"
              className="w-full border rounded-lg px-4 py-2 mb-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <div className="flex gap-2">
              <button onClick={crearEquipo} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
                Crear
              </button>
              <button onClick={() => setShowCrearEquipo(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {showUnirse && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border mb-8 max-w-md">
            <h3 className="font-bold text-gray-800 mb-3">Unirse a un Equipo</h3>
            <input
              type="text"
              placeholder="Código de 6 caracteres"
              value={codigoUnirse}
              onChange={(e) => setCodigoUnirse(e.target.value.toUpperCase())}
              maxLength={6}
              aria-label="Código de invitación"
              className="w-full border rounded-lg px-4 py-2 mb-3 text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <div className="flex gap-2">
              <button onClick={unirseEquipo} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
                Unirse
              </button>
              <button onClick={() => setShowUnirse(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipos.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed">
              <p className="text-gray-400 text-lg font-medium">Aún no tienes equipos</p>
              <p className="text-gray-300 text-sm mt-1">Crea uno o únete con un código</p>
            </div>
          ) : (
            equipos.map((eq) => (
              <button
                key={eq.equipo_id}
                onClick={() => seleccionarEquipo(eq)}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  👥
                </div>
                <h3 className="font-black text-gray-900 text-lg">{eq.nombre}</h3>
                <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                  <p className="text-[9px] font-bold uppercase text-emerald-600 tracking-wider">Clave</p>
                  <p className="text-lg font-black text-emerald-700 font-mono tracking-[0.25em]">{eq.codigo_invitacion}</p>
                </div>
                <span className="inline-block mt-3 text-[10px] font-bold uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-600">
                  {eq.rol}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] relative">
      {/* SIDEBAR - Mobile overlay */}
      {sidebarMovil && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarMovil(false)} />
      )}

      {/* SIDEBAR */}
      <div className={`
        bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300
        lg:relative lg:z-auto
        fixed inset-y-0 left-0 z-50
        ${sidebarMinimizado ? 'lg:w-14' : 'lg:w-64'}
        ${sidebarMovil ? 'w-72 translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className={`${sidebarMinimizado ? 'p-2' : 'p-4'} border-b border-gray-100 flex items-center ${sidebarMinimizado ? 'justify-center' : 'justify-between'}`}>
          {!sidebarMinimizado && (
            <button
              onClick={() => {
                if (socketRef.current) socketRef.current.emit('salir-equipo', equipoActivo.equipo_id);
                setEquipoActivo(null);
                setTareas([]);
                setMensajes([]);
                setMiembros([]);
                setChatAbierto(false);
                chatAbiertoRef.current = false;
                setMensajesNoLeidos(0);
                setSidebarMovil(false);
              }}
              className="text-xs text-gray-400 hover:text-emerald-600 font-bold transition-colors"
            >
              ← Volver
            </button>
          )}
          <button
            onClick={() => setSidebarMinimizado(!sidebarMinimizado)}
            className={`${sidebarMinimizado ? '' : 'ml-auto'} w-7 h-7 rounded-lg bg-gray-100 hover:bg-emerald-100 text-gray-500 hover:text-emerald-600 flex items-center justify-center text-xs font-bold transition-colors shrink-0 hidden lg:flex`}
            title={sidebarMinimizado ? 'Expandir panel' : 'Minimizar panel'}
          >
            {sidebarMinimizado ? '›' : '‹'}
          </button>
          <button
            onClick={() => setSidebarMovil(false)}
            className="lg:hidden w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 flex items-center justify-center text-xs font-bold transition-colors shrink-0 ml-auto"
          >
            ✕
          </button>
        </div>

        {!sidebarMinimizado && (
          <>
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-black text-gray-900 text-lg leading-tight">{equipoActivo.nombre}</h2>
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-[9px] font-bold uppercase text-emerald-600 tracking-wider">Clave de acceso</p>
                <p className="text-xl font-black text-emerald-700 font-mono tracking-[0.3em] mt-0.5">{equipoActivo.codigo_invitacion}</p>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3">
                Miembros ({miembros.length})
              </h3>
              <div className="space-y-2">
                {miembros.map((m) => (
                  <div key={m.usuario_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {m.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{m.nombre}</p>
                      <p className="text-[9px] text-gray-400 uppercase">{m.rol}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {sidebarMinimizado && (
          <div className="flex-1 flex flex-col items-center py-3 gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold" title={equipoActivo.nombre}>
              {equipoActivo.nombre.charAt(0).toUpperCase()}
            </div>
            {miembros.map((m) => (
              <div key={m.usuario_id} className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-[10px] font-bold" title={m.nombre}>
                {m.nombre.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KANBAN - SIEMPRE VISIBLE */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-white gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarMovil(true)}
              className="lg:hidden w-8 h-8 rounded-lg bg-gray-100 hover:bg-emerald-100 text-gray-500 hover:text-emerald-600 flex items-center justify-center text-sm font-bold transition-colors shrink-0"
            >
              ☰
            </button>
            <h2 className="font-black text-gray-900 text-sm sm:text-base truncate">📋 Tablero</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!chatAbierto && (
              <button
                onClick={() => setChatAbierto(true)}
                className={`relative px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  mensajesNoLeidos > 0
                    ? 'bg-red-50 text-red-600 border border-red-300 hover:bg-red-100 animate-pulse'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="hidden sm:inline">💬 Chat del Equipo</span>
                <span className="sm:hidden">💬</span>
                {mensajesNoLeidos > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                    {Math.min(mensajesNoLeidos, 99)}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setShowCrearTarea(true)}
              className="bg-emerald-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md"
            >
              <span className="sm:hidden">+</span>
              <span className="hidden sm:inline">+ Nueva Tarea</span>
            </button>
          </div>
        </div>

        {showCrearTarea && (
          <div className="bg-emerald-50 border-b border-emerald-100 p-3 sm:p-4">
            <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-emerald-100 max-w-2xl">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">Crear Nueva Tarea</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Título de la tarea"
                  value={nuevaTarea.titulo}
                  onChange={(e) => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })}
                  aria-label="Título de la tarea"
                  className="col-span-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <textarea
                  placeholder="Descripción (opcional)"
                  value={nuevaTarea.descripcion}
                  onChange={(e) => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })}
                  aria-label="Descripción de la tarea"
                  className="col-span-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-16"
                />
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Fecha de entrega</label>
                  <input
                    type="date"
                    value={nuevaTarea.fecha_entrega}
                    onChange={(e) => autoAsignarPrioridad(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Prioridad</label>
                  <div className="flex gap-1">
                    {Object.entries(PRIORIDADES).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setNuevaTarea({ ...nuevaTarea, prioridad: key })}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                          nuevaTarea.prioridad === key
                            ? `${val.bg} ${val.text} ring-2 ring-offset-1 ${val.border}`
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full ${val.color} mr-1`}></span>
                        {val.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Asignar a</label>
                  <select
                    value={nuevaTarea.asignado_a}
                    onChange={(e) => setNuevaTarea({ ...nuevaTarea, asignado_a: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map((m) => (
                      <option key={m.usuario_id} value={m.usuario_id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={crearTarea} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">
                  Crear Tarea
                </button>
                <button onClick={() => setShowCrearTarea(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex gap-3 sm:gap-4 p-3 sm:p-4 overflow-x-auto">
          {Object.entries(ESTADOS).map(([key, val]) => (
            <div
              key={key}
              className={`flex-1 min-w-[260px] sm:min-w-[280px] rounded-2xl ${val.bg} p-2 sm:p-3 flex flex-col`}
              onDrop={(e) => handleDrop(e, key)}
              onDragOver={handleDragOver}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-lg">{val.emoji}</span>
                <h3 className="font-black text-gray-700 text-sm">{val.label}</h3>
                <span className="ml-auto text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full">
                  {tareas.filter((t) => t.estado === key).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {tareas.filter((t) => t.estado === key).map(renderTarea)}
                {tareas.filter((t) => t.estado === key).length === 0 && (
                  <div className="text-center py-8 text-gray-300 text-xs font-medium">
                    Arrastra tareas aquí
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT PANEL */}
      {chatAbierto && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => { setChatAbierto(false); chatAbiertoRef.current = false; }} />
          <div className="fixed inset-0 z-40 lg:relative lg:z-auto w-full lg:w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 lg:shrink">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-black text-gray-900 text-sm">💬 Chat del Equipo</h3>
            <button
              onClick={() => { setChatAbierto(false); chatAbiertoRef.current = false; }}
              className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
              title="Cerrar chat"
            >
              ✕
            </button>
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-300 text-xs">Aún no hay mensajes</p>
              </div>
            )}
            {mensajes.map((msg) => {
              const esMio = String(msg.usuario_id) === String(usuario);
              return (
                <div key={msg.mensaje_id || msg.fecha_envio} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    esMio
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    {!esMio && (
                      <p className="text-[9px] font-bold text-emerald-600 mb-0.5">{msg.autor_nombre}</p>
                    )}
                    <p className="text-xs leading-relaxed">{msg.texto}</p>
                    <p className={`text-[8px] mt-1 ${esMio ? 'text-emerald-200' : 'text-gray-400'}`}>
                      {new Date(msg.fecha_envio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(msg.fecha_envio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()}
                aria-label="Mensaje de chat"
                className="flex-1 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                onClick={enviarMensaje}
                className="bg-emerald-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-colors shadow-md shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        </>
      )}
      {/* MODAL CONFIRMAR ELIMINAR TAREA */}
      {tareaAEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setTareaAEliminar(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="font-black text-gray-900 text-lg mb-2">Eliminar tarea</h3>
              <p className="text-sm text-gray-500 mb-6">
                ¿Seguro que quieres eliminar <span className="font-bold text-gray-700">"{tareaAEliminar.titulo}"</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTareaAEliminar(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { eliminarTarea(tareaAEliminar.tarea_id); setTareaAEliminar(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-md"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TAREA */}
      {tareaEditando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setTareaEditando(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-black text-gray-900 text-base sm:text-lg">✏️ Editar Tarea</h3>
              <button
                onClick={() => setTareaEditando(null)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 text-sm flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Título</label>
                <input
                  type="text"
                  value={tareaEditForm.titulo}
                  onChange={(e) => setTareaEditForm({ ...tareaEditForm, titulo: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Descripción</label>
                <textarea
                  value={tareaEditForm.descripcion}
                  onChange={(e) => setTareaEditForm({ ...tareaEditForm, descripcion: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Fecha de entrega</label>
                  <input
                    type="date"
                    value={tareaEditForm.fecha_entrega}
                    onChange={(e) => setTareaEditForm({ ...tareaEditForm, fecha_entrega: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Asignar a</label>
                  <select
                    value={tareaEditForm.asignado_a}
                    onChange={(e) => setTareaEditForm({ ...tareaEditForm, asignado_a: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map((m) => (
                      <option key={m.usuario_id} value={m.usuario_id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Prioridad</label>
                <div className="flex gap-2">
                  {Object.entries(PRIORIDADES).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setTareaEditForm({ ...tareaEditForm, prioridad: key })}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        tareaEditForm.prioridad === key
                          ? `${val.bg} ${val.text} ring-2 ring-offset-1 ${val.border}`
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <span className={`inline-block w-2 h-2 rounded-full ${val.color} mr-1`}></span>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Estado</label>
                <div className="flex gap-2">
                  {Object.entries(ESTADOS).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setTareaEditForm({ ...tareaEditForm, estado: key })}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        tareaEditForm.estado === key
                          ? 'bg-emerald-50 text-emerald-700 ring-2 ring-offset-1 ring-emerald-300'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {val.emoji} {val.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => setTareaEditando(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicionTarea}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-md"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestorEquipos;
