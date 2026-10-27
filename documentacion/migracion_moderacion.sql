-- Migración: tabla de logs de moderación de chat
-- Ejecutar manualmente contra la BD existente:
-- psql -U postgres -d Edu-verseDB -f documentacion/migracion_moderacion.sql
--
-- Incluye también las columnas de migracion_chat_vaciado.sql para que una
-- sola ejecución deje la tabla lista para el código actual.

CREATE TABLE IF NOT EXISTS public.moderacion_logs (
    moderacion_id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL,
    equipo_id INTEGER REFERENCES public.equipos(equipo_id) ON DELETE SET NULL,
    palabras_bloqueadas TEXT,
    sustituciones INTEGER NOT NULL DEFAULT 0,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accion TEXT,
    detalle TEXT
);

-- Cubre bases donde la tabla ya existía sin estas columnas.
ALTER TABLE public.moderacion_logs
    ADD COLUMN IF NOT EXISTS accion TEXT,
    ADD COLUMN IF NOT EXISTS detalle TEXT;

-- Backfill idempotente: las filas anteriores a 'accion' eran censuras.
UPDATE public.moderacion_logs SET accion = 'censo' WHERE accion IS NULL;

CREATE INDEX IF NOT EXISTS idx_moderacion_logs_fecha ON public.moderacion_logs(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_moderacion_logs_accion ON public.moderacion_logs(accion, fecha DESC);
