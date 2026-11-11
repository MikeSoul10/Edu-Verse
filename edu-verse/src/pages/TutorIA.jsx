import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TutorAPI, EstudioAPI, mensajeErrorTutor } from '../services/api';
import FormularioTema from '../components/tutor/FormularioTema';
import { descargarApuntes } from '../components/tutor/utilidades';
import SesionEstudio, { IndicadorCarga } from '../components/tutor/SesionEstudio';
import Flashcards from '../components/tutor/Flashcards';

const PASOS_FLASHCARDS = ['Leyendo lo que investigaste…', 'Eligiendo conceptos clave…', 'Escribiendo las tarjetas…'];

const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export default function TutorIA() {
  const { sesionId } = useParams();
  const navigate = useNavigate();

  const [sesiones, setSesiones] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(false);
  const [errorSesion, setErrorSesion] = useState('');
  // Pregunta en curso (se muestra mientras la IA responde) y tipo de espera.
  const [pendiente, setPendiente] = useState(null);
  const [creando, setCreando] = useState(null);
  const [mazo, setMazo] = useState(null);
  const [mostrarMazo, setMostrarMazo] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [pendientesHoy, setPendientesHoy] = useState(0);

  const ocupado = Boolean(pendiente || creando);

  const cargarSesiones = useCallback(async () => {
    try {
      const { data } = await TutorAPI.getSesiones();
      setSesiones(data);
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    } finally {
      setCargandoLista(false);
    }
  }, []);

  // Tarjetas que tocan hoy en todos los mazos (repetición espaciada).
  const cargarPendientes = useCallback(() => {
    EstudioAPI.conteoHoy().then(({ data }) => setPendientesHoy(data.total)).catch(() => {});
  }, []);

  useEffect(() => { cargarSesiones(); cargarPendientes(); }, [cargarSesiones, cargarPendientes]);

  // Cambio de sesión por URL.
  useEffect(() => {
    setMazo(null);
    setMostrarMazo(false);
    setErrorSesion('');
    setListaAbierta(false);
    if (!sesionId) { setSesion(null); return undefined; }

    let vigente = true;
    setCargandoSesion(true);
    TutorAPI.getSesion(sesionId)
      .then(({ data }) => { if (vigente) setSesion(data); })
      .catch((err) => {
        if (!vigente) return;
        setSesion(null);
        setErrorSesion(err.response?.status === 404 ? 'Esta sesión no existe o no es tuya.' : mensajeErrorTutor(err));
      })
      .finally(() => { if (vigente) setCargandoSesion(false); });
    return () => { vigente = false; };
  }, [sesionId]);

  const crearSesion = async (datos) => {
    setCreando(datos);
    try {
      const { data } = await TutorAPI.crearSesion(datos);
      setSesion(data);
      cargarSesiones();
      navigate(`/tutor/${data.id}`);
    } catch (err) {
      toast.error(mensajeErrorTutor(err), { duration: 6000 });
    } finally {
      setCreando(null);
    }
  };

  const preguntar = async (pregunta) => {
    if (!sesion || ocupado) return;
    const id = sesion.id;
    setPendiente(pregunta);
    try {
      const { data } = await TutorAPI.preguntar(id, pregunta);
      setSesion((s) => (s && s.id === id ? { ...s, mensajes: [...s.mensajes, ...data.mensajes] } : s));
      cargarSesiones();
    } catch (err) {
      toast.error(mensajeErrorTutor(err), { duration: 6000 });
    } finally {
      setPendiente(null);
    }
  };

  const eliminarSesion = async () => {
    if (!sesion || !window.confirm(`¿Eliminar la sesión "${sesion.tema}" y sus flashcards?`)) return;
    try {
      await TutorAPI.eliminarSesion(sesion.id);
      toast.success('Sesión eliminada');
      setSesiones((l) => l.filter((s) => s.id !== sesion.id));
      navigate('/tutor');
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  const generarMazo = async () => {
    if (!sesion) return;
    const id = sesion.id;
    setGenerando(true);
    try {
      const { data: nuevo } = await TutorAPI.generarFlashcards(id);
      // Se vuelve a leer para traer cajas y permisos del mismo modo que al abrirlo.
      const { data } = await TutorAPI.getMazo(nuevo.id);
      setMazo(data);
      setMostrarMazo(true);
      setSesion((s) => (s && s.id === id ? { ...s, mazo_id: data.id } : s));
      cargarSesiones();
      cargarPendientes();
      toast.success(`${data.tarjetas.length} flashcards listas`);
    } catch (err) {
      toast.error(mensajeErrorTutor(err), { duration: 6000 });
    } finally {
      setGenerando(false);
    }
  };

  const abrirFlashcards = async () => {
    if (!sesion) return;
    if (!sesion.mazo_id) { generarMazo(); return; }
    // Siempre se relee: las cajas cambian con cada repaso.
    try {
      const { data } = await TutorAPI.getMazo(sesion.mazo_id);
      setMazo(data);
      setMostrarMazo(true);
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  const registrarRepaso = useCallback((tarjetaId, resultado) => {
    EstudioAPI.repaso(tarjetaId, resultado).catch((err) => toast.error(mensajeErrorTutor(err)));
  }, []);

  const cerrarMazo = () => {
    setMostrarMazo(false);
    cargarPendientes();
  };

  const editarTarjeta = async (id, cambios) => {
    try {
      const { data } = await TutorAPI.editarTarjeta(id, cambios);
      setMazo((m) => ({ ...m, tarjetas: m.tarjetas.map((t) => (t.id === id ? data : t)) }));
      return true;
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
      return false;
    }
  };

  const eliminarTarjeta = async (id) => {
    try {
      await TutorAPI.eliminarTarjeta(id);
      setMazo((m) => ({ ...m, tarjetas: m.tarjetas.filter((t) => t.id !== id) }));
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  const listaSesiones = (
    <nav aria-label="Tus sesiones" className="flex flex-col gap-1.5">
      <Link
        to="/tutor"
        className="ev-focusable mb-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:shadow-md"
      >
        ＋ Nuevo tema
      </Link>
      <Link
        to="/tutor/mazos"
        className="ev-focusable mb-2 flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 font-semibold text-violet-800 transition hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
      >
        <span>🃏 Mis mazos</span>
        {pendientesHoy > 0 && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-blue-950" title="Tarjetas para repasar hoy">
            Repasar hoy ({pendientesHoy})
          </span>
        )}
      </Link>
      {cargandoLista ? (
        <p className="px-2 text-sm text-slate-400">Cargando…</p>
      ) : sesiones.length === 0 ? (
        <p className="px-2 text-sm text-slate-500 dark:text-slate-400">Aún no tienes sesiones. ¡Empieza con un tema!</p>
      ) : (
        sesiones.map((s) => {
          const activa = String(s.id) === sesionId;
          return (
            <Link
              key={s.id}
              to={`/tutor/${s.id}`}
              aria-current={activa ? 'page' : undefined}
              className={`ev-focusable block rounded-xl px-3 py-2.5 transition-colors ${activa ? 'bg-indigo-100 dark:bg-indigo-500/20' : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}
            >
              <span className={`block truncate font-semibold ${activa ? 'text-indigo-800 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-200'}`}>{s.tema}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {fechaCorta(s.actualizado)} · {s.respuestas} {s.respuestas === 1 ? 'respuesta' : 'respuestas'}{s.tarjetas > 0 ? ` · 🃏 ${s.tarjetas}` : ''}
              </span>
            </Link>
          );
        })
      )}
    </nav>
  );

  let contenido;
  if (creando) {
    contenido = (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="flex justify-end">
          <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-white shadow-sm">{creando.tema}</p>
        </div>
        <IndicadorCarga />
      </div>
    );
  } else if (!sesionId) {
    contenido = <FormularioTema onCrear={crearSesion} cargando={ocupado} />;
  } else if (cargandoSesion) {
    contenido = <p className="py-16 text-center text-slate-500">Cargando sesión…</p>;
  } else if (errorSesion || !sesion) {
    contenido = (
      <div className="py-16 text-center">
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{errorSesion || 'No se pudo cargar la sesión.'}</p>
        <Link to="/tutor" className="mt-4 inline-block font-semibold text-indigo-600 hover:underline dark:text-indigo-300">← Volver al Tutor IA</Link>
      </div>
    );
  } else {
    contenido = (
      <>
        <SesionEstudio
          sesion={sesion}
          pendiente={pendiente}
          cargando={ocupado}
          generandoFlashcards={generando}
          onPreguntar={preguntar}
          onFlashcards={abrirFlashcards}
          onDescargar={() => descargarApuntes(sesion)}
          onEliminar={eliminarSesion}
        />
        {generando && !mostrarMazo && (
          <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md">
            <IndicadorCarga pasos={PASOS_FLASHCARDS} intervalo={7000} />
          </div>
        )}
        {mostrarMazo && mazo && (
          <Flashcards
            key={mazo.id}
            mazo={mazo}
            onCerrar={cerrarMazo}
            onRepaso={registrarRepaso}
            onRegenerar={generarMazo}
            regenerando={generando}
            onEditar={editarTarjeta}
            onEliminar={eliminarTarjeta}
          />
        )}
      </>
    );
  }

  return (
    <main className="ev-home-fondo relative isolate min-h-screen px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-6 lg:grid-cols-[17rem_1fr]">
        {/* Lista de sesiones: columna fija en escritorio, desplegable en móvil. */}
        <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/90">
            <button
              type="button"
              onClick={() => setListaAbierta((v) => !v)}
              aria-expanded={listaAbierta}
              className="flex w-full cursor-pointer items-center justify-between px-2 py-1 text-left font-black text-slate-800 dark:text-slate-100 lg:hidden"
            >
              <span>🤖 Tutor IA · Mis sesiones ({sesiones.length})</span>
              <span aria-hidden="true">{listaAbierta ? '▲' : '▼'}</span>
            </button>
            <h1 className="mb-3 hidden px-2 text-lg font-black text-slate-800 dark:text-slate-100 lg:block">🤖 Tutor IA</h1>
            <div className={`${listaAbierta ? 'mt-3 block' : 'hidden'} lg:block`}>{listaSesiones}</div>
          </div>
        </aside>

        <section className="min-w-0">{contenido}</section>
      </div>
    </main>
  );
}
