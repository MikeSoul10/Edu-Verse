-- Migración: registro de vaciado de historial de chat
-- Ejecutar manualmente contra la BD existente:
-- docker exec -i edu-verse-postgres-1 psql -U postgres -d Edu-verseDB -f - < documentacion/migracion_chat_vaciado.sql
--
-- Agrega 'accion' para distinguir el filtro de groserías de un vaciado manual
-- del historial hecho por el admin del equipo, y 'detalle' para guardar el dato
-- variable de cada caso (las palabras censuradas, o cuántos mensajes se boraron).
--
-- El backfill deja las filas existentes como 'censo': si no, las 12 que ya
-- había quedarían con accion NULL y se mezclarían con los registros nuevos.

ALTER TABLE public.moderacion_logs
    ADD COLUMN IF NOT EXISTS accion  TEXT,
    ADD COLUMN IF NOT EXISTS detalle TEXT;

-- Backfill idempotente: solo toca las que sigan en NULL.
UPDATE public.moderacion_logs SET accion = 'censo' WHERE accion IS NULL;

CREATE INDEX IF NOT EXISTS idx_moderacion_logs_accion
    ON public.moderacion_logs(accion, fecha DESC);