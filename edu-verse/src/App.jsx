import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
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
import ProtectedRoute from './pages/ProtectedRoute';
import NotFound from './pages/NotFound';
import { Toaster } from 'react-hot-toast';


function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" reverseOrder={false} /> 
        <Navbar />
        
        <Routes>
          {/* Página principal (Home) */}
          <Route path="/" element={<Home />} />

          {/* Ruta para el Registro */}

          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} /> 
          <Route path="/Home" element={<Home />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/apunte/:id" element={<DetalleApunte />} />
          <Route path="/mis-apuntes" element={<MyNotes />} />
          <Route path="/favoritos" element={<Favorites />} />
          <Route 
    path="/apuntes" 
    element={
        <ProtectedRoute>
            <Apuntes />
        </ProtectedRoute>
    } 
/>
 <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;