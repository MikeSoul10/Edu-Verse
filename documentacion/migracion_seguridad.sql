-- Migración: correos normalizados a minúsculas + unicidad sin distinguir mayúsculas
-- Ejecutar manualmente contra la BD existente:
-- docker exec -i edu-verse-postgres-1 psql -U postgres -d Edu-verseDB -f - < documentacion/migracion_seguridad.sql
--
-- Contexto: el registro guardaba el correo tal cual, mientras que el baneo y el
-- login lo comparaban en minúsculas. Un usuario baneado con mayúsculas en su
-- correo podía seguir entrando. El código nuevo ya compara con lower(email), así
-- que funciona aunque no se ejecute esta migración; esta migración limpia los
-- datos viejos y agrega la restricción para que no vuelva a pasar.
--
-- Es idempotente: se puede ejecutar más de una vez.

BEGIN;

-- 1) Se detiene si dos cuentas solo difieren en mayúsculas (hay que resolverlo a mano).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.usuarios GROUP BY lower(email) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay correos duplicados que solo difieren en mayusculas. Resuelvelos antes de migrar: SELECT lower(email), count(*) FROM usuarios GROUP BY 1 HAVING count(*) > 1;';
  END IF;
END $$;

-- 2) Baneados: si un mismo correo está dos veces con distinta capitalización, conserva el más reciente.
DELETE FROM public.baneados b
 USING public.baneados b2
 WHERE lower(b.email) = lower(b2.email) AND b.baneo_id < b2.baneo_id;

-- 3) Normalizar a minúsculas.
UPDATE public.usuarios SET email = lower(email) WHERE email <> lower(email);
UPDATE public.baneados SET email = lower(email) WHERE email <> lower(email);

-- 4) Unicidad sin distinguir mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_lower ON public.usuarios (lower(email));

-- 5) Índice para el chequeo de baneo: ahora se consulta en CADA petición
--    autenticada (para que un baneo corte el acceso de inmediato), y sin este
--    índice sería un escaneo de tabla en cada request.
CREATE INDEX IF NOT EXISTS idx_baneados_email_lower ON public.baneados (lower(email));

COMMIT;
