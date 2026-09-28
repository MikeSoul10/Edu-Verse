import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  const [userName, setUserName] = useState('');
  const [isMascotaBouncing, setIsMascotaBouncing] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem('usuario');
    if (storedName) setUserName(storedName); // eslint-disable-line react-hooks/set-state-in-effect
  }, [setUserName]);

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
      icono: '/modulos/biblioteca.png',
      link: '/biblioteca',
      activo: true,
      color: 'from-blue-600 to-indigo-600',
      iconBg: 'bg-blue-50',
    },
    {
      titulo: 'Gestor de Equipos',
      descripcion: 'Organiza tu equipo de estudio, asigna tareas y colabora en tiempo real.',
      icono: '/modulos/gestor-equipos.png',
      link: '/gestor-equipos',
      activo: true,
      color: 'from-indigo-600 to-violet-600',
      iconBg: 'bg-indigo-50',
    },
    {
      titulo: 'Tutor IA',
      descripcion: 'Aprende con inteligencia artificial: resuelve dudas, genera resúmenes y más.',
      icono: null,
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

      <div className="relative mx-auto max-w-6xl rounded-3xl border border-white/80 bg-white/60 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <header className="relative isolate mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-10 text-center text-white shadow-lg sm:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-12 h-56 w-56 rounded-full bg-purple-300/20 blur-2xl" />
          <h1 className="relative z-10 flex flex-wrap items-center justify-center gap-3 text-3xl font-black tracking-tight sm:text-5xl">
            <span>Hola, {userName || 'Estudiante'}</span>
            <img
              src="/Imagenes_Diseño/mascota_riendo.png"
              alt="Mascota de Edu-Verse riendo"
              className={`h-14 w-14 object-contain sm:h-16 sm:w-16 ${isMascotaBouncing ? 'mascota-rebote-suave' : ''}`}
            />
          </h1>
          <p className="relative z-10 mt-3 text-base text-blue-50 sm:text-lg">
            Bienvenido a Edu-Verse – elige un módulo para comenzar
          </p>
        </header>

        <section aria-label="Módulos educativos" className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {modulos.map((modulo) => {
            const cardContent = (
              <article className={`relative flex h-full flex-col items-center rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm transition-all duration-300 ${modulo.activo ? 'hover:-translate-y-1 hover:shadow-xl' : 'bg-slate-50/80 opacity-65'}`}>
                {!modulo.activo && (
                  <span className="absolute right-4 top-4 rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold tracking-wider text-slate-500">
                    PRÓXIMAMENTE
                  </span>
                )}

                <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ${modulo.iconBg}`}>
                  {modulo.icono ? (
                    <img src={modulo.icono} alt="" className="h-14 w-14 object-contain" />
                  ) : (
                    <span aria-hidden="true" className="text-4xl">🤖</span>
                  )}
                </div>

                <h2 className={`mb-2 text-xl font-bold ${modulo.activo ? 'text-slate-800' : 'text-slate-500'}`}>
                  {modulo.titulo}
                </h2>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-500">
                  {modulo.descripcion}
                </p>

                {modulo.activo ? (
                  <span className={`inline-flex items-center rounded-xl bg-gradient-to-r ${modulo.color} px-6 py-2.5 font-semibold text-white shadow-md transition-all hover:shadow-lg`}>
                    Entrar →
                  </span>
                ) : (
                  <span className="inline-flex cursor-not-allowed items-center rounded-xl bg-slate-200 px-6 py-2.5 font-semibold text-slate-400">
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

        <section aria-label="Actividad reciente" className="mt-8 border-t border-slate-200 pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-white/80 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Último apunte visto</p>
              <p className="mt-1 font-semibold text-slate-700">Cálculo II - Resumen.pdf</p>
            </article>
            <article className="rounded-2xl border border-white/80 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Equipos activos</p>
              <p className="mt-1 font-semibold text-slate-700">2 Grupos de estudio</p>
            </article>
            <article className="rounded-2xl border border-white/80 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Racha de estudio</p>
              <p className="mt-1 font-semibold text-slate-700">🔥 5 días seguidos</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Home;
