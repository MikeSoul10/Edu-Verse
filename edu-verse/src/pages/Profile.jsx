import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const [datos, setDatos] = useState({
    nombre: '',
    email: '',
    foto_url: ''
  });

  const [cargando, setCargando] = useState(true);
  const [nuevaFoto, setNuevaFoto] = useState(null);
  const [preview, setPreview] = useState(null);

  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const usuarioId = user?.id;

  useEffect(() => {
    const obtenerPerfil = async () => {
      if (!usuarioId) {
        navigate('/login');
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/auth/perfil/${usuarioId}`);
        setDatos({
          nombre: res.data.nombre,
          email: res.data.email,
          foto_url: res.data.foto_url
        });
        setCargando(false);
      } catch {
        toast.error("No se pudo cargar el perfil");
        setCargando(false);
      }
    };
    obtenerPerfil();
  }, [usuarioId, navigate]);

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNuevaFoto(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  const subirFoto = async () => {
    if (!nuevaFoto) return toast.warning("Selecciona una imagen");

    const formData = new FormData();
    formData.append('foto', nuevaFoto);

    try {
      const res = await axios.put(
        `${API_URL}/usuarios/foto/${usuarioId}`,
        formData
      );
      toast.success("Foto actualizada");
      updateUser({ foto: res.data.url });
      setDatos(prev => ({ ...prev, foto_url: res.data.url }));
      setPreview(null);
      setNuevaFoto(null);
    } catch {
      toast.error("Error al subir la foto");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (datos.nombre.trim().length < 3) {
      return toast.warning("Nombre muy corto");
    }
    try {
      const res = await axios.put(
        `${API_URL}/auth/perfil/update/${usuarioId}`,
        datos
      );
      toast.success("Perfil actualizado");
      updateUser({ nombre: res.data.nombre });
    } catch (err) {
      toast.error(err.response?.data || "Error al actualizar");
    }
  };

  if (cargando) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 sm:mt-10 px-4 sm:px-0">

      {/* MODULOS */}
      <div className="flex gap-3 mb-8">
        <Link
          to="/biblioteca"
          className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex items-center gap-3 group"
        >
          <div className="w-11 h-11 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <img src="/modulos/biblioteca.png" alt="" className="w-8 h-8 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-gray-900 text-sm truncate">Biblioteca</p>
            <p className="text-[10px] text-gray-400 font-medium">Apuntes y materiales</p>
          </div>
        </Link>

        <Link
          to="/gestor-equipos"
          className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex items-center gap-3 group"
        >
          <div className="w-11 h-11 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <img src="/modulos/gestor-equipos.png" alt="" className="w-8 h-8 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-gray-900 text-sm truncate">Equipos</p>
            <p className="text-[10px] text-gray-400 font-medium">Colabora en equipo</p>
          </div>
        </Link>

        <div className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm opacity-50 flex items-center gap-3 cursor-not-allowed">
          <div className="w-11 h-11 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl flex items-center justify-center shrink-0 text-2xl">
            🤖
          </div>
          <div className="min-w-0">
            <p className="font-black text-gray-900 text-sm truncate">Tutor IA</p>
            <p className="text-[10px] text-gray-400 font-medium">Próximamente</p>
          </div>
        </div>
      </div>

      {/* PERFIL */}
      <div className="p-6 sm:p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
      
      {/* SECCIÓN DE FOTO DE PERFIL OPTIMIZADA */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative group">
          {/* Contenedor de la Imagen */}
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl ring-2 ring-blue-500">
            <img
              src={
                preview ||
                (datos.foto_url
                  ? `${API_URL}${datos.foto_url}`
                  : `https://ui-avatars.com/api/?name=${datos.nombre}&background=0D8ABC&color=fff`)
              }
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              alt="Perfil"
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${datos.nombre}&background=ccc`; }}
            />
          </div>

          {/* Botón Flotante (Icono de cámara) */}
          <label 
            htmlFor="foto-upload" 
            className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-all transform hover:scale-110 border-2 border-white"
            title="Cambiar foto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.172-1.172A1 1 0 009.586 3H10.414a1 1 0 00-.707.293L8.535 4.707A1 1 0 017.828 5H4zm3 8a3 3 0 106 0 3 3 0 00-6 0z" clipRule="evenodd" />
            </svg>
          </label>

          {/* Input escondido */}
          <input
            id="foto-upload"
            type="file"
            onChange={handleFotoChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* Botón de confirmación (solo aparece si hay foto nueva) */}
        {nuevaFoto && (
          <div className="mt-4 flex flex-col items-center animate-bounce">
            <button
              onClick={subirFoto}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full text-xs font-bold shadow-md transition-all"
            >
              Confirmar Nueva Foto
            </button>
            <span className="text-[10px] text-gray-400 mt-1">{nuevaFoto.name}</span>
          </div>
        )}
      </div>

      {/* FORMULARIO */}
      <form onSubmit={handleUpdate} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
          <input
            type="text"
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={datos.email}
            disabled
            className="w-full p-4 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-bold transition-colors shadow-lg"
        >
          Actualizar Datos Personales
        </button>
      </form>
      </div>

    </div>
  );
};

export default Profile;