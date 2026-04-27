import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Apuntes = () => {
  const [listaApuntes, setListaApuntes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const obtenerApuntes = async () => {
    try {
      const res = await axios.get('http://localhost:4000/apuntes');
      if (Array.isArray(res.data)) {
        setListaApuntes(res.data);
      }
    } catch (err) {
      console.error("Error al cargar la lista de apuntes:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerApuntes();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-8">📚 Repositorio de Apuntes</h2>

      {cargando ? (
        <p className="text-center text-blue-600">Cargando archivos...</p>
      ) : listaApuntes.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed">
          <p className="text-gray-500">No se encontraron archivos en el servidor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {listaApuntes.map((item) => (
            <div key={item.apunte_id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
              <div className="bg-blue-600 h-2 w-full"></div>
              <div className="p-4">
                <span className="text-xs font-semibold text-blue-500 uppercase">{item.materia}</span>
                <h4 className="font-bold text-gray-900 mt-1 mb-3 line-clamp-2">{item.titulo}</h4>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-gray-400">👤 {item.autor}</span>
                  <a 
                    href={`http://localhost:4000${item.archivo_url}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-100"
                  >
                    Abrir PDF
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Apuntes;