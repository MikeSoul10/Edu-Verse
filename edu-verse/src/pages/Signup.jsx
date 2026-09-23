import React, { useState, useEffect } from 'react';
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const FRASES_MASCOTA = ['¡Hola! 👋', '¡Estudia conmigo! ✨', '¡Comparte tus apuntes! 📚'];
const INTERVALO_FRASE = 3000;

const Signup = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fraseIdx, setFraseIdx] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setFraseIdx((prev) => (prev + 1) % FRASES_MASCOTA.length);
    }, INTERVALO_FRASE);
    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-[88vh] flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-gradient-to-br from-blue-50 via-white to-amber-50 font-['Fredoka',sans-serif]">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-6xl border border-blue-100 flex flex-col md:flex-row transition-all">

        {/* LADO IZQUIERDO: LOGO Y MASCOTA EDUVERS */}
        <div className="md:w-1/2 bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-800 p-8 sm:p-10 text-white flex flex-col items-center justify-between relative overflow-hidden">
          {/* Círculos decorativos de fondo */}
          <div className="absolute -top-12 -left-12 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-amber-400/20 rounded-full blur-2xl pointer-events-none"></div>

          {/* Logo EduVers */}
          <div className="w-full flex justify-center mb-4 relative z-10">
            <img 
              src="/logo-eduverse.png" 
              alt="EduVers" 
              className="h-24 sm:h-28 object-contain filter drop-shadow-md transition-transform hover:scale-105"
            />
          </div>

          {/* Mascota EduVers */}
          <div className="relative z-10 my-4 flex flex-col items-center">
            <div className="relative group cursor-pointer">
              <img 
                src="/mascota-eduverse.png" 
                alt="Mascota EduVers" 
                className="w-56 sm:w-64 h-auto object-contain drop-shadow-2xl transition-all duration-300 transform group-hover:scale-105 group-hover:-rotate-2"
              />
              <span key={fraseIdx} className="absolute -top-2 -right-2 bg-amber-400 text-blue-950 font-black text-base px-3 py-1.5 rounded-full shadow-lg border-2 border-white animate-bounce">
                {FRASES_MASCOTA[fraseIdx]}
              </span>
            </div>
            
            <p className="mt-4 text-center text-blue-100 font-medium text-lg sm:text-xl max-w-xs leading-snug">
              ¡Tu comunidad académica favorita para compartir apuntes y colaborar! 📚✨
            </p>
          </div>

          <div className="text-base text-blue-200/80 font-medium text-center relative z-10">
            Exclusivo para estudiantes universarios
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO DE REGISTRO */}
        <div className="md:w-1/2 p-8 sm:p-10 flex flex-col justify-center bg-white">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-2">
              Crea tu cuenta
            </h2>
            <p className="text-gray-500 text-lg font-medium">
              Únete a la comunidad de <span className="text-blue-600 font-bold">EduVers</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-base font-bold text-gray-700 mb-1.5 ml-1">
                Nombre Completo
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full px-5 py-4 pl-12 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 text-lg font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400"
                  placeholder="Ej. Miguel Pérez"
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                  👤
                </span>
              </div>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-700 mb-1.5 ml-1">
                Correo Institucional
              </label>
              <div className="relative">
                <input 
                  type="email" 
                  className="w-full px-5 py-4 pl-12 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 text-lg font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400"
                  placeholder="tu@alumnos.udg.mx"
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                  📧
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-base font-bold text-gray-700">Contraseña</label>
                <a href="#" className="text-base text-blue-600 font-bold hover:underline">¿La olvidaste?</a>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="w-full px-5 py-4 pl-12 pr-12 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 text-lg font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400"
                  placeholder="••••••••"
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                  🔒
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 transform transition-all mt-4 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Registrarse ahora</span>
              <span className="text-2xl">🚀</span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-base text-gray-600 font-medium">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-blue-600 font-bold hover:underline ml-1">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Signup;