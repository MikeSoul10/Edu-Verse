import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_SIZE_MB = 10;

const esPdf = (f) => f?.type === 'application/pdf';

const formatoBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Icono = ({ nombre, className = 'w-5 h-5' }) => {
  const paths = {
    documento: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" /><path d="M14 3v5h5" strokeLinejoin="round" /></>,
    subir: <><path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" /></>,
    cerrar: <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />,
    check: <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />,
    alerta: <><path d="M12 9v4M12 17h.01" strokeLinecap="round" /><path d="M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round" /></>,
    reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></>,
    volver: <><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      {paths[nombre]}
    </svg>
  );
};

const Upload = () => {
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({ titulo: '', materia: '', descripcion: '' });
  const [cargando, setCargando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const navigate = useNavigate();

  const heroRef = useRef(null);
  const heroGlowRef = useRef(null);
  const heroRafRef = useRef(0);
  const inputRef = useRef(null);

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

  // Valida y guarda. Devuelve el motivo del rechazo para poder mostrarlo
  // dentro de la dropzone y no solo en un toast que se va solo.
  const recibirArchivo = useCallback((selected) => {
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      const msg = 'Formato no permitido. Usa PDF, PNG o JPG.';
      setErrorArchivo(msg);
      setFile(null);
      return toast.error(msg);
    }
    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      const msg = `El archivo excede ${MAX_SIZE_MB}MB.`;
      setErrorArchivo(msg);
      setFile(null);
      return toast.error(msg);
    }
    setErrorArchivo(null);
    setFile(selected);
  }, []);

  const quitarArchivo = () => {
    setFile(null);
    setErrorArchivo(null);
    // El input queda con el valor anterior: sin esto, volver a elegir el
    // mismo archivo no dispara onChange y el preview no se regenera.
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setArrastrando(false);
    recibirArchivo(e.dataTransfer.files?.[0]);
  };

  // El PDF se muestra con un iframe apuntando a la URL de objetos (blob).
  // Revocar la URL al cambiar de archivo evita filtrar memoria: el blob
  // queda retenido mientras el objeto exista.
  const previewUrl = file ? URL.createObjectURL(file) : null;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Por favor, selecciona un archivo (PDF o imagen)');

    setCargando(true);

    const data = new FormData();
    data.append('archivo', file);
    data.append('titulo', formData.titulo);
    data.append('materia', formData.materia);
    data.append('descripcion', formData.descripcion);
    data.append('usuario_id', localStorage.getItem('usuario_id'));

    try {
      await axios.post(`${API_URL}/apuntes/upload`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('¡Apunte compartido con éxito!', { duration: 3000 });
      navigate('/biblioteca');
    } catch (err) {
      setCargando(false);
      const mensaje = err.response?.data;
      toast.error(typeof mensaje === 'string' ? mensaje : 'Hubo un error al subir el archivo');
    }
  };

  return (
    <div className="ev-bg-nexo min-h-[calc(100vh-64px)] font-['Fredoka',sans-serif] relative">
      <div className="ev-gridfield absolute inset-0 pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-12">
        <button
          type="button"
          onClick={() => navigate('/biblioteca')}
          className="ev-btn ev-focusable inline-flex cursor-pointer items-center gap-2 mb-5 text-sm font-bold text-slate-600 hover:text-blue-700"
        >
          <Icono nombre="volver" className="w-4 h-4" />
          Volver a la biblioteca
        </button>

        {/* ---------------- HEADER ---------------- */}
        <header
          ref={heroRef}
          onMouseMove={handleHeroPointerMove}
          className="ev-mesh relative overflow-hidden rounded-[2rem] text-white shadow-lg ev-enter ev-d-0"
        >
          <div ref={heroGlowRef} className="ev-glow" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-14 -left-14 h-48 w-48 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-amber-400/20 blur-2xl" />
          <div aria-hidden="true" className="ev-dotfield absolute inset-0 opacity-30 pointer-events-none" />

          <div className="relative p-8 text-center sm:p-12">
            <span className="mx-auto grid w-16 h-16 place-items-center rounded-2xl bg-white/12 ring-2 ring-white/25">
              <Icono nombre="subir" className="w-8 h-8 text-amber-200" />
            </span>
            <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight ev-enter ev-d-1">
              Compartir apunte
            </h1>
            <p className="mt-3 text-blue-100 text-base sm:text-xl max-w-xl mx-auto ev-enter ev-d-2">
              Sube tu material de estudio y ayúdale a tu comunidad a repasar más rápido.
            </p>
          </div>
        </header>

        {/* ---------------- FORMULARIO ---------------- */}
        <form onSubmit={handleSubmit} className="ev-panel-glass ev-card-dash relative mt-6 overflow-hidden rounded-2xl p-5 sm:p-7 ev-enter ev-d-3">
          <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />
          <span aria-hidden="true" className="ev-esquina" />

          <div className="relative space-y-6">
            {/* Dropzone + preview: dos columnas en escritorio */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Zona de carga */}
              <div>
                <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Archivo
                </span>

                {!file ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                    onDragLeave={() => setArrastrando(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                      errorArchivo
                        ? 'border-red-300 bg-red-50/50'
                        : arrastrando
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
                    }`}
                  >
                    <span className={`grid w-14 h-14 place-items-center rounded-2xl ${errorArchivo ? 'bg-red-100 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                      <Icono nombre={errorArchivo ? 'alerta' : 'subir'} className="w-7 h-7" />
                    </span>

                    <p className="mt-4 text-base font-bold text-slate-700">
                      {errorArchivo ? 'Ese archivo no sirve' : 'Arrastrá tu archivo o hacé clic'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">PDF, PNG o JPG (máx. {MAX_SIZE_MB} MB)</p>
                    {errorArchivo && (
                      <p className="mt-2 text-sm font-semibold text-red-600">{errorArchivo}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3.5">
                    <span className="grid w-10 h-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white">
                      <Icono nombre="check" className="w-5 h-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-800">{file.name}</span>
                      <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                        {formatoBytes(file.size)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={quitarArchivo}
                      aria-label="Quitar archivo"
                      className="ev-focusable grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Icono nombre="cerrar" className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  className="sr-only"
                  onChange={(e) => recibirArchivo(e.target.files?.[0])}
                  accept=".pdf,.png,.jpg,.jpeg"
                />
              </div>

              {/* Preview */}
              <div>
                <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Vista previa
                </span>

                {file ? (
                  <div className="ev-view overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {esPdf(file) ? (
                      <iframe
                        src={previewUrl}
                        title={`Vista previa de ${file.name}`}
                        className="h-64 sm:h-72 w-full bg-white"
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt={`Vista previa de ${file.name}`}
                        className="h-64 sm:h-72 w-full object-contain bg-slate-100"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex h-64 sm:h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center">
                    <span className="grid w-14 h-14 place-items-center rounded-2xl bg-slate-100 text-slate-300">
                      <Icono nombre="documento" className="w-7 h-7" />
                    </span>
                    <p className="mt-3 text-sm font-medium text-slate-400">
                      La vista previa aparece acá
                    </p>
                  </div>
                )}
              </div>
            </div>

            <hr className="ev-divisor" />

            {/* Título y materia */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="up-titulo" className="ev-field-label block text-sm font-bold text-slate-700 mb-1.5">
                  Título del apunte
                </label>
                <div className="ev-field">
                  <input
                    id="up-titulo"
                    type="text"
                    placeholder="Ej: Resumen de Álgebra Lineal"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="up-materia" className="ev-field-label block text-sm font-bold text-slate-700 mb-1.5">
                  Materia
                </label>
                <div className="ev-field">
                  <input
                    id="up-materia"
                    type="text"
                    placeholder="Ej: Matemáticas II"
                    value={formData.materia}
                    onChange={(e) => setFormData({ ...formData, materia: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label htmlFor="up-descripcion" className="ev-field-label block text-sm font-bold text-slate-700 mb-1.5">
                Descripción <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <div className="ev-field">
                <textarea
                  id="up-descripcion"
                  rows="3"
                  placeholder="¿De qué trata este apunte? ¿Qué temas cubre?"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={cargando || !file}
              className={`ev-btn ev-shimmer inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl py-4 text-lg font-bold shadow-md ${
                cargando || !file ? 'bg-slate-300 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Icono nombre="subir" className="w-5 h-5" />
              {cargando ? 'Subiendo…' : 'Publicar apunte'}
            </button>

            <p className="text-center text-xs font-medium text-slate-400">
              Al publicar, el apunte queda visible para toda la comunidad de Edu-Verse.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Upload;
