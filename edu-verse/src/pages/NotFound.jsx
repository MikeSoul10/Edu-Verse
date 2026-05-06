import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-9xl font-black text-blue-600 opacity-20">404</h1>
      <div className="absolute">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">¡Ups! Te perdiste en el espacio</h2>
        <p className="text-gray-500 mb-8">La página que buscas no existe o fue movida a otra galaxia.</p>
        <Link 
          to="/" 
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

// En App.jsx añade al final de las rutas:
// <Route path="*" element={<NotFound />} />