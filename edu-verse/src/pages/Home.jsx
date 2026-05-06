import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Home = () => {
  const [userName, setUserName] = useState('');
  const [apuntes, setApuntes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  // 1. Cargar Apuntes con Estado de Carga
  const cargarApuntes = async () => {
    setCargando(true);
    try {
      const res = await axios.get('http://localhost:4000/apuntes');
      if (Array.isArray(res.data)) {
        setApuntes(res.data);
      }
    } catch (err) {
      console.error("Error al traer apuntes:", err);
    } finally {
      setCargando(false);
    }
  };

  // 2. Guardar en Favoritos
  const guardarFavorito = async (apunteId) => {
    const usuarioId = localStorage.getItem('usuario_id');
    if (!usuarioId) return toast.error("Debes iniciar sesión");

    try {
      const res = await axios.post('http://localhost:4000/favoritos', {
        usuario_id: usuarioId,
        apunte_id: apunteId
      });
      toast.success(res.data.message);
    } catch (err) {
      if (err.response && err.response.data) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Error al conectar con el servidor");
      }
    }
  };

  // 3. Búsqueda dinámico
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setCargando(true);
    try {
      const query = busqueda ? busqueda : '';
      const res = await axios.get(`http://localhost:4000/apuntes/buscar?q=${query}`);
      setApuntes(res.data);
    } catch (err) {
      console.error("Error al buscar:", err);
    } finally {
      setCargando(false);
    }
  };

  // 4. Componente de carga (Skeleton)
  const SkeletonCard = () => (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm animate-pulse">
      <div className="w-full h-32 bg-gray-200 rounded-2xl mb-4"></div>
      <div className="h-5 bg-gray-200 rounded-full w-3/4 mb-3"></div>
      <div className="h-4 bg-gray-100 rounded-full w-1/2 mb-6"></div>
      <div className="flex justify-between items-center pt-4 border-t border-gray-50">
        <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
        <div className="h-9 w-24 bg-gray-200 rounded-xl"></div>
      </div>
    </div>
  );

  useEffect(() => {
    const storedName = localStorage.getItem('usuario');
    if (storedName) setUserName(storedName);
    cargarApuntes();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      
      {/* Header Adaptable */}
      <header className="mb-8 p-6 md:p-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] shadow-xl text-white">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">
              Hola, {userName || 'Estudiante'} 👋
            </h1>
            <p className="opacity-90 mt-2 text-lg">Tu biblioteca colaborativa en Edu-Verse</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Link 
              to="/upload" 
              className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-black shadow-lg hover:scale-105 transition-all active:scale-95"
            >
              ➕ Subir Material
            </Link>
          </div>
        </div>
      </header>

      {/* Buscador Responsive */}
      <section className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 mb-10">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-3.5 text-gray-400 text-xl">🔍</span>
            <input 
              type="text" 
              placeholder="¿Qué materia buscas hoy?" 
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-2xl outline-none transition-all"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button type="submit" className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg active:scale-95">
            Buscar ahora
          </button>
        </form>
      </section>

      {/* Grid de Apuntes */}
      <section>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-black text-gray-900">Explorar Apuntes</h3>
          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-4 py-1 rounded-full">
            {apuntes.length} archivos
          </span>
        </div>

        {cargando ? (
          /* Vista de Carga */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(n => <SkeletonCard key={n} />)}
          </div>
        ) : apuntes.length === 0 ? (
          /* Vista Vacía */
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <div className="text-6xl mb-4">📁</div>
            <p className="text-gray-500 font-medium">No encontramos apuntes con ese nombre.</p>
            <button onClick={cargarApuntes} className="mt-4 text-blue-600 font-bold underline">Ver todos los apuntes</button>
          </div>
        ) : (
          /* Vista Real de Tarjetas */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {apuntes.map((apunte) => (
              <div key={apunte.apunte_id} className="group bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col">
                
                <Link to={`/apunte/${apunte.apunte_id}`}>
                  <div className="w-full h-40 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl mb-5 flex items-center justify-center text-5xl group-hover:scale-105 transition-transform duration-300">
                    📄
                  </div>
                  <h4 className="font-black text-gray-900 text-xl truncate group-hover:text-blue-600 transition-colors">
                    {apunte.titulo}
                  </h4>
                  <p className="text-sm font-bold text-blue-500 uppercase tracking-widest mt-1">
                    {apunte.materia}
                  </p>
                </Link>

                <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Autor</span>
                    <span className="text-xs font-bold text-gray-700">{apunte.autor}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => guardarFavorito(apunte.apunte_id)}
                      className="p-2 hover:bg-yellow-50 rounded-xl transition-colors text-2xl"
                      title="Guardar en favoritos"
                    >
                      🔖
                    </button>
                    <Link 
                      to={`/apunte/${apunte.apunte_id}`}
                      className="bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-600 transition-colors"
                    >
                      Detalles
                    </Link>
                  </div>
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