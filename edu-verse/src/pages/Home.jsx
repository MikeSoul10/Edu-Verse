import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom'; // Importante para la navegación

const Home = () => {
  const [userName, setUserName] = useState('');
  const [apuntes, setApuntes] = useState([]);
  const [busqueda, setBusqueda] = useState('');

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

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    try {
      const query = busqueda ? busqueda : '';
      const res = await axios.get(`http://localhost:4000/apuntes/buscar?q=${query}`);
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
    <div className="max-w-7xl mx-auto px-6 py-4">
      {/* Header con Saludo y Botones de Navegación */}
      <header className="mb-8 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-extrabold text-gray-900">
              Hola, <span className="text-blue-600">{userName || 'Estudiante'}</span> 👋
            </h1>
            <p className="text-gray-600 mt-2">Gestiona tus documentos en Edu-Verse</p>
          </div>

          {/* ACCIONES RÁPIDAS: Aquí están tus nuevos botones */}
          <div className="flex gap-4">
            <Link 
              to="/apuntes" 
              className="flex items-center gap-2 bg-white text-gray-700 px-6 py-3 rounded-2xl font-bold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all"
            >
              📚 Ver Todos
            </Link>
            <Link 
              to="/upload" 
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:bg-blue-700 transition-all"
            >
              ➕ Subir Apunte
            </Link>
          </div>
        </div>
      </header>

      {/* Buscador */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-3 text-gray-400 text-xl">🔍</span>
            <input 
              type="text" 
              placeholder="Busca materias o temas en Edu-Verse..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-400 outline-none"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-md">
            Buscar
          </button>
        </form>
      </section>

      {/* Sección de Apuntes Recientes */}
      <section>
        <div className="flex justify-between items-center mb-6 border-b pb-2">
          <h3 className="text-xl font-bold text-gray-800">Apuntes Recientes</h3>
          <Link to="/apuntes" className="text-sm text-blue-600 font-semibold hover:underline">Ver más</Link>
        </div>
        
        {apuntes.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed">
            <p className="text-gray-500">No hay apuntes disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {apuntes.slice(0, 3).map((apunte) => ( // Mostramos solo los 3 primeros en el Home
              <div key={apunte.apunte_id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="w-full h-24 bg-blue-100 rounded-xl mb-4 flex items-center justify-center text-3xl">📄</div>
                <h4 className="font-bold text-gray-900 truncate">{apunte.titulo}</h4>
                <p className="text-sm text-gray-500 italic">{apunte.materia}</p>
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-600">Por: {apunte.autor}</span>
                  <a 
                    href={`http://localhost:4000${apunte.archivo_url}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs bg-gray-800 text-white px-3 py-2 rounded-lg font-bold"
                  >
                    Ver PDF
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