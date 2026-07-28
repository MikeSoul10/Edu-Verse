import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const loadingToast = toast.loading('Iniciando sesión...');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, formData);
      
      login(response.data);

      toast.success(`¡Bienvenido de nuevo, ${response.data.usuario.nombre}!`, {
        id: loadingToast,
        icon: '🚀',
      });

      setTimeout(() => {
        if (response.data.usuario.rol === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }, 1000);

    } catch (err) {
      const errorMsg = err.response?.data || "Credenciales incorrectas";
      toast.error(errorMsg, {
        id: loadingToast,
      });
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 transform transition-all">
        <h2 className="text-3xl font-black text-gray-900 text-center mb-2">
          ¡Hola de nuevo!
        </h2>
        <p className="text-gray-500 text-center mb-8">
          Ingresa a tu cuenta de <span className="text-blue-600 font-bold">Edu-Verse</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Correo Institucional</label>
            <input 
              type="email" 
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              placeholder="tu@correo.alumnos.udg.mx"
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 ml-1">
              <label className="text-sm font-bold text-gray-700">Contraseña</label>
              <a href="#" className="text-xs text-blue-600 font-bold hover:underline">¿La olvidaste?</a>
            </div>
            <input 
              type="password" 
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              placeholder="••••••••"
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-blue-700 hover:shadow-xl active:scale-95 transform transition-all mt-4"
          >
            Entrar a mi cuenta
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-8">
          ¿No tienes cuenta? <Link to="/signup" className="text-blue-600 font-black hover:underline">Regístrate gratis</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;