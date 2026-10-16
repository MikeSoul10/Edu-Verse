-- Migración: respuestas a mensajes del chat (estilo WhatsApp)
-- Ejecutar manualmente contra la BD existente:
-- psql -U postgres -d Edu-verseDB -f documentacion/migracion_respuestas_chat.sql
--
-- Agrega la referencia al mensaje original que se está respondiendo.
-- ON DELETE SET NULL: si se borra el mensaje citado, la respuesta sobrevive
-- y el frontend la muestra como "Mensaje eliminado".

ALTER TABLE public.mensajes_chat
    ADD COLUMN IF NOT EXISTS respuesta_a INTEGER
    REFERENCES public.mensajes_chat(mensaje_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_respuesta
    ON public.mensajes_chat(respuesta_a);