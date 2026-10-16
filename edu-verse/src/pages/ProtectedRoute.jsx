import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
    const token = localStorage.getItem('token');
    const { user } = useAuth();

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user?.rol !== requiredRole) {
        return <Navigate to="/" replace />;
    }
    
    return children;
};

export default ProtectedRoute;
