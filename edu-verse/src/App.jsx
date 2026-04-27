import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Signup from './pages/Signup';
import Login from './pages/Login'; // <--- Importa el nuevo componente
import Home from './pages/Home';
import Profile from './pages/Profile';
import Upload from './pages/Upload';
import Apuntes from './pages/Apuntes';


function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;