import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE_MB = 5;

const PALETA = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-sky-600',
];

// Mismo hash que usa el gestor de equipos: mismo nombre, mismo color.
const tonoDesdeNombre = (nombre = '') => {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 9973;
  return PALETA[h % PALETA.length];
};

const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';

const Icono = ({ nombre, className = 'w-5 h-5' }) => {
  const paths = {
    camara: <><path d="M4 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.586a1 1 0 0 1-.707-.293l-1.172-1.172A1 1 0 0 0 9.586 3H10.414a1 1 0 0 0-.707.293L8.535 4.707A1 1 0 0 1 7.828 5H4z" /><circle cx="10" cy="13" r="3" /></>,
    check: <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />,
    alerta: <><path d="M12 9v4M12 17h.01" strokeLinecap="round" /><path d="M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round" /></>,
    cerrar: <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />,
    salir: <><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" strokeLinecap="round" strokeLinejoin="round" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      {paths[nombre]}
    </svg>
  );
};

const Profile = () => {
  const [datos, setDatos] = useState({ nombre: '', email: '', foto_url: '' });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);

  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const usuarioId = user?.id;

  const nuevaFotoRef = useRef(null);
  const previewRef = useRef(null);
  const [nuevaFoto, setNuevaFoto] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const obtenerPerfil = async () => {
      if (!usuarioId) {
        navigate('/login');
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/auth/perfil/${usuarioId}`);
        setDatos({
          nombre: res.data.nombre,
          email: res.data.email,
          foto_url: res.data.foto_url,
        });
      } catch {
        toast.error('No se pudo cargar el perfil');
      } finally {
        setCargando(false);
      }
    };
    obtenerPerfil();
  }, [usuarioId, navigate]);

  // La URL de objetos del preview se revoca cuando se reemplaza o se
  // descarta. Antes nunca se revocaba y cada cambio de foto dejaba el
  // blob retenido en memoria.
  useEffect(() => {
    previewRef.current = preview;
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, [preview]);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorFoto('Formato no permitido. Usa PNG o JPG.');
      toast.error('Formato no permitido. Usa PNG o JPG.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorFoto(`La imagen excede ${MAX_SIZE_MB}MB.`);
      toast.error(`La imagen excede ${MAX_SIZE_MB}MB.`);
      return;
    }

    setErrorFoto(null);
    setNuevaFoto(file);
    // Se revoca el preview anterior antes de crear el nuevo.
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    setPreview(URL.createObjectURL(file));
  };

  const cancelarFoto = () => {
    setNuevaFoto(null);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    setPreview(null);
    setErrorFoto(null);
    if (nuevaFotoRef.current) nuevaFotoRef.current.value = '';
  };

  const subirFoto = async () => {
    if (!nuevaFoto) return toast.warning('Selecciona una imagen');

    setSubiendoFoto(true);
    const formData = new FormData();
    formData.append('foto', nuevaFoto);

    try {
      const res = await axios.put(`${API_URL}/usuarios/foto/${usuarioId}`, formData);
      toast.success('Foto actualizada');
      updateUser({ foto: res.data.url });
      setDatos((prev) => ({ ...prev, foto_url: res.data.url }));
      setNuevaFoto(null);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      setPreview(null);
      if (nuevaFotoRef.current) nuevaFotoRef.current.value = '';
    } catch {
      toast.error('Error al subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (datos.nombre.trim().length < 3) {
      return toast.warning('El nombre necesita al menos 3 caracteres');
    }
    setGuardando(true);
    try {
      const res = await axios.put(`${API_URL}/auth/perfil/update/${usuarioId}`, datos);
      toast.success('Perfil actualizado');
      updateUser({ nombre: res.data.nombre });
    } catch (err) {
      const mensaje = err.response?.data;
      toast.error(typeof mensaje === 'string' ? mensaje : 'Error al actualizar');
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesion = () => {
    logout();
    navigate('/login');
  };

  const usarIniciales = useCallback(() => {
    setDatos((prev) => ({ ...prev, foto_url: '' }));
    toast.success('Foto quitada');
  }, []);

  if (cargando) {
    return (
      <div className="ev-bg-nexo min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="ev-bg-nexo min-h-[calc(100vh-64px)] font-['Fredoka',sans-serif] relative">
      <div className="ev-gridfield absolute inset-0 pointer-events-none" />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-12">
        {/* ---------------- HEADER ---------------- */}
        <header className="ev-mesh relative overflow-hidden rounded-[2rem] text-white shadow-lg ev-enter ev-d-0">
          <div aria-hidden="true" className="pointer-events-none absolute -top-14 -left-14 h-48 w-48 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-amber-400/20 blur-2xl" />
          <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30 pointer-events-none" />

          <div className="relative flex flex-col items-center gap-5 p-8 text-center sm:p-10">
            {/* Avatar. El fallback son iniciales generadas localmente: antes
                pegaba a ui-avatars.com, un servicio externo que rompe sin
                internet y manda el nombre del usuario a un tercero. */}
            <div className="relative">
              <div className={`grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${tonoDesdeNombre(datos.nombre)} text-3xl font-black text-white ring-4 ring-white/30 sm:h-32 sm:w-32`}>
                {preview || datos.foto_url ? (
                  <img
                    src={preview || `${API_URL}${datos.foto_url}`}
                    alt={`Foto de ${datos.nombre}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      // Si la URL guardada esta rota, se cae a las iniciales.
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  iniciales(datos.nombre)
                )}
              </div>

              <label
                htmlFor="foto-upload"
                className="ev-focusable absolute -bottom-1 -right-1 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg ring-2 ring-white transition-transform hover:scale-110"
                title="Cambiar foto"
              >
                <Icono nombre="camara" className="w-5 h-5" />
                <span className="sr-only">Cambiar foto de perfil</span>
              </label>

              <input
                ref={nuevaFotoRef}
                id="foto-upload"
                type="file"
                onChange={handleFotoChange}
                accept="image/png,image/jpeg,image/jpg"
                className="sr-only"
              />
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight ev-enter ev-d-1">
                {datos.nombre || 'Tu perfil'}
              </h1>
              <p className="mt-1.5 text-blue-100 text-sm sm:text-base ev-enter ev-d-2">{datos.email}</p>
            </div>

            <button
              type="button"
              onClick={cerrarSesion}
              className="ev-btn ev-focusable ev-enter ev-d-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-white/25"
            >
              <Icono nombre="salir" className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* ---------------- FOTO PENDIENTE ---------------- */}
        {nuevaFoto && (
          <div className="ev-panel-glass ev-card-dash ev-view relative mt-6 overflow-hidden rounded-2xl border-amber-200 dark:border-amber-500/35 bg-amber-50/70 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400 text-white">
                <Icono nombre="camara" className="w-5 h-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-bold text-amber-900">Foto lista para subir</p>
                <p className="truncate text-sm text-amber-700">{nuevaFoto.name}</p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={cancelarFoto}
                  disabled={subiendoFoto}
                  className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                >
                  <Icono nombre="cerrar" className="w-4 h-4" />
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={subirFoto}
                  disabled={subiendoFoto}
                  className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-amber-600 disabled:opacity-60"
                >
                  <Icono nombre="check" className="w-4 h-4" />
                  {subiendoFoto ? 'Subiendo…' : 'Subir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {errorFoto && (
          <div className="ev-view mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <Icono nombre="alerta" className="w-4 h-4 shrink-0" />
            {errorFoto}
          </div>
        )}

        {/* ---------------- DATOS ---------------- */}
        <form onSubmit={handleUpdate} className="ev-panel-glass ev-card-dash relative mt-6 overflow-hidden rounded-2xl p-6 sm:p-8 ev-enter ev-d-3">
          <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />
          <span aria-hidden="true" className="ev-esquina" />

          <div className="relative space-y-5">
            <div>
              <label htmlFor="perfil-nombre" className="ev-field-label block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nombre
              </label>
              <div className="ev-field">
                <input
                  id="perfil-nombre"
                  type="text"
                  value={datos.nombre}
                  onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-base text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="perfil-email" className="ev-field-label block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Correo institucional
              </label>
              <input
                id="perfil-email"
                type="email"
                value={datos.email}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-base text-slate-500 dark:text-slate-400"
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                El correo no se puede cambiar porque identifica tu cuenta en la universidad.
              </p>
            </div>

            {datos.foto_url && (
              <button
                type="button"
                onClick={usarIniciales}
                className="ev-focusable cursor-pointer text-sm font-bold text-blue-600 hover:underline"
              >
                Quitar la foto y usar mis iniciales
              </button>
            )}

            <hr className="ev-divisor" />

            <button
              type="submit"
              disabled={guardando}
              className="ev-btn ev-shimmer inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
            >
              <Icono nombre="check" className="w-5 h-5" />
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>

        {/* ---------------- MODULOS ---------------- */}
        <section className="mt-6" aria-label="Módulos">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Tus módulos</h2>

          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { to: '/biblioteca', label: 'Biblioteca', desc: 'Apuntes y materiales', img: '/modulos/biblioteca.png' },
              { to: '/gestor-equipos', label: 'Gestor de equipos', desc: 'Tareas y tableros', img: '/modulos/gestor-equipos.png' },
              { to: '/mis-apuntes', label: 'Mis apuntes', desc: 'Lo que compartiste', img: '/modulos/biblioteca.png' },
              { to: '/favoritos', label: 'Mis favoritos', desc: 'Guardados para vos', img: null },
            ].map((m) => (
              <li key={m.to}>
                <Link
                  to={m.to}
                  className="ev-panel-glass ev-card-dash group flex items-center gap-3 rounded-2xl p-4"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 transition-transform duration-300 group-hover:scale-110">
                    {m.img ? (
                      <img src={m.img} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
                    ) : (
                      <span aria-hidden="true" className="text-xl">⭐</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 transition-colors">
                      {m.label}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{m.desc}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default Profile;
