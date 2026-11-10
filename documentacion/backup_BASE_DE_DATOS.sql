--
-- PostgreSQL database dump
--

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Drop tables (order: children before parents)
--

DROP TABLE IF EXISTS public.moderacion_logs CASCADE;
DROP TABLE IF EXISTS public.admin_logs CASCADE;
DROP TABLE IF EXISTS public.baneados CASCADE;
DROP TABLE IF EXISTS public.mensajes_chat CASCADE;
DROP TABLE IF EXISTS public.comentarios_tarea CASCADE;
DROP TABLE IF EXISTS public.tareas CASCADE;
DROP TABLE IF EXISTS public.miembros_equipo CASCADE;
DROP TABLE IF EXISTS public.equipos CASCADE;
DROP TABLE IF EXISTS public.valoraciones CASCADE;
DROP TABLE IF EXISTS public.favoritos CASCADE;
DROP TABLE IF EXISTS public.comentarios CASCADE;
DROP TABLE IF EXISTS public.apuntes CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.usuarios (
    usuario_id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    -- Nullable a propósito: las cuentas creadas con Google Sign-In no tienen
    -- contraseña local. El login manual las rechaza con 401, no con 500.
    password_hash character varying(255),
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    foto_url text DEFAULT 'default-avatar.png'::text,
    rol character varying(20) DEFAULT 'user'::character varying
);

ALTER TABLE public.usuarios OWNER TO postgres;

CREATE SEQUENCE public.usuarios_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.usuarios_usuario_id_seq OWNER TO postgres;

ALTER SEQUENCE public.usuarios_usuario_id_seq OWNED BY public.usuarios.usuario_id;

CREATE TABLE public.apuntes (
    apunte_id integer NOT NULL,
    titulo character varying(100) NOT NULL,
    materia character varying(100) NOT NULL,
    descripcion text,
    archivo_url text NOT NULL,
    usuario_id integer,
    fecha_subida timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.apuntes OWNER TO postgres;

CREATE SEQUENCE public.apuntes_apunte_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.apuntes_apunte_id_seq OWNER TO postgres;

ALTER SEQUENCE public.apuntes_apunte_id_seq OWNED BY public.apuntes.apunte_id;

CREATE TABLE public.comentarios (
    comentario_id integer NOT NULL,
    apunte_id integer,
    usuario_id integer,
    texto text NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.comentarios OWNER TO postgres;

CREATE SEQUENCE public.comentarios_comentario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.comentarios_comentario_id_seq OWNER TO postgres;

ALTER SEQUENCE public.comentarios_comentario_id_seq OWNED BY public.comentarios.comentario_id;

CREATE TABLE public.favoritos (
    favorito_id integer NOT NULL,
    usuario_id integer,
    apunte_id integer,
    fecha_guardado timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.favoritos OWNER TO postgres;

CREATE SEQUENCE public.favoritos_favorito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.favoritos_favorito_id_seq OWNER TO postgres;

ALTER SEQUENCE public.favoritos_favorito_id_seq OWNED BY public.favoritos.favorito_id;

CREATE TABLE public.valoraciones (
    valoracion_id integer NOT NULL,
    apunte_id integer,
    usuario_id integer,
    estrellas integer,
    CONSTRAINT valoraciones_estrellas_check CHECK (((estrellas >= 1) AND (estrellas <= 5)))
);

ALTER TABLE public.valoraciones OWNER TO postgres;

CREATE SEQUENCE public.valoraciones_valoracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.valoraciones_valoracion_id_seq OWNER TO postgres;

ALTER SEQUENCE public.valoraciones_valoracion_id_seq OWNED BY public.valoraciones.valoracion_id;

CREATE TABLE public.equipos (
    equipo_id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    codigo_invitacion character varying(6) NOT NULL,
    creado_por integer,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.equipos OWNER TO postgres;

CREATE SEQUENCE public.equipos_equipo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.equipos_equipo_id_seq OWNER TO postgres;

ALTER SEQUENCE public.equipos_equipo_id_seq OWNED BY public.equipos.equipo_id;

CREATE TABLE public.miembros_equipo (
    equipo_id integer NOT NULL,
    usuario_id integer NOT NULL,
    rol character varying(20) DEFAULT 'miembro'::character varying
);

ALTER TABLE public.miembros_equipo OWNER TO postgres;

CREATE TABLE public.tareas (
    tarea_id integer NOT NULL,
    equipo_id integer,
    titulo character varying(200) NOT NULL,
    descripcion text DEFAULT ''::text,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    prioridad character varying(20) DEFAULT 'verde'::character varying,
    fecha_entrega timestamp without time zone,
    asignado_a integer,
    creado_por integer,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.tareas OWNER TO postgres;

CREATE SEQUENCE public.tareas_tarea_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.tareas_tarea_id_seq OWNER TO postgres;

ALTER SEQUENCE public.tareas_tarea_id_seq OWNED BY public.tareas.tarea_id;

CREATE TABLE public.mensajes_chat (
    mensaje_id integer NOT NULL,
    equipo_id integer,
    usuario_id integer,
    texto text NOT NULL,
    fecha_envio timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    respuesta_a integer
);

ALTER TABLE public.mensajes_chat OWNER TO postgres;

CREATE SEQUENCE public.mensajes_chat_mensaje_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.mensajes_chat_mensaje_id_seq OWNER TO postgres;

ALTER SEQUENCE public.mensajes_chat_mensaje_id_seq OWNED BY public.mensajes_chat.mensaje_id;

CREATE TABLE public.comentarios_tarea (
    comentario_id integer NOT NULL,
    tarea_id integer,
    usuario_id integer,
    texto text NOT NULL,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.comentarios_tarea OWNER TO postgres;

CREATE SEQUENCE public.comentarios_tarea_comentario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.comentarios_tarea_comentario_id_seq OWNER TO postgres;

ALTER SEQUENCE public.comentarios_tarea_comentario_id_seq OWNED BY public.comentarios_tarea.comentario_id;

CREATE TABLE public.baneados (
    baneo_id integer NOT NULL,
    email character varying(150) NOT NULL,
    motivo text,
    baneado_por integer,
    fecha_baneo timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.baneados OWNER TO postgres;

CREATE SEQUENCE public.baneados_baneo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.baneados_baneo_id_seq OWNER TO postgres;

ALTER SEQUENCE public.baneados_baneo_id_seq OWNED BY public.baneados.baneo_id;

CREATE TABLE public.admin_logs (
    log_id integer NOT NULL,
    admin_id integer,
    accion character varying(100) NOT NULL,
    detalle text,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.admin_logs OWNER TO postgres;

CREATE SEQUENCE public.admin_logs_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.admin_logs_log_id_seq OWNER TO postgres;

ALTER SEQUENCE public.admin_logs_log_id_seq OWNED BY public.admin_logs.log_id;

-- Logs del filtro de groserías y de vaciado de historial del chat.
-- Antes solo existía en migracion_moderacion.sql + migracion_chat_vaciado.sql,
-- así que una instalación desde cero rompía POST /chat/enviar y DELETE /chat/historial.
CREATE TABLE public.moderacion_logs (
    moderacion_id integer NOT NULL,
    usuario_id integer,
    equipo_id integer,
    palabras_bloqueadas text,
    sustituciones integer NOT NULL DEFAULT 0,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    accion text,
    detalle text
);

ALTER TABLE public.moderacion_logs OWNER TO postgres;

CREATE SEQUENCE public.moderacion_logs_moderacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.moderacion_logs_moderacion_id_seq OWNER TO postgres;

ALTER SEQUENCE public.moderacion_logs_moderacion_id_seq OWNED BY public.moderacion_logs.moderacion_id;

-- ============================================================
-- DEFAULTS (sequences)
-- ============================================================

ALTER TABLE ONLY public.usuarios ALTER COLUMN usuario_id SET DEFAULT nextval('public.usuarios_usuario_id_seq'::regclass);
ALTER TABLE ONLY public.apuntes ALTER COLUMN apunte_id SET DEFAULT nextval('public.apuntes_apunte_id_seq'::regclass);
ALTER TABLE ONLY public.comentarios ALTER COLUMN comentario_id SET DEFAULT nextval('public.comentarios_comentario_id_seq'::regclass);
ALTER TABLE ONLY public.favoritos ALTER COLUMN favorito_id SET DEFAULT nextval('public.favoritos_favorito_id_seq'::regclass);
ALTER TABLE ONLY public.valoraciones ALTER COLUMN valoracion_id SET DEFAULT nextval('public.valoraciones_valoracion_id_seq'::regclass);
ALTER TABLE ONLY public.equipos ALTER COLUMN equipo_id SET DEFAULT nextval('public.equipos_equipo_id_seq'::regclass);
ALTER TABLE ONLY public.tareas ALTER COLUMN tarea_id SET DEFAULT nextval('public.tareas_tarea_id_seq'::regclass);
ALTER TABLE ONLY public.mensajes_chat ALTER COLUMN mensaje_id SET DEFAULT nextval('public.mensajes_chat_mensaje_id_seq'::regclass);
ALTER TABLE ONLY public.comentarios_tarea ALTER COLUMN comentario_id SET DEFAULT nextval('public.comentarios_tarea_comentario_id_seq'::regclass);
ALTER TABLE ONLY public.baneados ALTER COLUMN baneo_id SET DEFAULT nextval('public.baneados_baneo_id_seq'::regclass);
ALTER TABLE ONLY public.admin_logs ALTER COLUMN log_id SET DEFAULT nextval('public.admin_logs_log_id_seq'::regclass);
ALTER TABLE ONLY public.moderacion_logs ALTER COLUMN moderacion_id SET DEFAULT nextval('public.moderacion_logs_moderacion_id_seq'::regclass);

-- ============================================================
-- DATA
-- ============================================================

-- Cuentas de demostración. Los correos deben pertenecer al dominio que valida
-- el backend (@alumnos.udg.mx) o el login/registro queda inconsistente con el seed.
-- foto_url queda en NULL para que el frontend use las iniciales: no se siembran
-- rutas a archivos que no existen en una instalación limpia.
COPY public.usuarios (usuario_id, nombre, email, password_hash, fecha_registro, foto_url, rol) FROM stdin;
1	Miguel	test@alumnos.udg.mx	$2b$10$AhvoT8OLUUkd8FRmuURIa.5sqg0l3RLT.VBCUI8/ntnKOXK4Qkh9a	2026-03-16 23:33:50.865721	\N	admin
2	Edu	test2@alumnos.udg.mx	$2b$10$ZiZeXOhtHVmxSJi48FKJKeQldTNV2HuFNtpYfxZ3o38MneJBRFtNi	2026-03-17 09:46:32.830529	\N	user
3	Cristoff	test3@alumnos.udg.mx	$2b$10$7Emk3./LLPiJnhzkdNIuH.VFXSoPmp.Cug6eop9OS3pmSopQms4Oa	2026-04-13 11:26:03.81259	\N	user
4	Miguel Espinoza	miguel@alumnos.udg.mx	$2b$10$Em1mc92xweb5nOEKS4LKWeibfmkpc8eeg0UQg.8A3qCubRs/16ZYG	2026-05-07 14:55:26.256041	\N	user
\.

-- No se siembran apuntes/comentarios/favoritos/valoraciones: sus archivos viven
-- en uploads/ y un volumen Docker vacío los oculta. Una instalación limpia
-- arrancaría con enlaces rotos. Esas tablas quedan vacías a propósito.

-- ============================================================
-- SEQUENCE RESET
-- ============================================================

SELECT pg_catalog.setval('public.usuarios_usuario_id_seq', 4, true);
SELECT pg_catalog.setval('public.apuntes_apunte_id_seq', 1, false);
SELECT pg_catalog.setval('public.comentarios_comentario_id_seq', 1, false);
SELECT pg_catalog.setval('public.favoritos_favorito_id_seq', 1, false);
SELECT pg_catalog.setval('public.valoraciones_valoracion_id_seq', 1, false);
SELECT pg_catalog.setval('public.moderacion_logs_moderacion_id_seq', 1, false);

-- ============================================================
-- CONSTRAINTS (PK, UNIQUE, CHECK)
-- ============================================================

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (usuario_id);

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);

ALTER TABLE ONLY public.apuntes
    ADD CONSTRAINT apuntes_pkey PRIMARY KEY (apunte_id);

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_pkey PRIMARY KEY (comentario_id);

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_pkey PRIMARY KEY (favorito_id);

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_usuario_id_apunte_id_key UNIQUE (usuario_id, apunte_id);

ALTER TABLE ONLY public.valoraciones
    ADD CONSTRAINT valoraciones_pkey PRIMARY KEY (valoracion_id);

ALTER TABLE ONLY public.valoraciones
    ADD CONSTRAINT valoraciones_apunte_id_usuario_id_key UNIQUE (apunte_id, usuario_id);

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (equipo_id);

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_codigo_invitacion_key UNIQUE (codigo_invitacion);

ALTER TABLE ONLY public.miembros_equipo
    ADD CONSTRAINT miembros_equipo_pkey PRIMARY KEY (equipo_id, usuario_id);

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_pkey PRIMARY KEY (tarea_id);

ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_pkey PRIMARY KEY (mensaje_id);

ALTER TABLE ONLY public.comentarios_tarea
    ADD CONSTRAINT comentarios_tarea_pkey PRIMARY KEY (comentario_id);

ALTER TABLE ONLY public.baneados
    ADD CONSTRAINT baneados_pkey PRIMARY KEY (baneo_id);

ALTER TABLE ONLY public.baneados
    ADD CONSTRAINT baneados_email_key UNIQUE (email);

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (log_id);

ALTER TABLE ONLY public.moderacion_logs
    ADD CONSTRAINT moderacion_logs_pkey PRIMARY KEY (moderacion_id);

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE ONLY public.apuntes
    ADD CONSTRAINT apuntes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_apunte_id_fkey FOREIGN KEY (apunte_id) REFERENCES public.apuntes(apunte_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_apunte_id_fkey FOREIGN KEY (apunte_id) REFERENCES public.apuntes(apunte_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.valoraciones
    ADD CONSTRAINT valoraciones_apunte_id_fkey FOREIGN KEY (apunte_id) REFERENCES public.apuntes(apunte_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.valoraciones
    ADD CONSTRAINT valoraciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.miembros_equipo
    ADD CONSTRAINT miembros_equipo_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(equipo_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.miembros_equipo
    ADD CONSTRAINT miembros_equipo_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(equipo_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_asignado_a_fkey FOREIGN KEY (asignado_a) REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(equipo_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_respuesta_a_fkey FOREIGN KEY (respuesta_a) REFERENCES public.mensajes_chat(mensaje_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.comentarios_tarea
    ADD CONSTRAINT comentarios_tarea_tarea_id_fkey FOREIGN KEY (tarea_id) REFERENCES public.tareas(tarea_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comentarios_tarea
    ADD CONSTRAINT comentarios_tarea_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.baneados
    ADD CONSTRAINT baneados_baneado_por_fkey FOREIGN KEY (baneado_por) REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.moderacion_logs
    ADD CONSTRAINT moderacion_logs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.moderacion_logs
    ADD CONSTRAINT moderacion_logs_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(equipo_id) ON DELETE SET NULL;

-- ============================================================
-- INDEXES (foreign key columns for performance)
-- ============================================================

CREATE INDEX idx_apuntes_usuario_id ON public.apuntes(usuario_id);
CREATE INDEX idx_comentarios_apunte_id ON public.comentarios(apunte_id);
CREATE INDEX idx_comentarios_usuario_id ON public.comentarios(usuario_id);
CREATE INDEX idx_favoritos_usuario_id ON public.favoritos(usuario_id);
CREATE INDEX idx_favoritos_apunte_id ON public.favoritos(apunte_id);
CREATE INDEX idx_valoraciones_apunte_id ON public.valoraciones(apunte_id);
CREATE INDEX idx_valoraciones_usuario_id ON public.valoraciones(usuario_id);
CREATE INDEX idx_equipos_creado_por ON public.equipos(creado_por);
CREATE INDEX idx_miembros_equipo_equipo_id ON public.miembros_equipo(equipo_id);
CREATE INDEX idx_miembros_equipo_usuario_id ON public.miembros_equipo(usuario_id);
CREATE INDEX idx_tareas_equipo_id ON public.tareas(equipo_id);
CREATE INDEX idx_tareas_asignado_a ON public.tareas(asignado_a);
CREATE INDEX idx_tareas_creado_por ON public.tareas(creado_por);
CREATE INDEX idx_mensajes_chat_equipo_id ON public.mensajes_chat(equipo_id);
CREATE INDEX idx_mensajes_chat_usuario_id ON public.mensajes_chat(usuario_id);
CREATE INDEX idx_mensajes_chat_respuesta ON public.mensajes_chat(respuesta_a);
CREATE INDEX idx_comentarios_tarea_tarea_id ON public.comentarios_tarea(tarea_id);
CREATE INDEX idx_comentarios_tarea_usuario_id ON public.comentarios_tarea(usuario_id);
CREATE INDEX idx_baneados_baneado_por ON public.baneados(baneado_por);
CREATE INDEX idx_baneados_email_lower ON public.baneados (lower(email));
CREATE INDEX idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX idx_moderacion_logs_fecha ON public.moderacion_logs(fecha DESC);
CREATE INDEX idx_moderacion_logs_accion ON public.moderacion_logs(accion, fecha DESC);
CREATE INDEX idx_moderacion_logs_usuario_id ON public.moderacion_logs(usuario_id);
CREATE INDEX idx_moderacion_logs_equipo_id ON public.moderacion_logs(equipo_id);

-- ============================================================
-- MIGRACIÓN ADMIN (compatibilidad con migracion_admin.sql)
-- ============================================================

-- Todas las columnas que antes vivían solo en migraciones manuales se aplican
-- aquí de forma idempotente. Así el dump sirve tanto para una instalación desde
-- cero como para actualizar una base creada con una versión anterior.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'user';
ALTER TABLE public.usuarios ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.mensajes_chat
    ADD COLUMN IF NOT EXISTS respuesta_a INTEGER
    REFERENCES public.mensajes_chat(mensaje_id) ON DELETE SET NULL;

ALTER TABLE public.moderacion_logs
    ADD COLUMN IF NOT EXISTS accion TEXT,
    ADD COLUMN IF NOT EXISTS detalle TEXT;

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_respuesta ON public.mensajes_chat(respuesta_a);
CREATE INDEX IF NOT EXISTS idx_moderacion_logs_fecha ON public.moderacion_logs(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_moderacion_logs_accion ON public.moderacion_logs(accion, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_moderacion_logs_usuario_id ON public.moderacion_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_moderacion_logs_equipo_id ON public.moderacion_logs(equipo_id);

UPDATE public.usuarios SET rol = 'admin' WHERE usuario_id = 1 AND (rol IS NULL OR rol = 'user');

-- Unicidad de correo sin distinguir mayúsculas (ver migracion_seguridad.sql)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_lower ON public.usuarios (lower(email));

--
-- PostgreSQL database dump complete
--
