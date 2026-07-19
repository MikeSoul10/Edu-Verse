import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const storedName = localStorage.getItem('usuario');
    if (storedName) setUserName(storedName);
  }, []);

  const modulos = [
    {
      titulo: 'Biblioteca',
      descripcion: 'Explora y comparte apuntes, documentos y materiales de estudio con tu comunidad.',
      icono: '📚',
      link: '/biblioteca',
      activo: true,
      color: 'from-blue-500 to-indigo-600',
      hoverColor: 'hover:from-blue-600 hover:to-indigo-700',
      bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50',
    },
    {
      titulo: 'Gestor de Equipos',
      descripcion: 'Organiza tu equipo de estudio, asigna tareas y colabora en tiempo real.',
      icono: '👥',
      link: '/gestor-equipos',
      activo: true,
      color: 'from-emerald-500 to-teal-600',
      hoverColor: 'hover:from-emerald-600 hover:to-teal-700',
      bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    },
    {
      titulo: 'Tutor IA',
      descripcion: 'Aprende con inteligencia artificial: resuelve dudas, genera resúmenes y más.',
      icono: '🤖',
      link: null,
      activo: false,
      color: 'from-purple-500 to-pink-600',
      hoverColor: '',
      bgColor: 'bg-gradient-to-br from-purple-50 to-pink-50',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">

      {/* Header */}
      <header className="mb-10 p-8 md:p-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] shadow-xl text-white">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight">
          Hola, {userName || 'Estudiante'} 👋
        </h1>
        <p className="opacity-90 mt-3 text-lg">Bienvenido a Edu-Verse — elige un módulo para comenzar</p>
      </header>

      {/* Grid de Módulos */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {modulos.map((modulo) => {
          const cardContent = (
            <div
              className={`
                relative group bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm
                flex flex-col items-center text-center
                transition-all duration-300
                ${modulo.activo
                  ? 'hover:shadow-2xl hover:-translate-y-2 cursor-pointer'
                  : 'opacity-60 cursor-not-allowed'
                }
              `}
            >
              {/* Badge "Próximamente" */}
              {!modulo.activo && (
                <span className="absolute top-5 right-5 text-[10px] font-black uppercase tracking-widest bg-gray-900 text-white px-3 py-1 rounded-full">
                  Próximamente
                </span>
              )}

              {/* Icono */}
              <div className={`w-24 h-24 ${modulo.bgColor} rounded-[2rem] flex items-center justify-center text-5xl mb-6 transition-transform duration-300 ${modulo.activo ? 'group-hover:scale-110' : ''}`}>
                {modulo.icono}
              </div>

              {/* Texto */}
              <h3 className={`text-2xl font-black text-gray-900 mb-3 ${modulo.activo ? 'group-hover:text-blue-600 transition-colors' : ''}`}>
                {modulo.titulo}
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-6">
                {modulo.descripcion}
              </p>

              {/* Botón */}
              {modulo.activo ? (
                <span className={`mt-auto bg-gradient-to-r ${modulo.color} ${modulo.hoverColor} text-white px-8 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95`}>
                  Entrar →
                </span>
              ) : (
                <span className="mt-auto bg-gray-100 text-gray-400 px-8 py-3 rounded-2xl font-black cursor-not-allowed">
                  Próximamente
                </span>
              )}
            </div>
          );

          return modulo.activo && modulo.link ? (
            <Link key={modulo.titulo} to={modulo.link} className="block">
              {cardContent}
            </Link>
          ) : (
            <div key={modulo.titulo}>
              {cardContent}
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default Home;
