import React from 'react';
import { Link } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
          <div className="text-6xl mb-4">💥</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Algo salió mal</h2>
          <p className="text-gray-500 mb-8">Ocurrió un error inesperado. Por favor, intenta de nuevo.</p>
          <Link
            to="/"
            onClick={(e) => {
              e.preventDefault();
              this.setState({ hasError: false });
              window.location.href = '/';
            }}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg"
          >
            Regresar a Inicio
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
