-- Migración: Tutor IA — Fase 3 (búsqueda semántica con pgvector).
--
-- Requiere la imagen pgvector/pgvector:pg16 (ya configurada en los
-- docker-compose). Si el servidor de PostgreSQL NO tiene la extensión, esta
-- migración no hace nada y el tutor sigue buscando solo por texto.
--
-- Embeddings de 384 dimensiones (modelo Xenova/multilingual-e5-small),
-- normalizados, comparados por distancia coseno con un índice HNSW.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    EXECUTE 'ALTER TABLE public.apunte_fragmentos ADD COLUMN IF NOT EXISTS embedding vector(384)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_frag_embedding ON public.apunte_fragmentos USING hnsw (embedding vector_cosine_ops)';
  ELSE
    RAISE NOTICE 'pgvector no está disponible: la búsqueda en apuntes será solo por texto.';
  END IF;
END
$$;
