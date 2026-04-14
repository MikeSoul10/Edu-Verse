import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const [datos, setDatos] = useState({ nombre: '', email: '' });
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  // 1. OBTENER EL ID DEL USUARIO LOGUEADO
  const usuarioId = localStorage.getItem('usuario_id');

  // 2. CARGAR DATOS AL MONTAR EL COMPONENTE
  useEffect(() => {
    const obtenerPerfil = async () => {
      if (!usuarioId) {
        navigate('/login'); // Si no hay ID, lo mandamos al login
        return;
      }

      try {
        const res = await axios.get(`http://localhost:4000/auth/perfil/${usuarioId}`);
        setDatos({
          nombre: res.data.nombre,
          email: res.data.email
        });
        setCargando(false);
      } catch (err) {
        console.error("Error al cargar perfil:", err);
        alert("No se pudo cargar la información del perfil.");
        setCargando(false);
      }
    };

    obtenerPerfil();
  }, [usuarioId, navigate]);

  // 3. FUNCIÓN PARA ACTUALIZAR
  const handleUpdate = async (e) => {
    e.preventDefault();
    
    // Validación rápida antes de enviar
    if (datos.nombre.trim().length < 3) {
      return alert("El nombre es muy corto.");
    }

    try {
      const res = await axios.put(`http://localhost:4000/auth/perfil/update/${usuarioId}`, datos);
      
      alert("¡Perfil actualizado con éxito! ✨");
      
      // Actualizamos el localStorage para que el Navbar cambie el nombre al instante
      localStorage.setItem('usuario', datos.nombre);
      
      // Opcional: recargar la página para ver cambios
      window.location.reload(); 
    } catch (err) {
      alert(err.response?.data || "Error al actualizar los datos");
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
    <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
      <div className="flex items-center space-x-4 mb-8">
        <div className="bg-blue-100 p-4 rounded-2xl">
          <span className="text-3xl">👤</span>
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-800">Mi Perfil</h2>
          <p className="text-gray-500 text-sm">Gestiona tu información personal en Edu-Verse</p>
        </div>
      </div>
      
      <form onSubmit={handleUpdate} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nombre para mostrar</label>
          <input 
            type="text" 
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 transition-all font-medium"
            value={datos.nombre}
            placeholder="Tu nombre"
            onChange={(e) => setDatos({...datos, nombre: e.target.value})}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Correo Institucional</label>
          <input 
            type="email" 
            className="w-full p-4 bg-gray-100 border border-gray-200 rounded-xl text-gray-400 cursor-not-allowed font-medium"
            value={datos.email}
            disabled 
          />
          <p className="text-xs text-gray-400 mt-2 ml-1 italic">
            * El correo institucional no puede ser modificado por seguridad.
          </p>
        </div>

        <div className="pt-4">
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 hover:shadow-lg shadow-blue-100 transform active:scale-95 transition-all"
          >
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;