import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const Upload = () => {
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({ titulo: '', materia: '', descripcion: '' });
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Por favor, selecciona un archivo (PDF o Imagen)");

    setCargando(true);
    
    // IMPORTANTE: Para enviar archivos usamos FormData
    const data = new FormData();
    data.append('archivo', file);
    data.append('titulo', formData.titulo);
    data.append('materia', formData.materia);
    data.append('descripcion', formData.descripcion);
    data.append('usuario_id', localStorage.getItem('usuario_id'));

 try {
  await axios.post(`${API_URL}/apuntes/upload`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  // SUSTITUIR EL alert POR ESTO:
  toast.success('¡Apunte compartido con éxito! 🚀', {
    duration: 4000,
    style: {
      borderRadius: '15px',
      background: '#333',
      color: '#fff',
    },
  });

  navigate('/');
} catch (err) {
  toast.error('Hubo un error al subir el archivo'); // <--- Notificación de error
  console.error(err);
}
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
      <header className="mb-8">
        <h2 className="text-3xl font-black text-gray-800">Compartir Apunte</h2>
        <p className="text-gray-500">Ayuda a la comunidad de Edu-Verse subiendo tu material de estudio.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Area de Carga de Archivo */}
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center bg-gray-50 hover:border-blue-400 transition-colors cursor-pointer relative">
          <input 
            type="file" 
            className="absolute inset-0 opacity-0 cursor-pointer" 
            onChange={handleFileChange}
            accept=".pdf,.png,.jpg,.jpeg"
          />
          <span className="text-4xl mb-2">📁</span>
          <p className="text-sm font-bold text-gray-700">
            {file ? file.name : "Haz clic o arrastra tu archivo aquí"}
          </p>
          <p className="text-xs text-gray-400 mt-1">PDF, PNG o JPG (Máx. 10MB)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Título del Apunte</label>
            <input 
              type="text" 
              placeholder="Ej: Resumen de Álgebra Lineal"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
              onChange={(e) => setFormData({...formData, titulo: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Materia</label>
            <input 
              type="text" 
              placeholder="Ej: Matemáticas II"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
              onChange={(e) => setFormData({...formData, materia: e.target.value})}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Descripción (Opcional)</label>
          <textarea 
            rows="3"
            placeholder="¿De qué trata este apunte?"
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
            onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
          ></textarea>
        </div>

        <button 
          disabled={cargando}
          className={`w-full py-4 rounded-2xl font-bold text-lg text-white transition-all ${cargando ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100'}`}
        >
          {cargando ? "Subiendo..." : "Publicar Apunte"}
        </button>
      </form>
    </div>
  );
};

export default Upload;