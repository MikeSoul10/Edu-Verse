import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Home = () => {
  const [userName, setUserName] = useState('');
  const [apuntes, setApuntes] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  // 1. Función para cargar apuntes (Definida fuera para que sea accesible)
  const cargarApuntes = async () => {
    try {
      const res = await axios.get('http://localhost:4000/apuntes');
      if (Array.isArray(res.data)) {
        setApuntes(res.data);
      }
    } catch (err) {
      console.error("Error al traer apuntes:", err);
    }
  };

  // 2. Función para buscar (Definida fuera para que el formulario la vea)
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!busqueda.trim()) return cargarApuntes();

    try {
      const res = await axios.get(`http://localhost:4000/apuntes/buscar?q=${encodeURIComponent(busqueda)}`);
      setApuntes(res.data);
    } catch (err) {
      console.error("Error al buscar:", err);
    }
  };

  useEffect(() => {
    const storedName = localStorage.getItem('usuario');
    if (storedName) setUserName(storedName);
    cargarApuntes();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Bienvenida más compacta */}
      <header className="mb-8 p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl text-white shadow-lg">
        <h1 className="text-3xl font-black">
          Hola, {userName || 'Estudiante'} 👋
        </h1>
        <p className="opacity-90">Explora los apuntes compartidos hoy en Edu-Verse</p>
      </header>

      {/* Buscador */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-3 text-gray-400 text-xl">🔍</span>
            <input 
              type="text" 
              placeholder="Busca por título o materia..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-400 outline-none transition-all"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
          >
            Buscar
          </button>
          <button 
            type="button"
            onClick={() => { setBusqueda(''); cargarApuntes(); }}
            className="text-sm text-gray-400 hover:text-blue-600 font-medium px-2"
          >
            Limpiar
          </button>
        </form>
      </section>

      {/* Grid de Apuntes */}
      <section>
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span>✨</span> Apuntes Recientes
        </h3>
        
        {apuntes.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-medium italic">No se encontraron resultados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apuntes.map((apunte) => (
              <div key={apunte.apunte_id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="w-full h-32 bg-blue-50 rounded-xl mb-4 flex items-center justify-center text-5xl">📄</div>
                <h4 className="font-bold text-gray-900 text-lg truncate">{apunte.titulo}</h4>
                <p className="text-sm text-gray-500 mb-1 font-medium">📚 {apunte.materia}</p>
                <p className="text-xs text-blue-600 mb-4 italic font-semibold">Subido por: {apunte.autor || 'Anónimo'}</p>
                <div className="flex justify-between items-center border-t border-gray-50 pt-4">
                  <span className="text-yellow-500 font-bold text-sm">⭐ 5.0</span>
                  <a 
                    href={`http://localhost:4000${apunte.archivo_url}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs bg-gray-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-black transition-colors"
                  >
                    Ver Apunte
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;