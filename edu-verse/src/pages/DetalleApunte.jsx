import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const CLAVE_ULTIMO = 'eduverse_ultimo_apunte';

const paletaTono = (materia = '') => {
  const t = [{ f: 'from-blue-500 to-indigo-600', c: 'bg-blue-50 text-blue-700', p: '#3b82f6' },
             { f: 'from-violet-500 to-purple-600', c: 'bg-violet-50 text-violet-700', p: '#8b5cf6' },
             { f: 'from-emerald-500 to-teal-600', c: 'bg-emerald-50 text-emerald-700', p: '#10b981' },
             { f: 'from-amber-500 to-orange-600', c: 'bg-amber-50 text-amber-700', p: '#f59e0b' },
             { f: 'from-rose-500 to-red-600', c: 'bg-rose-50 text-rose-700', p: '#ec4899' },
             { f: 'from-cyan-500 to-sky-600', c: 'bg-cyan-50 text-cyan-700', p: '#06b6d4' }];
  let h = 0;
  for (let i = 0; i < materia.length; i++) h = (h * 31 + materia.charCodeAt(i)) % 9973;
  return t[h % t.length];
};

const DetalleApunte = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [apunte, setApunte] = useState(null);
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState('');
  const [comentarios, setComentarios] = useState([]);
  
  const heroRef = useRef(null);
  const heroGlowRef = useRef(null);
  const heroRafRef = useRef(0);
  
  const usuarioId = localStorage.getItem('usuario_id');
  const nombreUsuario = localStorage.getItem('usuario');

  // 1. Cargar datos del apunte y sus comentarios desde la DB
  const cargarDatos = useCallback(async () => {
    try {
      const resApunte = await axios.get(`${API_URL}/apuntes/detalle/${id}`);
      setApunte(resApunte.data);

      // Guardamos el apunte completo (con su materia/autor) para que la
      // biblioteca pueda mostrarlo como "último visto" sin otra peticion.
      localStorage.setItem(CLAVE_ULTIMO, JSON.stringify({
        apunte_id: resApunte.data.apunte_id,
        titulo: resApunte.data.titulo,
        materia: resApunte.data.materia,
        autor: resApunte.data.autor,
      }));

      const resComentarios = await axios.get(`${API_URL}/comentarios/${id}`);
      setComentarios(resComentarios.data);
    } catch {
      toast.error("No se pudo cargar la información");
    }
  }, [id]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // 2. Función para enviar comentario y calificación a la DB
  const enviarComentario = async (e) => {
    e.preventDefault();

    if (!usuarioId) return toast.error("Debes iniciar sesión para comentar");
    if (rating === 0) return toast.warning("Por favor, selecciona una puntuación (estrellas)");

    try {
      // Enviamos el comentario
      await axios.post(`${API_URL}/comentarios`, {
        apunte_id: id,
        usuario_id: usuarioId,
        texto: comentario
      });

      // Enviamos la valoración (rating)
      await axios.post(`${API_URL}/valoraciones`, {
        apunte_id: id,
        usuario_id: usuarioId,
        estrellas: rating
      });

      toast.success("¡Gracias por tu opinión! ⭐");
      
      // Limpiamos campos y refrescamos datos
      setComentario('');
      setRating(0);
      cargarDatos(); 
      
    } catch {
      toast.error("Error al publicar tu comentario");
    }
  };

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

  if (!apunte) return (
    <div className="ev-bg-nexo min-h-screen flex justify-center items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
    </div>
  );

  const tono = paletaTono(apunte.materia);
  // OJO: `rating` es el estado de las estrellas que esta elegiendo el usuario.
  // El promedio del apunte va en su propia variable para no sombrearlo.
  const promedio = parseFloat(apunte.promedio_rating || 0);

  return (
    <div className="ev-bg-nexo min-h-[calc(100vh-64px)] font-['Fredoka',sans-serif] relative">
      <div className="ev-gridfield absolute inset-0 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Boton volver */}
        <button
          type="button"
          onClick={() => navigate('/biblioteca')}
          className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 mb-5 text-slate-600 hover:text-blue-700 font-bold"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver a la biblioteca
        </button>

        {/* HEADER */}
        <header
          ref={heroRef}
          onMouseMove={handleHeroPointerMove}
          className="ev-mesh relative overflow-hidden rounded-[2rem] text-white shadow-lg ev-enter ev-d-0"
        >
          <div ref={heroGlowRef} className="ev-glow" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-14 -left-14 h-48 w-48 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-amber-400/20 blur-2xl" />
          <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30 pointer-events-none" />

          <div className="relative p-6 sm:p-10 lg:p-12">
            <span className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-wider ${tono.c} ev-enter ev-d-1`}>
              {apunte.materia || 'Sin materia'}
            </span>

            <h1 className="mt-3 text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight ev-enter ev-d-2">
              {apunte.titulo}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-blue-100 ev-enter ev-d-3">
              <span className="inline-flex items-center gap-2">
                <span className="grid place-items-center w-7 h-7 rounded-full bg-white/20 text-[11px] font-bold text-white">
                  {(apunte.autor || '?').charAt(0).toUpperCase()}
                </span>
                {apunte.autor || 'Anónimo'}
              </span>

              {promedio > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-300" aria-hidden="true">
                    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
                  </svg>
                  <span className="font-bold text-white">{promedio.toFixed(1)}</span>
                </span>
              )}

              {comentarios.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  {comentarios.length} {comentarios.length === 1 ? 'comentario' : 'comentarios'}
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 ev-enter ev-d-4">
              <a
                href={`${API_URL}${apunte.archivo_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ev-btn ev-shimmer inline-flex items-center gap-2 rounded-2xl bg-white text-blue-700 px-6 sm:px-8 py-3.5 text-lg font-bold shadow-md"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden="true">
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                  <path d="M14 3v5h5" strokeLinejoin="round" />
                </svg>
                Abrir PDF
              </a>
            </div>
          </div>
        </header>

        {/* CONTENIDO */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal: descripcion + comentarios */}
          <div className="lg:col-span-2 min-w-0 space-y-6">
            {/* Descripcion */}
            <section className="ev-panel-glass ev-card-dash relative overflow-hidden rounded-2xl p-6 sm:p-7 ev-enter ev-d-2">
              <div aria-hidden="true" className="pointer-events-none absolute -top-14 -right-10 h-36 w-36 rounded-full bg-blue-200/30 blur-2xl" />
              <span aria-hidden="true" className="ev-esquina" />

              <h2 className="relative text-base font-black uppercase tracking-widest text-slate-500">
                Sobre este material
              </h2>
              <p className="relative mt-3 text-slate-700 leading-relaxed">
                {apunte.descripcion || 'Sin descripción proporcionada.'}
              </p>
            </section>

            {/* Comentarios */}
            <section className="ev-panel-glass ev-card-dash relative overflow-hidden rounded-2xl p-6 sm:p-7 ev-enter ev-d-3">
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-amber-300/20 blur-2xl" />

              <h2 className="relative text-base font-black uppercase tracking-widest text-slate-500">
                Comunidades y dudas ({comentarios.length})
              </h2>

              {comentarios.length === 0 ? (
                <div className="relative mt-6 rounded-2xl border-2 border-dashed border-blue-100 py-10 text-center ev-view">
                  <span className="mx-auto grid w-14 h-14 place-items-center rounded-2xl bg-blue-50 text-blue-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7" aria-hidden="true">
                      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8z" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="mt-4 font-bold text-slate-700">Nadie ha comentado todavía</p>
                  <p className="mt-1 text-sm text-slate-500">Sé la primera persona en compartir sus dudas con la comunidad.</p>
                </div>
              ) : (
                <ul className="relative mt-6 space-y-4">
                  {comentarios.map((c, i) => (
                    <li
                      key={c.comentario_id}
                      className={`rounded-2xl border border-white/70 bg-white/85 p-5 ev-enter ${['ev-d-0', 'ev-d-1', 'ev-d-2'][i % 3]}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <span className="flex items-center gap-3 min-w-0">
                          <span className={`grid place-items-center w-9 h-9 shrink-0 rounded-full bg-gradient-to-br ${tono.f} text-xs font-bold text-white`}>
                            {(c.nombre || '?').charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate font-bold text-slate-800 text-sm">{c.nombre}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-slate-400">
                          {new Date(c.fecha_creacion).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{c.texto}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Formulario lateral */}
          <section className="ev-panel-glass ev-card-dash relative overflow-hidden rounded-2xl p-6 h-fit lg:sticky lg:top-6 ev-enter ev-d-3">
            <div aria-hidden="true" className="pointer-events-none absolute -top-12 -left-8 h-32 w-32 rounded-full bg-blue-200/30 blur-2xl" />
            <span aria-hidden="true" className="ev-esquina" />

            <div className="relative">
              <h2 className="text-base font-black uppercase tracking-widest text-slate-500">
                Tu opinión importa
              </h2>

              <form onSubmit={enviarComentario} className="mt-5">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Califica la calidad
                </label>
                <div className="flex items-center gap-1 mb-5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`Calificar con ${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                      className="ev-focusable ev-estrella p-1 transition-transform hover:scale-125"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className={`w-7 h-7 transition-colors ${rating >= star ? 'text-amber-400' : 'text-slate-200'}`}
                        aria-hidden="true"
                      >
                        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
                      </svg>
                    </button>
                  ))}
                </div>

                <div className="ev-field">
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-base mb-4 transition-all"
                    placeholder="¿Qué te pareció este apunte?"
                    rows="4"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    required
                  />
                </div>

                <button className="ev-btn ev-shimmer w-full cursor-pointer rounded-2xl bg-blue-600 py-3.5 text-lg font-bold text-white shadow-md hover:bg-blue-700">
                  Publicar comentario
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DetalleApunte;