import React, { useState, useEffect } from 'react';
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const FRASES_MASCOTA = ['¡Hola! 👋', '¡Estudia conmigo! ', '¡Comparte tus apuntes! ', '¡Gestiona tus proyectos!'];
const INTERVALO_FRASE = 5000;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOMINIO_UDG = '@alumnos.udg.mx';

// Mismas partículas que Login: ancla visual entre las dos pantallas.
const PARTICULAS = [
  { top: '14%', left: '7%', size: 8, fill: '#3b82f6', halo: 'rgba(59, 130, 246, 0.55)', dur: '11s', dx: '16px', dy: '-22px' },
  { top: '62%', left: '12%', size: 6, fill: '#fbbf24', halo: 'rgba(251, 191, 36, 0.55)', dur: '17s', dx: '-14px', dy: '-18px', delay: '-4s' },
  { top: '24%', left: '88%', size: 7, fill: '#818cf8', halo: 'rgba(129, 140, 248, 0.55)', dur: '14s', dx: '-18px', dy: '20px', delay: '-2s' },
  { top: '74%', left: '83%', size: 9, fill: '#60a5fa', halo: 'rgba(96, 165, 250, 0.5)', dur: '9s', dx: '12px', dy: '-16px', delay: '-6s' },
  { top: '8%', left: '42%', size: 6, fill: '#fcd34d', halo: 'rgba(252, 211, 77, 0.5)', dur: '19s', dx: '-10px', dy: '24px', delay: '-8s' },
  { top: '88%', left: '55%', size: 7, fill: '#a5b4fc', halo: 'rgba(165, 180, 252, 0.5)', dur: '13s', dx: '20px', dy: '-12px', delay: '-3s' },
  { top: '45%', left: '3%', size: 6, fill: '#3b82f6', halo: 'rgba(59, 130, 246, 0.5)', dur: '16s', dx: '10px', dy: '26px', delay: '-11s' },
  { top: '36%', left: '95%', size: 8, fill: '#fcd34d', halo: 'rgba(252, 211, 77, 0.5)', dur: '21s', dx: '-22px', dy: '-14px', delay: '-5s' },
];

const Signup = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fraseIdx, setFraseIdx] = useState(0);
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setFraseIdx((prev) => (prev + 1) % FRASES_MASCOTA.length);
    }, INTERVALO_FRASE);
    return () => clearInterval(interval);
  }, []);

  const emailVacio = formData.email.trim() === '';
  const emailValido = !emailVacio && RE_EMAIL.test(formData.email);
  const emailInstitucional = emailValido && formData.email.endsWith(DOMINIO_UDG);
  const passwordCorta = formData.password.length > 0 && formData.password.length < 6;

  const emailInvalido = enviado && !emailInstitucional;
  const passwordInvalida = enviado && (passwordCorta || formData.password === '');
  const camposInvalidos = enviado && (formData.nombre.trim() === '' || !emailInstitucional || formData.password === '' || passwordCorta);

  const handleChange = (campo) => (e) => {
    setFormData({ ...formData, [campo]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviado(true);

    if (formData.nombre.trim() === '') {
      return toast.error('Escribe tu nombre completo.');
    }

    if (!RE_EMAIL.test(formData.email)) {
      return toast.error('Por favor, ingresa un correo electrónico válido.');
    }

    if (!formData.email.endsWith(DOMINIO_UDG)) {
      return toast.error('Edu-Verse solo permite registros con correos institucionales (@alumnos.udg.mx)');
    }

    if (formData.password.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres por seguridad.');
    }

    setCargando(true);
    const loadingToast = toast.loading('Creando tu cuenta...');

    try {
      const response = await axios.post(`${API_URL}/auth/signup`, formData);

      toast.success(`¡Bienvenido ${response.data.usuario.nombre}! Tu cuenta ha sido creada con éxito.`, {
        id: loadingToast,
      });

      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setCargando(false);
      setEnviado(false);
      const mensajeError = err.response?.data || 'Hubo un problema al conectar con el servidor';
      toast.error(mensajeError, { id: loadingToast });
    }
  };

  return (
<div className="ev-mesh-bg min-h-[88vh] flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-['Fredoka',sans-serif]">
      {/* Capa 2: puntos */}
      <div className="ev-dotfield absolute inset-0 pointer-events-none" />

      {/* Capa 4: particulas */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {PARTICULAS.map((p, i) => (
          <span
            key={i}
            className="ev-particle"
            style={{
              top: p.top,
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.fill,
              boxShadow: `0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 16px 3px ${p.halo}`,
              '--dur': p.dur,
              '--dx': p.dx,
              '--dy': p.dy,
              '--delay': p.delay ?? '0s',
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-6xl rounded-[2rem] overflow-hidden flex flex-col md:flex-row border border-white/50 shadow-[0_28px_80px_-28px_rgba(30,58,138,0.45)] relative z-10 ev-enter-card ev-d-0">

        {/* LADO IZQUIERDO: LOGO Y MASCOTA EDUVERS */}
        <div className="ev-panel md:w-1/2 ev-mesh p-6 sm:p-10 text-white flex flex-col items-center justify-between relative overflow-hidden">
          {/* Círculos decorativos de fondo */}
          <div className="absolute -top-12 -left-12 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-amber-400/20 rounded-full blur-2xl pointer-events-none"></div>

          {/* Logo EduVers */}
          <div className="w-full flex justify-center mb-2 sm:mb-4 relative z-10 ev-enter-pop ev-d-1">
            <img
              src="/logo-eduverse.png"
              alt="EduVers"
              className="ev-lift h-16 sm:h-24 lg:h-28 object-contain drop-shadow-lg"
            />
          </div>

          {/* Mascota EduVers */}
          <div className="relative z-10 my-2 sm:my-4 flex flex-col items-center ev-enter ev-d-2">
            <div className="ev-float">
              <div className="relative group inline-block">
                <img
                  src="/mascota-eduverse.png"
                  alt="Mascota de EduVers"
                  className="ev-lift-mascota w-32 sm:w-56 lg:w-64 h-auto object-contain drop-shadow-2xl"
                />
                <span
                  key={fraseIdx}
                  className="ev-bubble absolute -top-4 right-0 sm:-top-5 bg-amber-400 text-blue-950 font-black text-xs sm:text-base px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-2xl shadow-lg border-2 border-white whitespace-nowrap"
                >
                  {FRASES_MASCOTA[fraseIdx]}
                </span>
              </div>
            </div>

            <p className="mt-3 sm:mt-6 text-center text-blue-100 font-medium text-base sm:text-xl max-w-sm leading-snug ev-enter ev-d-4">
              Tu comunidad académica para compartir apuntes y colaborar.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-base text-blue-100 font-medium text-center relative z-10 ev-enter ev-d-6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" fill="currentColor" opacity="0.9" />
              <path d="M9 12l2 2 4-4" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exclusivo para estudiantes universitarios
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO DE REGISTRO */}
        <div className="md:w-1/2 p-6 sm:p-10 flex flex-col justify-center bg-white">
          <div className="mb-6 sm:mb-8 ev-enter ev-d-1">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-2">
              Crea tu cuenta
            </h2>
            <p className="text-gray-500 text-base sm:text-lg font-medium">
              Únete a la comunidad de <span className="text-blue-600 font-bold">EduVers</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className={camposInvalidos ? 'ev-shake ev-enter ev-d-2' : 'ev-enter ev-d-2'}>
              <label htmlFor="signup-nombre" className="ev-field-label block text-base font-bold text-gray-700 mb-1.5 ml-1">
                Nombre completo
              </label>
              <div className="ev-field relative">
                <input
                  id="signup-nombre"
                  type="text"
                  autoComplete="name"
                  value={formData.nombre}
                  className="w-full pl-12 pr-5 px-5 py-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 text-lg font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Ej. Miguel Pérez"
                  onChange={handleChange('nombre')}
                />
                <img
                  src="/Iconos/usuario.png"
                  alt=""
                  aria-hidden="true"
                  className="ev-field-icon absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 object-contain"
                />
              </div>
            </div>

            <div className="ev-enter ev-d-3">
              <label htmlFor="signup-email" className="ev-field-label block text-base font-bold text-gray-700 mb-1.5 ml-1">
                Correo institucional
              </label>
              <div className="ev-field relative">
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  aria-invalid={emailInvalido}
                  aria-describedby={emailInvalido ? 'signup-email-error' : undefined}
                  className={`w-full pl-12 pr-11 px-5 py-4 rounded-2xl bg-gray-50 border text-gray-900 text-lg font-medium outline-none focus:ring-4 ${
                    emailInvalido
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                      : emailInstitucional
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                  placeholder="tu@alumnos.udg.mx"
                  onChange={handleChange('email')}
                />
                <img
                  src="/Iconos/gmail.png"
                  alt=""
                  aria-hidden="true"
                  className="ev-field-icon absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 object-contain"
                />
                {emailInstitucional && (
                  <svg
                    width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500"
                  >
                    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
                    <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {emailInvalido && (
                <p id="signup-email-error" className="mt-1.5 ml-1 text-sm font-medium text-red-600">
                  {emailValido
                    ? 'EduVers solo admite correos institucionales (@alumnos.udg.mx).'
                    : 'Escribe un correo institucional válido.'}
                </p>
              )}
            </div>

            <div className="ev-enter ev-d-4">
              <label htmlFor="signup-password" className="ev-field-label block text-base font-bold text-gray-700 mb-1.5 ml-1">
                Contraseña
              </label>
              <div className="ev-field relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  aria-invalid={passwordInvalida}
                  aria-describedby={passwordInvalida ? 'signup-password-error' : undefined}
                  className={`w-full pl-12 pr-12 px-5 py-4 rounded-2xl bg-gray-50 border text-gray-900 text-lg font-medium outline-none focus:ring-4 ${
                    passwordInvalida
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                  placeholder="Mínimo 6 caracteres"
                  onChange={handleChange('password')}
                />
                <img
                  src="/Iconos/candado.png"
                  alt=""
                  aria-hidden="true"
                  className="ev-field-icon absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 object-contain"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  className="ev-eye-btn ev-focusable absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 text-gray-400"
                >
                  <img
                    src="/Iconos/ojo.png"
                    alt=""
                    aria-hidden="true"
                    className={`ev-eye absolute w-5 h-5 object-contain ${showPassword ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                  />
                  <img
                    src="/Iconos/ojo_cerrado.png"
                    alt=""
                    aria-hidden="true"
                    className={`ev-eye absolute w-5 h-5 object-contain ${showPassword ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}
                  />
                </button>
              </div>
              {passwordInvalida && (
                <p id="signup-password-error" className="mt-1.5 ml-1 text-sm font-medium text-red-600">
                  La contraseña necesita al menos 6 caracteres.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="ev-btn ev-shimmer ev-enter ev-d-5 w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-xl cursor-pointer mt-4 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {cargando ? 'Creando cuenta…' : 'Registrarse ahora'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200/70 text-center ev-enter ev-d-6">
            <p className="text-base text-gray-600 font-medium">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="ev-focusable text-blue-600 font-bold hover:underline ml-1">
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