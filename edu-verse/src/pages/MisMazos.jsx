import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { EquiposAPI, EstudioAPI, TutorAPI, mensajeErrorTutor } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Flashcards from '../components/tutor/Flashcards';
import BarraCajas from '../components/tutor/BarraCajas';

/* Mis mazos: todos los mazos del usuario y los que le compartieron sus
   equipos, con "Repasar hoy" (repetición espaciada de todos los mazos), la
   barra de cajas de cada mazo y la opción de compartir con un equipo. */

function CompartirMazo({ mazo, equipos, onCambio }) {
  const [equipoId, setEquipoId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const disponibles = equipos.filter((e) => !mazo.equipos.some((c) => c.equipo_id === e.equipo_id));

  const compartir = async () => {
    if (!equipoId) return;
    setOcupado(true);
    try {
      const { data } = await EstudioAPI.compartir(mazo.id, Number(equipoId));
      onCambio(mazo.id, data.equipos);
      setEquipoId('');
      toast.success('Mazo compartido. Avisamos en el chat del equipo.');
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    } finally {
      setOcupado(false);
    }
  };

  const quitar = async (equipo) => {
    try {
      const { data } = await EstudioAPI.dejarDeCompartir(mazo.id, equipo.equipo_id);
      onCambio(mazo.id, data.equipos);
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
      {mazo.equipos.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Equipos con los que se comparte">
          {mazo.equipos.map((e) => (
            <li key={e.equipo_id} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
              👥 {e.nombre}
              <button type="button" onClick={() => quitar(e)} className="grid h-5 w-5 cursor-pointer place-items-center rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-500/30" aria-label={`Dejar de compartir con ${e.nombre}`} title="Dejar de compartir">✕</button>
            </li>
          ))}
        </ul>
      )}
      {equipos.length === 0 ? (
        <p className="text-xs text-slate-500">Únete a un equipo en el Gestor de Equipos para compartir tus mazos.</p>
      ) : disponibles.length === 0 ? (
        <p className="text-xs text-slate-500">Ya está compartido con todos tus equipos.</p>
      ) : (
        <div className="flex gap-2">
          <label htmlFor={`equipo-${mazo.id}`} className="sr-only">Equipo</label>
          <select
            id={`equipo-${mazo.id}`}
            value={equipoId}
            onChange={(e) => setEquipoId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Compartir con un equipo…</option>
            {disponibles.map((e) => <option key={e.equipo_id} value={e.equipo_id}>{e.nombre}</option>)}
          </select>
          <button type="button" onClick={compartir} disabled={!equipoId || ocupado} className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            Compartir
          </button>
        </div>
      )}
      <p className="mt-2 text-[0.7rem] text-slate-400">Los miembros pueden estudiarlo con su propio progreso; solo tú lo editas.</p>
    </div>
  );
}

export default function MisMazos() {
  const { user } = useAuth();
  const [mazos, setMazos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [equipos, setEquipos] = useState([]);
  const [pendientesHoy, setPendientesHoy] = useState(0);
  const [abierto, setAbierto] = useState(null);        // mazo en estudio
  const [compartiendo, setCompartiendo] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([EstudioAPI.getMazos(), EstudioAPI.conteoHoy()]);
      setMazos(m.data);
      setPendientesHoy(c.data.total);
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!user?.id) return;
    EquiposAPI.getMisEquipos(user.id).then(({ data }) => setEquipos(data)).catch(() => setEquipos([]));
  }, [user?.id]);

  const registrarRepaso = useCallback((tarjetaId, resultado) => {
    EstudioAPI.repaso(tarjetaId, resultado).catch((err) => toast.error(mensajeErrorTutor(err)));
  }, []);

  const abrirMazo = async (id) => {
    try {
      const { data } = await TutorAPI.getMazo(id);
      setAbierto(data);
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  const repasarHoy = async () => {
    try {
      const { data } = await EstudioAPI.repasosHoy();
      if (data.tarjetas.length === 0) {
        toast.success('¡Nada pendiente por hoy!');
        return;
      }
      setAbierto({ id: 'hoy', tema: 'Repasar hoy', es_autor: false, tarjetas: data.tarjetas, virtual: true });
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  const cerrar = () => {
    setAbierto(null);
    cargar(); // refresca cajas y pendientes con lo que se acaba de estudiar
  };

  const eliminar = async (mazo) => {
    if (!window.confirm(`¿Eliminar el mazo "${mazo.tema}"? También se borra el progreso de quienes lo estudian.`)) return;
    try {
      await EstudioAPI.eliminarMazo(mazo.id);
      setMazos((l) => l.filter((m) => m.id !== mazo.id));
      toast.success('Mazo eliminado');
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  const editarTarjeta = async (id, cambios) => {
    try {
      const { data } = await TutorAPI.editarTarjeta(id, cambios);
      setAbierto((m) => ({ ...m, tarjetas: m.tarjetas.map((t) => (t.id === id ? data : t)) }));
      return true;
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
      return false;
    }
  };

  const eliminarTarjeta = async (id) => {
    try {
      await TutorAPI.eliminarTarjeta(id);
      setAbierto((m) => ({ ...m, tarjetas: m.tarjetas.filter((t) => t.id !== id) }));
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  const propios = mazos.filter((m) => m.es_autor);
  const compartidos = mazos.filter((m) => !m.es_autor);

  const tarjetaMazo = (m) => (
    <li key={m.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-800">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-extrabold text-slate-900 dark:text-white" title={m.tema}>{m.tema}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {m.total} tarjetas
            {m.origen === 'apunte' && m.apunte_id ? (
              <> · 📄 de <Link to={`/apunte/${m.apunte_id}`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">{m.apunte_titulo || 'un apunte'}</Link></>
            ) : m.sesion_id ? (
              <> · 🤖 de <Link to={`/tutor/${m.sesion_id}`} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-300">una sesión del tutor</Link></>
            ) : null}
            {!m.es_autor && <> · compartido por {m.autor}{m.equipos.length ? ` en ${m.equipos.map((e) => e.nombre).join(', ')}` : ''}</>}
          </p>
        </div>
        {m.pendientes_hoy > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">{m.pendientes_hoy} para hoy</span>
        )}
      </div>
      <div className="mt-3"><BarraCajas cajas={m.cajas} compacta /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => abrirMazo(m.id)} disabled={m.total === 0} className="cursor-pointer rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
          Estudiar
        </button>
        {m.es_autor && (
          <>
            <button type="button" onClick={() => setCompartiendo(compartiendo === m.id ? null : m.id)} aria-expanded={compartiendo === m.id} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
              👥 Compartir{m.equipos.length ? ` (${m.equipos.length})` : ''}
            </button>
            <button type="button" onClick={() => eliminar(m)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" aria-label={`Eliminar ${m.tema}`} title="Eliminar mazo">🗑</button>
          </>
        )}
      </div>
      {compartiendo === m.id && (
        <CompartirMazo mazo={m} equipos={equipos} onCambio={(id, eqs) => setMazos((l) => l.map((x) => (x.id === id ? { ...x, equipos: eqs } : x)))} />
      )}
    </li>
  );

  return (
    <main className="ev-home-fondo relative isolate min-h-screen px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link to="/tutor" className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300">← Tutor IA</Link>
          <h1 className="w-full text-3xl font-black text-slate-900 dark:text-white">🃏 Mis mazos</h1>
        </div>

        <section className="ev-enter mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-lg">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black">Repasar hoy ({pendientesHoy})</p>
            <p className="text-sm text-indigo-100">
              Repetición espaciada: cada tarjeta vuelve en 1, 3, 7, 14 o 30 días según cuántas veces la sabes.
            </p>
          </div>
          <button type="button" onClick={repasarHoy} disabled={pendientesHoy === 0} className="cursor-pointer rounded-xl bg-white px-5 py-2.5 font-bold text-indigo-700 shadow-md hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60">
            {pendientesHoy === 0 ? 'Todo al día ✓' : 'Empezar repaso →'}
          </button>
        </section>

        {cargando ? (
          <p className="py-10 text-center text-slate-500">Cargando mazos…</p>
        ) : mazos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600">
            Aún no tienes mazos. Créalos desde una sesión del <Link to="/tutor" className="font-semibold text-indigo-600 hover:underline">Tutor IA</Link> o
            desde cualquier apunte de la <Link to="/biblioteca" className="font-semibold text-indigo-600 hover:underline">Biblioteca</Link>.
          </div>
        ) : (
          <>
            {propios.length > 0 && (
              <section aria-label="Mis mazos" className="mb-8">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Creados por mí</h2>
                <ul className="grid gap-3 sm:grid-cols-2">{propios.map(tarjetaMazo)}</ul>
              </section>
            )}
            {compartidos.length > 0 && (
              <section aria-label="Compartidos conmigo">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Compartidos por mis equipos</h2>
                <ul className="grid gap-3 sm:grid-cols-2">{compartidos.map(tarjetaMazo)}</ul>
              </section>
            )}
          </>
        )}
      </div>

      {abierto && (
        <Flashcards
          key={abierto.id}
          mazo={abierto}
          onCerrar={cerrar}
          onRepaso={registrarRepaso}
          onEditar={editarTarjeta}
          onEliminar={eliminarTarjeta}
          subtitulo={abierto.virtual ? `${abierto.tarjetas.length} tarjetas de todos tus mazos` : undefined}
        />
      )}
    </main>
  );
}
