-- Migración: Tutor IA — Fase 2 (indexado del texto de los apuntes)
--
-- Idempotente: el backend la aplica sola al arrancar (services/migraciones.js).
-- Solo agrega columnas y tablas; no modifica columnas existentes.
-- Manual: psql -U postgres -d Edu-verseDB -f edu-verse_backend/migraciones/002_indexado_apuntes.sql

CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() no es IMMUTABLE, así que no puede usarse en una columna generada
-- ni en un índice. Esta envoltura fija el diccionario y sí lo es.
CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Estado del indexado de cada apunte. Los apuntes existentes quedan
-- 'pendiente' por el DEFAULT, así que el worker los procesa solo.
ALTER TABLE public.apuntes
  ADD COLUMN IF NOT EXISTS estado_indexado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_indexado IN ('pendiente', 'procesando', 'listo', 'error'));
ALTER TABLE public.apuntes ADD COLUMN IF NOT EXISTS error_indexado TEXT;
ALTER TABLE public.apuntes ADD COLUMN IF NOT EXISTS indexado_en TIMESTAMPTZ;
-- Cuándo un worker tomó el apunte: permite rescatar los que quedaron en
-- 'procesando' si el worker se cayó a la mitad.
ALTER TABLE public.apuntes ADD COLUMN IF NOT EXISTS indexando_desde TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.apunte_fragmentos (
    fragmento_id SERIAL PRIMARY KEY,
    apunte_id    INTEGER NOT NULL REFERENCES public.apuntes(apunte_id) ON DELETE CASCADE,
    pagina       INTEGER,                -- NULL en imágenes (una sola "página")
    orden        INTEGER NOT NULL,
    texto        TEXT NOT NULL,
    metodo       TEXT NOT NULL CHECK (metodo IN ('pdf_texto', 'ocr')),
    busqueda     TSVECTOR GENERATED ALWAYS AS (to_tsvector('spanish', public.f_unaccent(texto))) STORED
);

CREATE INDEX IF NOT EXISTS idx_frag_busqueda      ON public.apunte_fragmentos USING GIN (busqueda);
CREATE INDEX IF NOT EXISTS idx_frag_apunte        ON public.apunte_fragmentos (apunte_id, orden);
CREATE INDEX IF NOT EXISTS idx_apuntes_indexado   ON public.apuntes (estado_indexado);
