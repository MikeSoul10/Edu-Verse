import React from 'react';

const LoadingFallback = () => {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-4 border-blue-200 dark:border-blue-950 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <div className="absolute h-6 w-6 rounded-full bg-blue-500/20 animate-ping" />
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          Cargando...
        </p>
      </div>
    </div>
  );
};

export default LoadingFallback;
