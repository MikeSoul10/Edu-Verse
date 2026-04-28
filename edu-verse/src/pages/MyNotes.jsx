import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const MyNotes = () => {
  const [misApuntes, setMisApuntes] = useState([]);
  const usuarioId = localStorage.getItem('usuario_id');

  const cargarMisApuntes = async () => {
    try {
      const res = await axios.get(`http://localhost:4000/apuntes/mis-apuntes/${usuarioId}`);
      setMisApuntes(res.data);
    } catch (err) {
      console.error("Error cargando tus apuntes", err);
    }
  };

  const eliminarApunte = async (id) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este apunte?")) {
      try {
        await axios.delete(`http://localhost:4000/apuntes/${id}`);
        toast.success("Apunte eliminado correctamente");
        cargarMisApuntes(); // Recargamos la lista
      } catch (err) {
        toast.error("No se pudo eliminar");
      }
    }
  };

  useEffect(() => {
    cargarMisApuntes();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-black text-gray-900 mb-8">Mis Apuntes Compartidos</h2>
      
      {misApuntes.length === 0 ? (
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
                  href={`http://localhost:4000${apunte.archivo_url}`} 
                  target="_blank" 
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