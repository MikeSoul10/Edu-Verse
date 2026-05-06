import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const DetalleApunte = () => {
  const { id } = useParams();
  const [apunte, setApunte] = useState(null);
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState('');
  const [comentarios, setComentarios] = useState([]);
  
  const usuarioId = localStorage.getItem('usuario_id');
  const nombreUsuario = localStorage.getItem('usuario');

  // 1. Cargar datos del apunte y sus comentarios desde la DB
  const cargarDatos = async () => {
    try {
      // Traemos el detalle del apunte (que incluye promedio de estrellas)
      const resApunte = await axios.get(`http://localhost:4000/apuntes/detalle/${id}`);
      setApunte(resApunte.data);

      // Traemos los comentarios reales de la tabla 'comentarios'
      const resComentarios = await axios.get(`http://localhost:4000/comentarios/${id}`);
      setComentarios(resComentarios.data);
    } catch (err) {
      console.error("Error al cargar datos:", err);
      toast.error("No se pudo cargar la información");
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [id]);

  // 2. Función para enviar comentario y calificación a la DB
  const enviarComentario = async (e) => {
    e.preventDefault();

    if (!usuarioId) return toast.error("Debes iniciar sesión para comentar");
    if (rating === 0) return toast.warning("Por favor, selecciona una puntuación (estrellas)");

    try {
      // Enviamos el comentario
      await axios.post('http://localhost:4000/comentarios', {
        apunte_id: id,
        usuario_id: usuarioId,
        texto: comentario
      });

      // Enviamos la valoración (rating)
      await axios.post('http://localhost:4000/valoraciones', {
        apunte_id: id,
        usuario_id: usuarioId,
        estrellas: rating
      });

      toast.success("¡Gracias por tu opinión! ⭐");
      
      // Limpiamos campos y refrescamos datos
      setComentario('');
      setRating(0);
      cargarDatos(); 
      
    } catch (err) {
      console.error(err);
      toast.error("Error al publicar tu comentario");
    }
  };

  if (!apunte) return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Cabecera del Apunte */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase">
              {apunte.materia}
            </span>
            <h1 className="text-4xl font-black text-gray-900 mt-3">{apunte.titulo}</h1>
            <p className="text-gray-500 mt-2">
              Por: <span className="text-blue-600 font-semibold">{apunte.autor}</span> • 
              ⭐ <span className="text-gray-900 font-bold">{parseFloat(apunte.promedio_rating || 0).toFixed(1)}</span>
            </p>
          </div>
          
          <a 
            href={`http://localhost:4000${apunte.archivo_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            📄 Abrir PDF
          </a>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-50">
          <h3 className="font-bold text-gray-800 mb-2">Descripción del material:</h3>
          <p className="text-gray-600 leading-relaxed">{apunte.descripcion || "Sin descripción proporcionada."}</p>
        </div>
      </div>

      {/* Sección de Comunidad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario */}
        <section className="lg:col-span-1 bg-white p-6 rounded-3xl border border-gray-100 h-fit sticky top-24">
          <h3 className="font-bold text-lg mb-4 text-gray-900">Tu opinión importa</h3>
          <form onSubmit={enviarComentario}>
            <p className="text-xs text-gray-400 mb-2 uppercase font-bold">Califica la calidad:</p>
            <div className="flex space-x-1 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-transform hover:scale-125 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-400 outline-none text-sm mb-4 transition-all"
              placeholder="¿Qué te pareció este apunte?"
              rows="4"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              required
            ></textarea>

            <button className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-md">
              Publicar Comentario
            </button>
          </form>
        </section>

        {/* Lista de comentarios reales */}
        <section className="lg:col-span-2">
          <h3 className="font-bold text-xl mb-6 text-gray-900">
            Comunidades y Dudas ({comentarios.length})
          </h3>
          
          {comentarios.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed">
              <p className="text-gray-400 italic">Nadie ha comentado todavía. ¡Sé el primero!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comentarios.map((c) => (
                <div key={c.comentario_id} className="bg-white p-6 rounded-3xl border border-gray-50 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                        {c.nombre.charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-gray-800">{c.nombre}</span>
                    </div>
                    <span className="text-gray-300 text-xs italic">
                      {new Date(c.fecha_creacion).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{c.texto}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DetalleApunte;