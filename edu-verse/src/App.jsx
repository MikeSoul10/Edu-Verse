import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';
import ProtectedRoute from './pages/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

// Carga perezosa (code-splitting) para que el bundle principal no descargue
// librerías pesadas (socket.io, módulos complejos) hasta que el usuario visite la ruta.
const Home = lazy(() => import('./pages/Home'));
const Signup = lazy(() => import('./pages/Signup'));
const Login = lazy(() => import('./pages/Login'));
const Biblioteca = lazy(() => import('./pages/Biblioteca'));
const Profile = lazy(() => import('./pages/Profile'));
const Upload = lazy(() => import('./pages/Upload'));
const DetalleApunte = lazy(() => import('./pages/DetalleApunte'));
const MyNotes = lazy(() => import('./pages/MyNotes'));
const Favorites = lazy(() => import('./pages/Favorites'));
const GestorEquipos = lazy(() => import('./pages/GestorEquipos'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
          <Toaster position="top-right" reverseOrder={false} />
          <Navbar />
          
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/biblioteca" element={<Biblioteca />} />
              <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
              <Route path="/apunte/:id" element={<DetalleApunte />} />
              <Route path="/mis-apuntes" element={<ProtectedRoute><MyNotes /></ProtectedRoute>} />
              <Route path="/favoritos" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
              <Route path="/gestor-equipos" element={<ProtectedRoute><GestorEquipos /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>} />
              {/* Mantiene los enlaces antiguos y concentra la exploración en una sola biblioteca. */}
              <Route path="/apuntes" element={<Navigate to="/biblioteca" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
