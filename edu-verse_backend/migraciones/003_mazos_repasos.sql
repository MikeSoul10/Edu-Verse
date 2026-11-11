-- Migración: Tutor IA — Fase 3 (flashcards desde apuntes, repaso espaciado y
-- mazos compartidos en equipos). Idempotente; solo agrega.
-- Manual: psql -U postgres -d Edu-verseDB -f edu-verse_backend/migraciones/003_mazos_repasos.sql

-- Flashcards generadas desde un apunte: el mazo y cada tarjeta recuerdan su
-- origen para enlazar "Ver en el apunte (pág. n)".
ALTER TABLE public.mazos
  ADD COLUMN IF NOT EXISTS apunte_id INTEGER REFERENCES public.apuntes(apunte_id) ON DELETE SET NULL;
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS apunte_id INTEGER REFERENCES public.apuntes(apunte_id) ON DELETE SET NULL;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS pagina INTEGER;

CREATE INDEX IF NOT EXISTS idx_mazos_apunte ON public.mazos (usuario_id, apunte_id);

-- Repetición espaciada (sistema Leitner). El progreso es POR USUARIO, aunque
-- el mazo sea compartido. Una tarjeta sin fila aquí es "nueva": toca hoy y
-- cuenta en la caja 1.
CREATE TABLE IF NOT EXISTS public.repasos (
    flashcard_id   INTEGER NOT NULL REFERENCES public.flashcards(flashcard_id) ON DELETE CASCADE,
    usuario_id     INTEGER NOT NULL REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE,
    caja           INTEGER NOT NULL DEFAULT 1 CHECK (caja BETWEEN 1 AND 5),
    proximo_repaso DATE NOT NULL DEFAULT CURRENT_DATE,
    aciertos       INTEGER NOT NULL DEFAULT 0,
    fallos         INTEGER NOT NULL DEFAULT 0,
    ultimo_repaso  TIMESTAMPTZ,
    PRIMARY KEY (flashcard_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_repasos_usuario ON public.repasos (usuario_id, proximo_repaso);

-- Mazos compartidos con equipos: los miembros los ven y estudian; solo el
-- autor los edita.
CREATE TABLE IF NOT EXISTS public.mazo_compartido (
    mazo_id        INTEGER NOT NULL REFERENCES public.mazos(mazo_id) ON DELETE CASCADE,
    equipo_id      INTEGER NOT NULL REFERENCES public.equipos(equipo_id) ON DELETE CASCADE,
    compartido_por INTEGER REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL,
    creado         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (mazo_id, equipo_id)
);
CREATE INDEX IF NOT EXISTS idx_mazo_compartido_equipo ON public.mazo_compartido (equipo_id);
