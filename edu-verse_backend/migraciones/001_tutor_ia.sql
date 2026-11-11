-- Migración: Tutor IA — Fase 1 (sesiones, mensajes, mazos y flashcards)
--
-- El backend la aplica sola al arrancar (services/migraciones.js). Es
-- idempotente: solo crea lo que no existe y no toca tablas actuales.
-- También se puede correr a mano:
-- psql -U postgres -d Edu-verseDB -f edu-verse_backend/migraciones/001_tutor_ia.sql

CREATE TABLE IF NOT EXISTS public.tutor_sesiones (
    sesion_id   SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE,
    tema        TEXT NOT NULL,
    nivel       TEXT NOT NULL DEFAULT 'intermedio'
                CHECK (nivel IN ('basico', 'intermedio', 'avanzado')),
    creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tutor_mensajes (
    mensaje_id   SERIAL PRIMARY KEY,
    sesion_id    INTEGER NOT NULL REFERENCES public.tutor_sesiones(sesion_id) ON DELETE CASCADE,
    rol          TEXT NOT NULL CHECK (rol IN ('user', 'assistant')),
    contenido    TEXT NOT NULL,          -- texto enviado a la IA / respuesta en Markdown
    display      TEXT,                   -- texto corto que se muestra en la burbuja del usuario
    fuentes      JSONB NOT NULL DEFAULT '[]',
    subtemas     JSONB NOT NULL DEFAULT '[]',
    sin_busqueda BOOLEAN NOT NULL DEFAULT false,
    creado       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mazos (
    mazo_id     SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE,
    sesion_id   INTEGER REFERENCES public.tutor_sesiones(sesion_id) ON DELETE SET NULL,
    tema        TEXT NOT NULL,
    origen      TEXT NOT NULL DEFAULT 'tutor',  -- 'tutor' | 'apunte' (fase 3)
    creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flashcards (
    flashcard_id SERIAL PRIMARY KEY,
    mazo_id      INTEGER NOT NULL REFERENCES public.mazos(mazo_id) ON DELETE CASCADE,
    frente       TEXT NOT NULL,
    reverso      TEXT NOT NULL,
    tipo         TEXT NOT NULL DEFAULT 'concepto',
    orden        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tutor_sesiones_usuario ON public.tutor_sesiones (usuario_id, actualizado DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_mensajes_sesion  ON public.tutor_mensajes (sesion_id, mensaje_id);
CREATE INDEX IF NOT EXISTS idx_mazos_sesion           ON public.mazos (sesion_id);
CREATE INDEX IF NOT EXISTS idx_mazos_usuario          ON public.mazos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_mazo        ON public.flashcards (mazo_id, orden);
