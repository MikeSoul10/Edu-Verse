import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // <--- Verifica que 'useNavigate' esté aquí
import axios from 'axios';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const navigate = useNavigate(); // <--- Si falta esta línea, falla todo


const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const response = await axios.post('http://localhost:4000/auth/login', formData);
    
    // GUARDAR AMBAS COSAS ES LA CLAVE
    localStorage.setItem('usuario', response.data.usuario.nombre);
    localStorage.setItem('usuario_id', response.data.usuario.id); // <--- ESTA LÍNEA TE FALTA
    
    alert(`¡Hola de nuevo, ${response.data.usuario.nombre}!`);
    navigate('/'); 
    window.location.reload(); // Para que el Navbar se actualice
    
  } catch (err) {
    alert(err.response?.data || "Error al iniciar sesión");
  }
};

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-2">
          ¡Hola de nuevo!
        </h2>
        <p className="text-gray-500 text-center mb-8">
          Ingresa a tu cuenta de <span className="text-blue-600 font-bold">Edu-Verse</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Correo Institucional</label>
            <input 
              type="email" 
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="tu@correo.edu"
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-semibold text-gray-700">Contraseña</label>
              <a href="#" className="text-xs text-blue-600 hover:underline">¿La olvidaste?</a>
            </div>
            <input 
              type="password" 
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="••••••••"
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5 transition-all mt-4"
          >
            Entrar
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          ¿No tienes cuenta? <Link to="/signup" className="text-blue-600 font-bold hover:underline">Regístrate gratis</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;