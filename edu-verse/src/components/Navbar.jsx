import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../hooks/useTema';

/* El boton de tema necesita estar en dos sitios a la vez: pegado al borde
   derecho en movil, y dentro del grupo de acciones en escritorio. Sacarlo
   de cualquiera de los dos grupos lo deja en el medio en el otro ancho,
   porque cada grupo se oculta segun el breakpoint.

   Es una sola pieza con dos instancias, no dos piezas: el SVG y el
   aria-label viven aca, asi no pueden desincronizarse. */
const BotonTema = ({ oscuro, alternar, className = '' }) => (
  <button
    type="button"
    onClick={alternar}
    aria-label={oscuro ? 'Usar tema claro' : 'Usar tema oscuro'}
    title={oscuro ? 'Usar tema claro' : 'Usar tema oscuro'}
    aria-pressed={oscuro}
    className={`ev-focusable grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-amber-300 dark:text-white dark:hover:bg-white/25 ${className}`}
  >
    {oscuro ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
);

/* Los links de modulo se generan por ruta, duplicados entre la version de
   escritorio y la de movil. Es una lista, no JSX suelto: asi el estado
   activo se resuelve en un solo lugar y las dos versiones no pueden
   desincronizarse. */
const MODULOS = [
  { path: '/', etiqueta: 'Biblioteca', to: '/biblioteca', enabled: true },
  { path: '/', etiqueta: 'Equipos', to: '/gestor-equipos', enabled: true },
  { path: '/', etiqueta: 'Tutor IA', to: null, enabled: false },
  { path: '/biblioteca', etiqueta: 'Favoritos', to: '/favoritos', enabled: true },
  { path: '/biblioteca', etiqueta: 'Mis Apuntes', to: '/mis-apuntes', enabled: true },
  { path: '/gestor-equipos', etiqueta: 'Equipos', to: '/gestor-equipos', enabled: true },
];

const clasesLink = (activo) =>
  `ev-focusable font-medium text-sm transition-colors ${
    activo
      ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.45)]'
      : 'text-white/90 hover:text-amber-300'
  }`;

/* Rutas donde el boton de inicio no se dibuja.

   En el Home no hay a donde volver. En login y signup menos: son pantallas
   de autenticacion, y ofrecer "volver al inicio" a medio camino de
   registrarse confunde mas de lo que ayuda. */
const RUTAS_SIN_INICIO = ['/', '/login', '/signup'];

/* Igual que `BotonTema`: necesita dos instancias, una por breakpoint. */
const BotonInicio = ({ wrapper = false }) => {
  const { pathname } = useLocation();
  if (RUTAS_SIN_INICIO.includes(pathname)) return null;
  return (
    <Link
      to="/"
      className={`ev-focusable grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-amber-300 ${wrapper ? 'md:hidden' : ''}`}
      aria-label="Ir al inicio"
      title="Ir al inicio"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
};

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { oscuro, alternar } = useTema();
  const navRef = useRef(null);

  // El menu movil es una capa sobre el contenido: sin esto, la pagina de
  // abajo sigue desplazandose con el dedo mientras el menu esta abierto.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const alPulsarFuera = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    const alPulsarEscape = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('pointerdown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarEscape);

    return () => {
      document.removeEventListener('pointerdown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarEscape);
      document.body.style.overflow = overflowPrevio;
    };
  }, [menuOpen]);

  // Cambiar de seccion con el menu abierto lo dejaba colgando: el estado
  // sobrevive al unmount porque el Navbar es permanente.
  //
  // Se ajusta DURANTE el render y no en un useEffect a proposito: un
  // setState dentro de un effect cascada un render extra y React lo marca
  // como error. Este es el patron que la propia documentacion de React
  // indica para "ajustar estado cuando cambia una entrada".
  const [rutaPrevia, setRutaPrevia] = useState(location.pathname);
  if (rutaPrevia !== location.pathname) {
    setRutaPrevia(location.pathname);
    setMenuOpen(false);
  }

  const isLoginPage = location.pathname === '/login';
  const isSignupPage = location.pathname === '/signup';
  const isAuthView = isLoginPage || isSignupPage;

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  const getModuleLinks = () => {
    const path = location.pathname;

    return MODULOS.filter((m) => m.path === path).map((m) => {
      if (!m.enabled) {
        return (
          <span key={m.etiqueta} className="cursor-not-allowed text-sm font-medium text-white/50" title="Próximamente">
            {m.etiqueta}
          </span>
        );
      }
      const activo = location.pathname === m.to;
      return (
        <Link key={m.etiqueta} to={m.to} className={clasesLink(activo)} aria-current={activo ? 'page' : undefined}>
          {m.etiqueta}
        </Link>
      );
    });
  };

  const getMobileModuleLinks = () => {
    const path = location.pathname;

    return MODULOS.filter((m) => m.path === path).map((m) => {
      if (!m.enabled) {
        return (
          <span key={m.etiqueta} className="cursor-not-allowed py-2 text-sm font-medium text-white/50">
            {m.etiqueta} (Próximamente)
          </span>
        );
      }
      const activo = location.pathname === m.to;
      return (
        <Link
          key={m.etiqueta}
          to={m.to}
          onClick={closeMenu}
          className={`py-2 ${activo ? 'text-amber-300' : 'text-white/90 hover:text-amber-300'} ev-focusable font-medium text-sm`}
          aria-current={activo ? 'page' : undefined}
        >
          {m.etiqueta}
        </Link>
      );
    });
  };

  const moduleLinks = getModuleLinks();
  const mobileModuleLinks = getMobileModuleLinks();

  return (
    <nav ref={navRef} className="ev-navbar sticky top-0 z-50 flex items-center justify-between border-b px-4 py-3.5 shadow-md transition-all md:px-8 font-['Fredoka',sans-serif]">
      
      {/* 1. LOGO & BRAND. El toggle de tema vive en el grupo de la derecha,
          junto al hamburger: queda pegado al borde en cualquier ancho y no
          empuja al logo ni al chip "UDG Comunidad". */}
      <div className="flex items-center space-x-3">
        <Link to="/" className="ev-focusable flex items-center space-x-2.5 group">
          <img 
            src="/logo-eduverse.png" 
            alt="EduVers" 
            className="ev-logo h-10 sm:h-11 w-auto object-contain transition-transform group-hover:scale-110 filter drop-shadow-xs" 
            onError={(e) => { e.target.style.display = 'none'; }} 
          />
          
        </Link>

        {isAuthView && (
          <div className="hidden sm:flex items-center space-x-2 bg-amber-400 text-blue-950 font-black px-3.5 py-1 rounded-full text-xs shadow-md border border-amber-300">
            <span>UDG Comunidad</span>
          </div>
        )}
      </div>

      {/* Hamburger (mobile). El `md:hidden` del wrapper es redundante con el del
          boton, pero queda explicito que este bloque no existe en desktop. */}
      <div className="flex items-center gap-1 sm:gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="ev-focusable p-2 text-white transition-colors hover:text-amber-300"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="nav-movil"
        >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* 2. ACCIONES DINÁMICAS — desktop */}
      <div className="hidden md:flex items-center space-x-5">
        {/* En escritorio el tema va primero del grupo: queda a la derecha de
            la barra pero a la izquierda de los links de modulo, del chip de
            perfil y del logout. */}
        <BotonTema oscuro={oscuro} alternar={alternar} />
        <BotonInicio />
        {user ? (
          <div className="flex items-center space-x-4">
            {moduleLinks}

            {user.rol === 'admin' && (
              <Link to="/admin" className="text-amber-300 hover:text-amber-200 font-medium text-sm transition-colors">
                Admin
              </Link>
            )}

            <Link 
              to="/perfil" 
              className="ev-focusable flex items-center space-x-3 bg-white/15 pl-4 pr-1 py-1 rounded-full border border-white/25 hover:bg-white/25 transition-all"
            >
              <div className="flex flex-col items-end">
                <span className={`text-[10px] font-bold uppercase tracking-wider leading-none ${user.rol === 'admin' ? 'text-amber-300' : 'text-blue-100'}`}>
                  {user.rol === 'admin' ? 'Admin' : 'Estudiante'}
                </span>
                <span className="text-sm font-bold text-white leading-tight">{user.nombre}</span>
              </div>
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-blue-100 dark:ring-blue-500/25">
                <img 
                  src={user.foto ? `${API_URL}${user.foto}` : `https://ui-avatars.com/api/?name=${user.nombre}&background=0D8ABC&color=fff`} 
                  className="w-full h-full object-cover" alt="Perfil"
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${user.nombre}&background=ccc`; }}
                />
              </div>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="ev-focusable p-2 text-white/80 hover:text-amber-300 transition-colors"
              aria-label="Cerrar sesión"
              title="Cerrar Sesión"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4 font-['Fredoka',sans-serif]">
            {isLoginPage ? (
              <Link 
                to="/signup" 
                className="bg-amber-400 hover:bg-amber-300 text-blue-950 px-6 py-2.5 rounded-full font-black text-sm shadow-md hover:shadow-amber-400/30 hover:scale-105 active:scale-95 transition-all flex items-center space-x-2 cursor-pointer border border-amber-300"
              >
                <span>¿Eres nuevo? Regístrate aquí</span>
              </Link>
            ) : isSignupPage ? (
              <Link 
                to="/login" 
                className="bg-white/10 hover:bg-white/20 text-white border-2 border-white/70 px-6 py-2.5 rounded-full font-bold text-sm shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center space-x-2 cursor-pointer backdrop-blur-xs"
              >
                <span>Ya tengo cuenta</span>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-white/90 font-bold hover:text-amber-300 text-sm">Iniciar Sesión</Link>
                <Link to="/signup" className="bg-amber-400 text-blue-950 px-5 py-2 rounded-full font-bold hover:bg-amber-300 text-sm shadow-md transition-all">Registrarse</Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. MOBILE MENU (dropdown) */}
      {menuOpen && (
        <div id="nav-movil" className="ev-nav-menu absolute top-full left-0 right-0 z-50 border-b text-white shadow-xl backdrop-blur-md md:hidden font-['Fredoka',sans-serif]">
          {user ? (
            <div className="flex flex-col p-4 space-y-3">
              {mobileModuleLinks}
              {user.rol === 'admin' && (
                <Link to="/admin" onClick={closeMenu} className="text-amber-300 hover:text-amber-200 font-medium text-sm py-2">Admin</Link>
              )}
              <Link to="/perfil" onClick={closeMenu} className="ev-focusable text-white/80 hover:text-white font-medium text-sm py-2">Mi Perfil</Link>
              <hr className="border-blue-800" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{user.nombre}</span>
                {/* Sin rojo: en este proyecto el rojo esta reservado para urgencia
                  (vencimientos, errores). Cerrar sesion no es urgente, y un
                  boton rojo ahi hace pensar que algo va mal. */}
                <button type="button" onClick={handleLogout} className="ev-focusable text-amber-300 hover:text-amber-200 font-bold text-sm">
                  Cerrar Sesión
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col p-4 space-y-3">
              <Link to="/login" onClick={closeMenu} className="ev-focusable text-white font-bold text-sm py-2">Iniciar Sesión</Link>
              <Link to="/signup" onClick={closeMenu} className="bg-amber-400 text-blue-950 px-5 py-2.5 rounded-full font-black text-sm shadow-md text-center">Registrarse gratis</Link>
            </div>
          )}
        </div>
      )}

      {/* En movil no hay grupo de acciones visible, asi que el tema y el inicio
          se dibujan aparte, al borde derecho, junto al hamburger.
          `md:hidden` hace que nunca coexistan las dos instancias. */}
      <BotonTema oscuro={oscuro} alternar={alternar} className="md:hidden" />
      <BotonInicio wrapper />
    </nav>
  );
};

export default Navbar;
