import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Favorites = () => {
  const [favoritos, setFavoritos] = useState([]);
  const usuarioId = localStorage.getItem('usuario_id');

  const cargarFavoritos = async () => {
    try {
      const res = await axios.get(`http://localhost:4000/favoritos/${usuarioId}`);
      setFavoritos(res.data);
    } catch (err) {
      console.error("Error al cargar favoritos", err);
    }
  };

  // FUNCIÓN PARA ELIMINAR
  const quitarFavorito = async (apunteId) => {
    try {
      await axios.delete('http://localhost:4000/favoritos', {
        data: { usuario_id: usuarioId, apunte_id: apunteId } // En DELETE, el body va en 'data'
      });
      toast.success("Eliminado de tus favoritos");
      cargarFavoritos(); // Refrescamos la lista automáticamente
    } catch (err) {
      toast.error("No se pudo eliminar");
    }
  };

  useEffect(() => {
    if (usuarioId) cargarFavoritos();
  }, [usuarioId]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-black mb-8 text-gray-900">Mis Favoritos ⭐</h2>
      
      {favoritos.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed">
          <p className="text-gray-400">Aún no tienes apuntes guardados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {favoritos.map((apunte) => (
            <div key={apunte.apunte_id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="w-full h-32 bg-yellow-50 rounded-xl mb-4 flex items-center justify-center text-4xl">⭐</div>
              <h4 className="font-bold text-gray-900 truncate">{apunte.titulo}</h4>
              <p className="text-sm text-gray-500 mb-4 italic">📚 {apunte.materia}</p>
              
              <div className="flex gap-2">
                <a 
                  href={`http://localhost:4000${apunte.archivo_url}`} 
                  target="_blank" 
                  className="flex-1 text-center bg-gray-900 text-white py-2 rounded-xl text-xs font-bold hover:bg-black transition-colors"
                >
                  Abrir PDF
                </a>
                <button 
                  onClick={() => quitarFavorito(apunte.apunte_id)}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
                  title="Quitar de favoritos"
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

export default Favorites;