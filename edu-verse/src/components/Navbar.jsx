import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

const Navbar = () => {
  const navigate = useNavigate();
  
  // Revisamos si hay un usuario y su foto guardados en el localStorage
  const usuarioLogueado = localStorage.getItem('usuario');
  const fotoPerfil = localStorage.getItem('foto_url');

  const handleLogout = () => {
    // Limpiamos los datos del navegador
    localStorage.clear(); // Limpia todo (usuario, id, foto_url)
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
      
      {/* 1. LOGO */}
      <Link to="/" className="text-2xl font-bold text-blue-600 tracking-tighter italic">
        EDU-VERSE
      </Link>

      {/* 2. ACCIONES DINÁMICAS */}
      <div className="flex items-center space-x-5">
        
        {usuarioLogueado ? (
          <div className="flex items-center space-x-4">
            
            {/* BOTONES DE SECCIÓN */}
            <Link to="/favoritos" className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors">
              ⭐ Favoritos
            </Link>
            <Link to="/mis-apuntes" className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors">
              📁 Mis Apuntes
            </Link>

            {/* PERFIL (Nombre + Foto) */}
            <Link 
              to="/perfil" 
              className="flex items-center space-x-3 bg-gray-50 pl-4 pr-1 py-1 rounded-full border border-gray-100 hover:bg-gray-100 transition-all"
            >
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none">Estudiante</span>
                <span className="text-sm font-bold text-gray-800 leading-tight">
                  {usuarioLogueado}
                </span>
              </div>
              
              {/* IMAGEN DE PERFIL */}
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-blue-100">
                <img 
                  src={
                    fotoPerfil
                      ? `${API_URL}${fotoPerfil}`
                      : `https://ui-avatars.com/api/?name=${usuarioLogueado}&background=0D8ABC&color=fff`
                  } 
                  className="w-full h-full object-cover"
                  alt="Perfil"
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${usuarioLogueado}&background=ccc`;
                  }}
                />
              </div>
            </Link>

            {/* BOTÓN DE SALIDA */}
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
              title="Cerrar Sesión"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
            
          </div>
        ) : (
          /* --- VISTA CUANDO NO HAY SESIÓN --- */
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-gray-600 font-medium hover:text-blue-600 text-sm">
              Iniciar Sesión
            </Link>
            <Link to="/signup" className="bg-blue-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-blue-700 text-sm shadow-md transition-all">
              Registrarse
            </Link>
          </div>
        )}
        
      </div>
    </nav>
  );
};

export default Navbar;