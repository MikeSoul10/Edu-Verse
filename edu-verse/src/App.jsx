import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Upload from './pages/Upload';
import Apuntes from './pages/Apuntes';
import DetalleApunte from './pages/DetalleApunte';
import MyNotes from './pages/MyNotes';
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
          <Route path="/perfil" element={<Profile />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/apuntes" element={<Apuntes />} />
          <Route path="/apunte/:id" element={<DetalleApunte />} />
          <Route path="/mis-apuntes" element={<MyNotes />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;