import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
      
      {/* 1. LOGO */}
      <Link to="/" className="text-2xl font-bold text-blue-600 tracking-tighter italic">
        EDU-VERSE
      </Link>

      {/* Hamburger (mobile) */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden p-2 text-gray-600 hover:text-blue-600 transition-colors"
        aria-label="Menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {menuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* 2. ACCIONES DINÁMICAS — desktop */}
      <div className="hidden md:flex items-center space-x-5">
        {user ? (
          <div className="flex items-center space-x-4">
            <Link to="/biblioteca" className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors">
              📚 Biblioteca
            </Link>
            <Link to="/favoritos" className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors">
              ⭐ Favoritos
            </Link>
            <Link to="/gestor-equipos" className="text-gray-600 hover:text-emerald-600 font-medium text-sm transition-colors">
              👥 Equipos
            </Link>
            <Link to="/mis-apuntes" className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors">
              📁 Mis Apuntes
            </Link>

            <Link 
              to="/perfil" 
              className="flex items-center space-x-3 bg-gray-50 pl-4 pr-1 py-1 rounded-full border border-gray-100 hover:bg-gray-100 transition-all"
            >
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none">Estudiante</span>
                <span className="text-sm font-bold text-gray-800 leading-tight">{user.nombre}</span>
              </div>
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-blue-100">
                <img 
                  src={user.foto ? `${API_URL}${user.foto}` : `https://ui-avatars.com/api/?name=${user.nombre}&background=0D8ABC&color=fff`} 
                  className="w-full h-full object-cover" alt="Perfil"
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${user.nombre}&background=ccc`; }}
                />
              </div>
            </Link>

            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Cerrar Sesión">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-gray-600 font-medium hover:text-blue-600 text-sm">Iniciar Sesión</Link>
            <Link to="/signup" className="bg-blue-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-blue-700 text-sm shadow-md transition-all">Registrarse</Link>
          </div>
        )}
      </div>

      {/* 3. MOBILE MENU (dropdown) */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg md:hidden z-50">
          {user ? (
            <div className="flex flex-col p-4 space-y-3">
              <Link to="/biblioteca" onClick={closeMenu} className="text-gray-700 hover:text-blue-600 font-medium text-sm py-2">📚 Biblioteca</Link>
              <Link to="/favoritos" onClick={closeMenu} className="text-gray-700 hover:text-blue-600 font-medium text-sm py-2">⭐ Favoritos</Link>
              <Link to="/gestor-equipos" onClick={closeMenu} className="text-gray-700 hover:text-emerald-600 font-medium text-sm py-2">👥 Equipos</Link>
              <Link to="/mis-apuntes" onClick={closeMenu} className="text-gray-700 hover:text-blue-600 font-medium text-sm py-2">📁 Mis Apuntes</Link>
              <Link to="/perfil" onClick={closeMenu} className="text-gray-700 hover:text-blue-600 font-medium text-sm py-2">👤 Mi Perfil</Link>
              <hr className="border-gray-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">{user.nombre}</span>
                <button onClick={handleLogout} className="text-red-500 hover:text-red-700 font-bold text-sm">Cerrar Sesión</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col p-4 space-y-3">
              <Link to="/login" onClick={closeMenu} className="text-gray-700 hover:text-blue-600 font-medium text-sm py-2">Iniciar Sesión</Link>
              <Link to="/signup" onClick={closeMenu} className="bg-blue-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-blue-700 text-sm shadow-md text-center">Registrarse</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
