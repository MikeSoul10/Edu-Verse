import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  
  // Revisamos si hay un usuario guardado en el localStorage
  const usuarioLogueado = localStorage.getItem('usuario');

  const handleLogout = () => {
    // Limpiamos los datos del navegador
    localStorage.removeItem('usuario');
    // Mandamos al usuario de vuelta al login
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
      
      {/* 1. LOGO */}
      <Link to="/" className="text-2xl font-bold text-blue-600 tracking-tighter">
        EDU-VERSE
      </Link>

      {/* 2. BUSCADOR (Visible solo en computadoras) */}
      <div className="hidden md:flex flex-1 mx-10">
        <div className="relative w-full max-w-xl">
          <input 
            type="text" 
            placeholder="Busca materias, profesores o temas..." 
            className="w-full bg-gray-100 border-none rounded-full py-2 px-10 focus:ring-2 focus:ring-blue-400 outline-none text-sm transition-all"
          />
          <span className="absolute left-3 top-2 text-gray-400">🔍</span>
        </div>
      </div>

      {/* 3. ACCIONES DINÁMICAS */}
      <div className="flex items-center space-x-5">
        
{usuarioLogueado ? (
  <div className="flex items-center space-x-4">
    {/* Envolvemos el nombre en un Link */}
    <Link 
      to="/perfil" 
      className="flex flex-col items-end hover:opacity-80 transition-opacity cursor-pointer"
    >
      <span className="text-xs text-gray-400 font-medium">Estudiante</span>
      <span className="text-sm font-bold text-gray-800 border-b-2 border-transparent hover:border-blue-400">
        {usuarioLogueado}
      </span>
    </Link>
    <Link 
    to="/upload" 
    className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-600 transition-all flex items-center gap-2"
  >
    <span>➕</span> Subir
  </Link>
    
    <button 
      onClick={handleLogout}
      className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
    >
      Salir
    </button>
  </div>


) : (
          /* --- VISTA CUANDO NO HAY SESIÓN --- */
          <>
            <Link 
              to="/login" 
              className="text-gray-600 font-medium hover:text-blue-600 transition-colors text-sm"
            >
              Iniciar Sesión
            </Link>
            
            <Link 
              to="/signup" 
              className="bg-blue-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-blue-700 transition-all text-sm shadow-md"
            >
              Registrarse
            </Link>
          </>
        )}
        
      </div>
    </nav>
  );
};

export default Navbar;