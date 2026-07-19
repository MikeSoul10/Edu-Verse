import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const MyNotes = () => {
  const [misApuntes, setMisApuntes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const usuarioId = localStorage.getItem('usuario_id');

  const cargarMisApuntes = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/apuntes/mis-apuntes/${usuarioId}`);
      setMisApuntes(res.data);
    } catch {
      toast.error('Error cargando tus apuntes');
    } finally {
      setCargando(false);
    }
  }, [usuarioId]);

  const eliminarApunte = async (id) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este apunte?")) {
      try {
        await axios.delete(`${API_URL}/apuntes/${id}`);
        toast.success("Apunte eliminado correctamente");
        cargarMisApuntes(); // Recargamos la lista
      } catch (err) {
        toast.error("No se pudo eliminar");
      }
    }
  };

  useEffect(() => {
    cargarMisApuntes();
  }, [cargarMisApuntes]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-black text-gray-900 mb-8">Mis Apuntes Compartidos</h2>
      
      {cargando ? (
        <div className="text-center py-20 bg-gray-50 p-10 rounded-3xl border-2 border-dashed">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando tus apuntes...</p>
        </div>
      ) : misApuntes.length === 0 ? (
        <div className="bg-gray-50 p-10 rounded-3xl border-2 border-dashed text-center">
          <p className="text-gray-500">Aún no has subido ningún apunte. ¡Anímate!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {misApuntes.map((apunte) => (
            <div key={apunte.apunte_id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
              <div>
                <h4 className="font-bold text-lg text-gray-900">{apunte.titulo}</h4>
                <p className="text-sm text-gray-500">{apunte.materia}</p>
              </div>
              <div className="flex gap-3">
                <a 
                  href={`${API_URL}${apunte.archivo_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100"
                >
                  Ver
                </a>
                <button 
                  onClick={() => eliminarApunte(apunte.apunte_id)}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyNotes;