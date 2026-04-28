import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const DetalleApunte = () => {
  const { id } = useParams();
  const [apunte, setApunte] = useState(null);
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState('');
  const [comentarios, setComentarios] = useState([]);

  useEffect(() => {
    // 1. Cargar datos del apunte y sus comentarios existentes
    const cargarDatos = async () => {
  try {
    const res = await axios.get(`http://localhost:4000/apuntes/${id}`);
    
    // Verificamos que los datos existan antes de setearlos
    if (res.data) {
      setApunte(res.data);
    }
  } catch (err) {
    // Si el backend lanza el 500, aquí lo atrapamos
    console.error("Error al traer el detalle del apunte:", err.response?.data || err.message);
  }
};
    cargarDatos();
  }, [id]);

  const enviarComentario = (e) => {
    e.preventDefault();
    const nuevoComentario = {
      usuario: localStorage.getItem('usuario') || 'Anónimo',
      texto: comentario,
      estrellas: rating,
      fecha: new Date().toLocaleDateString()
    };
    setComentarios([nuevoComentario, ...comentarios]);
    setComentario('');
    setRating(0);
    // Aquí harías el axios.post a tu backend para guardar en la DB
  };

  if (!apunte) return <div className="p-10 text-center">Cargando apunte...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Cabecera del Apunte */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <span className="text-blue-600 font-bold text-sm uppercase">{apunte.materia}</span>
        <h1 className="text-3xl font-black text-gray-900 mt-2">{apunte.titulo}</h1>
        <p className="text-gray-500 mt-2">Subido por: <span className="font-semibold">{apunte.autor}</span></p>
        
        <a 
          href={`http://localhost:4000${apunte.archivo_url}`}
          target="_blank"
          className="mt-6 inline-block bg-gray-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-black transition-all"
        >
          📄 Visualizar Documento PDF
        </a>
      </div>

      {/* Sección de Calificación y Comentarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Formulario para comentar */}
        <section className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
          <h3 className="font-bold text-lg mb-4">Calificar este apunte</h3>
          <form onSubmit={enviarComentario}>
            <div className="flex space-x-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-2xl ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              className="w-full p-4 rounded-2xl border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-400 outline-none text-sm mb-4"
              placeholder="Escribe tu opinión sobre este material..."
              rows="4"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              required
            ></textarea>
            <button className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-md">
              Publicar Comentario
            </button>
          </form>
        </section>

        {/* Lista de comentarios */}
        <section>
          <h3 className="font-bold text-lg mb-4">Opiniones ({comentarios.length})</h3>
          <div className="space-y-4">
            {comentarios.map((c, index) => (
              <div key={index} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-gray-800">{c.usuario}</span>
                  <span className="text-yellow-400 text-xs">{'★'.repeat(c.estrellas)}</span>
                </div>
                <p className="text-gray-600 text-sm">{c.texto}</p>
                <span className="text-[10px] text-gray-400 mt-2 block">{c.fecha}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DetalleApunte;