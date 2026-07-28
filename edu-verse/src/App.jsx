import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Home from './pages/Home';
import Biblioteca from './pages/Biblioteca';
import Profile from './pages/Profile';
import Upload from './pages/Upload';
import Apuntes from './pages/Apuntes';
import DetalleApunte from './pages/DetalleApunte';
import MyNotes from './pages/MyNotes';
import Favorites from './pages/Favorites';
import GestorEquipos from './pages/GestorEquipos';
import AdminPanel from './pages/AdminPanel';
import ProtectedRoute from './pages/ProtectedRoute';
import NotFound from './pages/NotFound';
import { Toaster } from 'react-hot-toast';


function App() {
  return (
    <Router>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          <Toaster position="top-right" reverseOrder={false} /> 
          <Navbar />
          
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
            <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
            <Route path="/apuntes" element={<ProtectedRoute><Apuntes /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </Router>
  );
}

export default App;