import { createContext, useContext, useState, useCallback } from 'react';
import { AUTH_EVENT, emitAuthChange } from '../authEvents';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const nombre = localStorage.getItem('usuario');
    const id = localStorage.getItem('usuario_id');
    const foto = localStorage.getItem('foto_url');
    return nombre && id ? { nombre, id, foto } : null;
  });

  const login = useCallback((datos) => {
    localStorage.setItem('token', datos.token);
    localStorage.setItem('usuario', datos.usuario.nombre);
    localStorage.setItem('usuario_id', datos.usuario.id);
    if (datos.usuario.foto_url) {
      localStorage.setItem('foto_url', datos.usuario.foto_url);
    }
    setUser({
      nombre: datos.usuario.nombre,
      id: datos.usuario.id,
      foto: datos.usuario.foto_url || null,
    });
    emitAuthChange();
  }, []);

  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
    emitAuthChange();
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      if (patch.nombre) localStorage.setItem('usuario', patch.nombre);
      if (patch.foto) localStorage.setItem('foto_url', patch.foto);
      return next;
    });
    emitAuthChange();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
