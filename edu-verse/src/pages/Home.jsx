import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import InfoModulo from '../components/InfoModulo';

const CLAVE_RACHA = 'eduverse_racha';

// La fecha se guarda como YYYY-MM-DD en hora local. Comparar strings funciona
// porque el formato es ordenable, y evita el problema de los toISOString() que
// corren en UTC y pueden jumpingear un dia segun donde este el usuario.
const claveDia = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const leerRacha = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_RACHA));
    return guardado && typeof guardado.dias === 'number' ? guardado : { ultima_fecha: null, dias: 0 };
  } catch {
    // localStorage corrupto o no disponible: se empieza de cero sin romper
    return { ultima_fecha: null, dias: 0 };
  }
};

// Cada visita al Home cuenta como actividad. Consecutiva -> suma, con un hueco
// -> reinicia. No cuenta dos veces el mismo dia: por eso se compara antes.
const registrarActividad = () => {
  const datos = leerRacha();
  const hoy = claveDia(0);

  if (datos.ultima_fecha === hoy) return datos.dias;

  const dias = datos.ultima_fecha === claveDia(1) ? datos.dias + 1 : 1;
  localStorage.setItem(CLAVE_RACHA, JSON.stringify({ ultima_fecha: hoy, dias }));
  return dias;
};

const Home = () => {
  const [userName, setUserName] = useState('');
  const [isMascotaBouncing, setIsMascotaBouncing] = useState(false);
  const [racha, setRacha] = useState(0);
  const [rachaMostrada, setRachaMostrada] = useState(0);
  const rachaRafRef = useRef(0);

  useEffect(() => {
    const storedName = localStorage.getItem('usuario');
    if (storedName) setUserName(storedName); // eslint-disable-line react-hooks/set-state-in-effect
  }, [setUserName]);

  useEffect(() => {
    setRacha(registrarActividad());
  }, []);

  // Conteo del numero: un solo rAF con easeOutCubic. El valor mostrado vive
  // aparte del valor real para no disparar el resto de renders por frame.
  useEffect(() => {
    if (racha <= 0) {
      setRachaMostrada(0);
      return undefined;
    }

    const duracion = 800;
    const inicio = performance.now();

    const paso = (ahora) => {
      const t = Math.min((ahora - inicio) / duracion, 1);
      setRachaMostrada(Math.round(racha * (1 - (1 - t) ** 3)));
      if (t < 1) rachaRafRef.current = requestAnimationFrame(paso);
    };

    rachaRafRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rachaRafRef.current);
  }, [racha]);

  useEffect(() => {
    let bounceTimeout;
    const bounceMascot = () => {
      setIsMascotaBouncing(true);
      bounceTimeout = window.setTimeout(() => setIsMascotaBouncing(false), 2200);
    };

    bounceMascot();
    const bounceInterval = window.setInterval(bounceMascot, 5000);

    return () => {
      window.clearInterval(bounceInterval);
      window.clearTimeout(bounceTimeout);
    };
  }, []);

  const modulos = [
    {
      titulo: 'Biblioteca',
      descripcion: 'Explora y comparte apuntes, documentos y materiales de estudio con tu comunidad.',
      detalle: 'Sube tus apuntes en PDF o imagen, explora los que comparten tus compañeros, filtra por materia, guarda favoritos y califica cada material con estrellas. Todo el contenido queda organizado y se puede buscar por nombre.',
      icono: '/Iconos/libros.png',
      link: '/biblioteca',
      activo: true,
      color: 'from-blue-600 to-indigo-600',
      iconBg: 'bg-blue-50 dark:bg-blue-500/15',
      demora: 'ev-d-2',
    },
    {
      titulo: 'Gestor de Equipos',
      descripcion: 'Organiza tu equipo de estudio, asigna tareas y colabora en tiempo real.',
      detalle: 'Crea un equipo o únete con un código, organiza el trabajo en un tablero kanban, chatea con tu equipo en tiempo real, asigna tareas con fecha de entrega y revisa el avance en un dashboard con métricas y calendario de vencimientos.',
      icono: '/Iconos/grupo2.png',
      link: '/gestor-equipos',
      activo: true,
      color: 'from-indigo-600 to-violet-600',
      iconBg: 'bg-indigo-50 dark:bg-indigo-500/15',
      demora: 'ev-d-3',
    },
    {
      titulo: 'Tutor IA',
      descripcion: 'Aprende con inteligencia artificial: resuelve dudas, genera resúmenes y más.',
      detalle: 'Próximamente. Un asistente que responde dudas sobre tu materia, genera resúmenes a partir de tus apuntes y te sugiere ejercicios para practicar antes del examen.',
      icono: '/Iconos/mascota_robot.png',
      link: null,
      activo: false,
      color: '',
      iconBg: 'bg-slate-100 dark:bg-slate-800',
      demora: 'ev-d-4',
    },
  ];

  return (
    <main className="ev-home-fondo relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">

      <div className="relative mx-auto max-w-[88rem] rounded-3xl border border-white/80 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/70 p-4 shadow-2xl backdrop-blur-xl sm:p-10">
        <header className="relative isolate mb-6 sm:mb-10 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-10 text-center text-white shadow-lg sm:px-6 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-12 h-56 w-56 rounded-full bg-purple-300/20 blur-2xl" />
          {/* RACHA: esquina superior derecha del header. En movil se centra y baja
              al flujo, porque no hay ancho para dos cosas a los costados. */}
          <div className="relative z-10 mb-4 flex justify-center lg:absolute lg:right-8 lg:top-8 lg:mb-0 lg:justify-end ev-enter ev-d-1">
            <div className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 py-1.5 pl-2 pr-4 shadow-lg shadow-orange-900/25 ring-2 ring-white/25 sm:gap-4 sm:py-2.5 sm:pl-3 sm:pr-6">
              <span className="grid place-items-center rounded-full bg-white/25 px-1">
                <span
                  aria-hidden="true"
                  className="ev-flama block text-2xl leading-none sm:text-3xl"
                >
                  🔥
                </span>
              </span>
              <span className="flex items-baseline gap-1.5 text-left sm:gap-2">
                <span
                  className="text-2xl font-black tabular-nums leading-none text-blue-950 sm:text-4xl"
                  aria-label={`Racha de ${rachaMostrada} ${rachaMostrada === 1 ? 'día' : 'días'}`}
                >
                  {rachaMostrada}
                </span>
                <span className="text-xs font-bold leading-tight text-blue-950/80 sm:text-base">
                  {rachaMostrada === 1 ? 'día seguido' : 'días seguidos'}
                </span>
              </span>
            </div>
          </div>

          <h1 className="relative z-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-4xl font-black tracking-tight sm:text-7xl">
            <span>Hola, {userName || 'Estudiante'}</span>
            <img
              src="/Imagenes_Diseño/mascota_riendo.png"
              alt="Mascota de Edu-Verse riendo"
              className={`ev-float h-20 w-20 object-contain sm:h-28 sm:w-28 ${isMascotaBouncing ? 'ev-rebote-suave' : ''}`}
            />
          </h1>
          <p className="relative z-10 mt-4 text-base text-blue-50 sm:text-2xl">
            Bienvenido a Edu-Verse – elige un módulo para comenzar
          </p>
        </header>

        <section aria-label="Módulos educativos" className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {modulos.map((modulo) => {
            const cardContent = (
              <article className={`ev-enter ${modulo.demora} group relative flex h-full min-h-[17rem] sm:min-h-[21rem] flex-col items-center rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-800 p-6 text-center shadow-sm transition-all duration-300 sm:p-9 ${modulo.activo ? 'hover:-translate-y-1 hover:shadow-xl' : 'bg-slate-50/80 dark:bg-slate-800/60 opacity-65'}`}>
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  {!modulo.activo && (
                    <span className="rounded-full bg-slate-200 px-3.5 py-1.5 text-sm font-bold tracking-wider text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                      PRÓXIMAMENTE
                    </span>
                  )}
                  <InfoModulo texto={modulo.detalle} etiqueta={modulo.titulo} />
                </div>

                <div className={`mb-4 sm:mb-6 flex items-center justify-center rounded-full ${modulo.icono === '/Iconos/grupo2.png' || modulo.icono === '/Iconos/libros.png' || modulo.icono === '/Iconos/mascota_robot.png' ? 'h-24 w-24 sm:h-36 sm:w-36' : 'h-20 w-20 sm:h-32 sm:w-32'} ${modulo.iconBg}`}>
                  {modulo.icono ? (
                    <img
                      src={modulo.icono}
                      alt=""
                      className={`object-contain transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${modulo.icono === '/Iconos/grupo2.png' || modulo.icono === '/Iconos/libros.png' || modulo.icono === '/Iconos/mascota_robot.png' ? 'h-20 w-20 sm:h-32 sm:w-32' : 'h-16 w-16 sm:h-24 sm:w-24'}`}
                    />
                  ) : (
                    <span aria-hidden="true" className="text-5xl sm:text-6xl">🤖</span>
                  )}
                </div>

                <h2 className={`mb-3 text-2xl sm:text-3xl font-bold ${modulo.activo ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                  {modulo.titulo}
                </h2>
                <p className="mb-5 sm:mb-7 flex-1 text-base leading-relaxed text-slate-500 dark:text-slate-400 sm:text-xl">
                  {modulo.descripcion}
                </p>

                {modulo.activo ? (
                  <span className={`ev-btn ev-shimmer inline-flex items-center overflow-hidden rounded-xl bg-gradient-to-r ${modulo.color} px-6 sm:px-7 py-3 text-lg sm:text-xl font-semibold text-white shadow-md transition-all hover:shadow-lg`}>
                    Entrar →
                  </span>
                ) : (
                  <span className="inline-flex cursor-not-allowed items-center rounded-xl bg-slate-200 dark:bg-slate-700 px-6 sm:px-7 py-3 text-lg sm:text-xl font-semibold text-slate-400 dark:text-slate-400">
                    Próximamente
                  </span>
                )}
              </article>
            );

            return modulo.activo && modulo.link ? (
              <Link key={modulo.titulo} to={modulo.link} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:focus-visible:ring-blue-600">
                {cardContent}
              </Link>
            ) : (
              <div key={modulo.titulo} className="h-full">{cardContent}</div>
            );
          })}
        </section>
      </div>
    </main>
  );
};

export default Home;
