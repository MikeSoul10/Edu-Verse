import React, { useState } from 'react';
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const Signup = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: ''
  });
  const navigate = useNavigate();

 const handleSubmit = async (e) => {
  e.preventDefault();

  // --- 1. VALIDACIONES PREVIAS (CLIENT-SIDE) ---
  
  // Validación de formato de correo (Regex)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    return toast.error("Por favor, ingresa un correo electrónico válido.");
  }

  // Validación de correo institucional 
  if (!formData.email.endsWith('@alumnos.udg.mx')) {
    return toast.error("Edu-Verse solo permite registros con correos institucionales (@alumnos.udg.mx)");
  }

  // Validación de longitud de contraseña
  if (formData.password.length < 6) {
    return toast.error("La contraseña debe tener al menos 6 caracteres por seguridad.");
  }

  // --- 2. ENVÍO DE DATOS AL BACKEND ---
  try {
    // Apuntamos a la ruta exacta del Backend
    const response = await axios.post(`${API_URL}/auth/signup`, formData);
    
    toast.success(`¡Bienvenido ${response.data.usuario.nombre}! Tu cuenta ha sido creada con éxito.`);
    setTimeout(() => navigate('/login'), 1500);

  } catch (err) {
    const mensajeError = err.response?.data || "Hubo un problema al conectar con el servidor";
    toast.error(mensajeError);
  }
};

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-2">
          Crea tu cuenta
        </h2>
        <p className="text-gray-500 text-center mb-8">
          Únete a la comunidad de <span className="text-blue-600 font-bold">Edu-Verse</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre Completo</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="Ej. Miguel Pérez"
              onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              required
            />
            
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Correo Institucional</label>
            <input 
              type="email" 
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="correo@alumnos.udg.mx"
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña</label>
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
            Registrarse ahora
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          ¿Ya tienes cuenta? <Link to="/login" className="text-blue-600 font-bold hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;