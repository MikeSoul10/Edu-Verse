import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';

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
      icono: '/Iconos/libros.png',
      link: '/biblioteca',
      activo: true,
      color: 'from-blue-600 to-indigo-600',
      iconBg: 'bg-blue-50',
    },
    {
      titulo: 'Gestor de Equipos',
      descripcion: 'Organiza tu equipo de estudio, asigna tareas y colabora en tiempo real.',
      icono: '/Iconos/grupo2.png',
      link: '/gestor-equipos',
      activo: true,
      color: 'from-indigo-600 to-violet-600',
      iconBg: 'bg-indigo-50',
    },
    {
      titulo: 'Tutor IA',
      descripcion: 'Aprende con inteligencia artificial: resuelve dudas, genera resúmenes y más.',
      icono: '/Iconos/mascota_robot.png',
      link: null,
      activo: false,
      color: '',
      iconBg: 'bg-slate-100',
    },
  ];

  return (
    <main
      className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8"
      style={{
        backgroundColor: '#f0f6ff',
        backgroundImage: 'radial-gradient(ellipse at 25% 10%, rgba(96, 165, 250, 0.30), transparent 48%), radial-gradient(ellipse at 85% 55%, rgba(147, 197, 253, 0.34), transparent 45%)',
      }}
    >

      <div className="relative mx-auto max-w-[88rem] rounded-3xl border border-white/80 bg-white/60 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
        <header className="relative isolate mb-10 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-12 text-center text-white shadow-lg sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-12 h-56 w-56 rounded-full bg-purple-300/20 blur-2xl" />
          {/* RACHA: esquina superior derecha del header. En movil se centra y baja
              al flujo, porque no hay ancho para dos cosas a los costados. */}
          <div className="relative z-10 mb-6 flex justify-center lg:absolute lg:right-8 lg:top-8 lg:mb-0 lg:justify-end ev-enter ev-d-1">
            <div className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 py-2 pl-2.5 pr-5 shadow-lg shadow-orange-900/25 ring-2 ring-white/25 sm:gap-4 sm:py-2.5 sm:pl-3 sm:pr-6">
              <span className="grid place-items-center rounded-full bg-white/25 px-1">
                <span
                  aria-hidden="true"
                  className="ev-flama block text-2xl leading-none sm:text-3xl"
                >
                  🔥
                </span>
              </span>
              <span className="flex items-baseline gap-2 text-left">
                <span
                  className="text-3xl font-black tabular-nums leading-none text-blue-950 sm:text-4xl"
                  aria-label={`Racha de ${rachaMostrada} ${rachaMostrada === 1 ? 'día' : 'días'}`}
                >
                  {rachaMostrada}
                </span>
                <span className="text-sm font-bold leading-tight text-blue-950/80 sm:text-base">
                  {rachaMostrada === 1 ? 'día seguido' : 'días seguidos'}
                </span>
              </span>
            </div>
          </div>

          <h1 className="relative z-10 flex flex-wrap items-center justify-center gap-4 text-5xl font-black tracking-tight sm:text-7xl">
            <span>Hola, {userName || 'Estudiante'}</span>
            <img
              src="/Imagenes_Diseño/mascota_riendo.png"
              alt="Mascota de Edu-Verse riendo"
              className={`h-24 w-24 object-contain sm:h-28 sm:w-28 ${isMascotaBouncing ? 'ev-rebote-suave' : ''}`}
            />
          </h1>
          <p className="relative z-10 mt-4 text-xl text-blue-50 sm:text-2xl">
            Bienvenido a Edu-Verse – elige un módulo para comenzar
          </p>
        </header>

        <section aria-label="Módulos educativos" className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {modulos.map((modulo) => {
            const cardContent = (
              <article className={`relative flex h-full min-h-[21rem] flex-col items-center rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm transition-all duration-300 sm:p-9 ${modulo.activo ? 'hover:-translate-y-1 hover:shadow-xl' : 'bg-slate-50/80 opacity-65'}`}>
                {!modulo.activo && (
                  <span className="absolute right-4 top-4 rounded-full bg-slate-200 px-3.5 py-1.5 text-sm font-bold tracking-wider text-slate-500">
                    PRÓXIMAMENTE
                  </span>
                )}

                <div className={`mb-6 flex items-center justify-center rounded-full ${modulo.icono === '/Iconos/grupo2.png' || modulo.icono === '/Iconos/libros.png' || modulo.icono === '/Iconos/mascota_robot.png' ? 'h-32 w-32 sm:h-36 sm:w-36' : 'h-28 w-28 sm:h-32 sm:w-32'} ${modulo.iconBg}`}>
                  {modulo.icono ? (
                    <img
                      src={modulo.icono}
                      alt=""
                      className={`object-contain ${modulo.icono === '/Iconos/grupo2.png' || modulo.icono === '/Iconos/libros.png' || modulo.icono === '/Iconos/mascota_robot.png' ? 'h-28 w-28 sm:h-32 sm:w-32' : 'h-20 w-20 sm:h-24 sm:w-24'}`}
                    />
                  ) : (
                    <span aria-hidden="true" className="text-6xl">🤖</span>
                  )}
                </div>

                <h2 className={`mb-3 text-3xl font-bold ${modulo.activo ? 'text-slate-800' : 'text-slate-500'}`}>
                  {modulo.titulo}
                </h2>
                <p className="mb-7 flex-1 text-lg leading-relaxed text-slate-500 sm:text-xl">
                  {modulo.descripcion}
                </p>

                {modulo.activo ? (
                  <span className={`inline-flex items-center rounded-xl bg-gradient-to-r ${modulo.color} px-7 py-3 text-xl font-semibold text-white shadow-md transition-all hover:shadow-lg`}>
                    Entrar →
                  </span>
                ) : (
                  <span className="inline-flex cursor-not-allowed items-center rounded-xl bg-slate-200 px-7 py-3 text-xl font-semibold text-slate-400">
                    Próximamente
                  </span>
                )}
              </article>
            );

            return modulo.activo && modulo.link ? (
              <Link key={modulo.titulo} to={modulo.link} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300">
                {cardContent}
              </Link>
            ) : (
              <div key={modulo.titulo} className="h-full">{cardContent}</div>
            );
          })}
        </section>

        <section aria-label="Actividad reciente" className="mt-10 border-t border-slate-200 pt-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/80 bg-white/70 p-5">
              <p className="text-base font-semibold uppercase tracking-wide text-slate-400">Último apunte visto</p>
              <p className="mt-2 text-xl font-semibold text-slate-700">Cálculo II - Resumen.pdf</p>
            </article>
            <article className="rounded-2xl border border-white/80 bg-white/70 p-5">
              <p className="text-base font-semibold uppercase tracking-wide text-slate-400">Equipos activos</p>
              <p className="mt-2 text-xl font-semibold text-slate-700">2 Grupos de estudio</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Home;
