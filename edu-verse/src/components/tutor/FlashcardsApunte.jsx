import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EstudioAPI, TutorAPI, mensajeErrorTutor } from '../../services/api';
import Flashcards from './Flashcards';
import { IndicadorCarga } from './SesionEstudio';

const PASOS = ['Leyendo el apunte…', 'Eligiendo conceptos clave…', 'Escribiendo las tarjetas…'];

/* "Crear flashcards de este apunte": genera un mazo con el texto ya indexado
   del apunte (cada tarjeta recuerda su página). Si el apunte es muy largo, el
   servidor pide un rango de páginas. Si el usuario ya tiene mazo de este
   apunte, ofrece estudiarlo o regenerarlo. */
export default function FlashcardsApunte({ apunte }) {
  const [mazo, setMazo] = useState(null);        // mazo propio de este apunte (resumen)
  const [abierto, setAbierto] = useState(null);  // mazo completo en estudio
  const [generando, setGenerando] = useState(false);
  const [rango, setRango] = useState(null);      // { min, max } cuando el servidor pide elegir
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const listo = apunte.estado_indexado === 'listo';

  const cargarMazo = useCallback(() => {
    EstudioAPI.getMazos({ apunte_id: apunte.apunte_id })
      .then(({ data }) => setMazo(data.find((m) => m.es_autor && m.origen === 'apunte') || null))
      .catch(() => setMazo(null));
  }, [apunte.apunte_id]);

  useEffect(() => { cargarMazo(); }, [cargarMazo]);

  const abrir = async (id) => {
    try {
      const { data } = await TutorAPI.getMazo(id);
      setAbierto(data);
    } catch (err) {
      toast.error(mensajeErrorTutor(err));
    }
  };

  const generar = async (conRango = false) => {
    setGenerando(true);
    try {
      const cuerpo = conRango ? { pagina_desde: Number(desde) || undefined, pagina_hasta: Number(hasta) || undefined } : {};
      const { data } = await EstudioAPI.flashcardsDeApunte(apunte.apunte_id, cuerpo);
      setRango(null);
      setAbierto(data);
      cargarMazo();
      toast.success(`${data.tarjetas.length} flashcards listas`);
    } catch (err) {
      const datos = err.response?.data;
      if (err.response?.status === 422 && datos?.codigo === 'muy_largo' && datos.paginas) {
        setRango(datos.paginas);
        setDesde((d) => d || String(datos.paginas.min));
        setHasta((h) => h || String(Math.min(datos.paginas.max, datos.paginas.min + 9)));
        toast(datos.mensaje, { icon: '📄' });
      } else {
        toast.error(mensajeErrorTutor(err), { duration: 6000 });
      }
    } finally {
      setGenerando(false);
    }
  };

  const registrarRepaso = useCallback((tarjetaId, resultado) => {
    EstudioAPI.repaso(tarjetaId, resultado).catch((err) => toast.error(mensajeErrorTutor(err)));
  }, []);

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

  const botonClaro = 'ev-btn inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white/15 px-5 py-3.5 text-lg font-bold text-white ring-1 ring-white/40 backdrop-blur hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60';

  if (!listo) {
    return (
      <span className="inline-flex items-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white/80" title="El Tutor IA necesita leer el texto del apunte primero.">
        🃏 {apunte.estado_indexado === 'error' ? 'No se pudo leer este apunte para crear flashcards' : 'Preparando el apunte para crear flashcards…'}
      </span>
    );
  }

  return (
    <>
      {mazo ? (
        <>
          <button type="button" onClick={() => abrir(mazo.id)} className={botonClaro}>
            🃏 Estudiar mis flashcards{mazo.pendientes_hoy ? ` (${mazo.pendientes_hoy} hoy)` : ''}
          </button>
          <button type="button" onClick={() => generar(false)} disabled={generando} className={`${botonClaro} text-base`} title="Reemplaza tu mazo de este apunte (y su progreso)">
            {generando ? 'Generando…' : '↻ Regenerar'}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => generar(false)} disabled={generando} className={botonClaro}>
          🃏 {generando ? 'Generando flashcards…' : 'Crear flashcards de este apunte'}
        </button>
      )}

      {rango && (
        <form
          onSubmit={(e) => { e.preventDefault(); generar(true); }}
          className="flex w-full flex-wrap items-end gap-2 rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/30"
        >
          <p className="w-full text-sm font-semibold">El apunte es largo: elige qué páginas usar (tiene de la {rango.min} a la {rango.max}).</p>
          <label className="text-sm">
            Desde
            <input type="number" min={rango.min} max={rango.max} value={desde} onChange={(e) => setDesde(e.target.value)} className="ml-1 w-20 rounded-lg px-2 py-1 text-slate-900" />
          </label>
          <label className="text-sm">
            Hasta
            <input type="number" min={rango.min} max={rango.max} value={hasta} onChange={(e) => setHasta(e.target.value)} className="ml-1 w-20 rounded-lg px-2 py-1 text-slate-900" />
          </label>
          <button type="submit" disabled={generando} className="cursor-pointer rounded-lg bg-white px-4 py-1.5 font-bold text-blue-700 disabled:opacity-60">
            {generando ? 'Generando…' : 'Crear'}
          </button>
          <button type="button" onClick={() => setRango(null)} className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10">Cancelar</button>
        </form>
      )}

      {generando && (
        <div className="fixed inset-x-3 bottom-6 z-40 mx-auto max-w-md text-left">
          <IndicadorCarga pasos={PASOS} intervalo={7000} />
        </div>
      )}

      {abierto && (
        <Flashcards
          key={abierto.id}
          mazo={abierto}
          onCerrar={() => { setAbierto(null); cargarMazo(); }}
          onRepaso={registrarRepaso}
          onEditar={editarTarjeta}
          onEliminar={eliminarTarjeta}
          onRegenerar={() => { setAbierto(null); generar(false); }}
          regenerando={generando}
        />
      )}
    </>
  );
}
