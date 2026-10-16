-- Migración: tabla de logs de moderación de chat
-- Ejecutar manualmente contra la BD existente:
-- psql -U postgres -d Edu-verseDB -f documentacion/migracion_moderacion.sql

CREATE TABLE IF NOT EXISTS public.moderacion_logs (
    moderacion_id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL,
    equipo_id INTEGER REFERENCES public.equipos(equipo_id) ON DELETE SET NULL,
    palabras_bloqueadas TEXT,
    sustituciones INTEGER NOT NULL DEFAULT 0,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_moderacion_logs_fecha ON public.moderacion_logs(fecha DESC);