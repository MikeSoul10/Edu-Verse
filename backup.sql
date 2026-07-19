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
-- Name: apuntes; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: apuntes_apunte_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.apuntes_apunte_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.apuntes_apunte_id_seq OWNER TO postgres;

--
-- Name: apuntes_apunte_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.apuntes_apunte_id_seq OWNED BY public.apuntes.apunte_id;


--
-- Name: comentarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comentarios (
    comentario_id integer NOT NULL,
    apunte_id integer,
    usuario_id integer,
    texto text NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.comentarios OWNER TO postgres;

--
-- Name: comentarios_comentario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comentarios_comentario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comentarios_comentario_id_seq OWNER TO postgres;

--
-- Name: comentarios_comentario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comentarios_comentario_id_seq OWNED BY public.comentarios.comentario_id;


--
-- Name: favoritos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favoritos (
    favorito_id integer NOT NULL,
    usuario_id integer,
    apunte_id integer,
    fecha_guardado timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.favoritos OWNER TO postgres;

--
-- Name: favoritos_favorito_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.favoritos_favorito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.favoritos_favorito_id_seq OWNER TO postgres;

--
-- Name: favoritos_favorito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.favoritos_favorito_id_seq OWNED BY public.favoritos.favorito_id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    usuario_id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    foto_url text DEFAULT 'default-avatar.png'::text
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_usuario_id_seq OWNER TO postgres;

--
-- Name: usuarios_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_usuario_id_seq OWNED BY public.usuarios.usuario_id;


--
-- Name: valoraciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.valoraciones (
    valoracion_id integer NOT NULL,
    apunte_id integer,
    usuario_id integer,
    estrellas integer,
    CONSTRAINT valoraciones_estrellas_check CHECK (((estrellas >= 1) AND (estrellas <= 5)))
);


ALTER TABLE public.valoraciones OWNER TO postgres;

--
-- Name: valoraciones_valoracion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.valoraciones_valoracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.valoraciones_valoracion_id_seq OWNER TO postgres;

--
-- Name: valoraciones_valoracion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.valoraciones_valoracion_id_seq OWNED BY public.valoraciones.valoracion_id;


--
-- Name: apuntes apunte_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apuntes ALTER COLUMN apunte_id SET DEFAULT nextval('public.apuntes_apunte_id_seq'::regclass);


--
-- Name: comentarios comentario_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comentarios ALTER COLUMN comentario_id SET DEFAULT nextval('public.comentarios_comentario_id_seq'::regclass);


--
-- Name: favoritos favorito_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favoritos ALTER COLUMN favorito_id SET DEFAULT nextval('public.favoritos_favorito_id_seq'::regclass);


--
-- Name: usuarios usuario_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN usuario_id SET DEFAULT nextval('public.usuarios_usuario_id_seq'::regclass);


--
-- Name: valoraciones valoracion_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.valoraciones ALTER COLUMN valoracion_id SET DEFAULT nextval('public.valoraciones_valoracion_id_seq'::regclass);


--
-- Data for Name: apuntes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.apuntes (apunte_id, titulo, materia, descripcion, archivo_url, usuario_id, fecha_subida) FROM stdin;
3	Palomino	Base de Datos		/uploads/1776221907853-Gemini_Generated_Image_cbj1iucbj1iucbj1.png	2	2026-04-14 20:58:27.910992
4	Sprint Modular	Modulares	Pendejadas de coordinacion	/uploads/1777328372401-Sprint 3 - Plan de Construccion_Edu-Verse.pdf	2	2026-04-27 16:19:32.433069
6	Huevos	Calculo Lineal	Modular xd\r\n	/uploads/1777927668853-Plan de Trabajo - EduVerse.pdf	3	2026-05-04 14:47:48.878473
\.


--
-- Data for Name: comentarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comentarios (comentario_id, apunte_id, usuario_id, texto, fecha_creacion) FROM stdin;
1	6	2	Muy bueno	2026-05-06 11:41:08.245702
2	6	4	Me parecio interesante el plan de trabajo	2026-05-07 14:58:31.812789
\.


--
-- Data for Name: favoritos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.favoritos (favorito_id, usuario_id, apunte_id, fecha_guardado) FROM stdin;
16	3	4	2026-05-04 14:54:44.453106
17	2	4	2026-05-06 11:21:28.29727
18	4	6	2026-05-07 14:58:41.155286
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (usuario_id, nombre, email, password_hash, fecha_registro, foto_url) FROM stdin;
1	Miguel	test@edu.mx	$2b$10$AhvoT8OLUUkd8FRmuURIa.5sqg0l3RLT.VBCUI8/ntnKOXK4Qkh9a	2026-03-16 23:33:50.865721	default-avatar.png
3	Cristoff	test3@alumno.edu	$2b$10$7Emk3./LLPiJnhzkdNIuH.VFXSoPmp.Cug6eop9OS3pmSopQms4Oa	2026-04-13 11:26:03.81259	default-avatar.png
2	Edu	test2@alumno.edu	$2b$10$ZiZeXOhtHVmxSJi48FKJKeQldTNV2HuFNtpYfxZ3o38MneJBRFtNi	2026-03-17 09:46:32.830529	/uploads/perfiles/1778088001198-Arquitectura_Edu-Verse.png
4	Miguel Espinoza	miguel@alumno.edu	$2b$10$Em1mc92xweb5nOEKS4LKWeibfmkpc8eeg0UQg.8A3qCubRs/16ZYG	2026-05-07 14:55:26.256041	/uploads/perfiles/1778375807955-default-avatar.png
\.


--
-- Data for Name: valoraciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.valoraciones (valoracion_id, apunte_id, usuario_id, estrellas) FROM stdin;
1	6	2	5
2	6	4	4
\.


--
-- Name: apuntes_apunte_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.apuntes_apunte_id_seq', 6, true);


--
-- Name: comentarios_comentario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comentarios_comentario_id_seq', 2, true);


--
-- Name: favoritos_favorito_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.favoritos_favorito_id_seq', 18, true);


--
-- Name: usuarios_usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_usuario_id_seq', 4, true);


--
-- Name: valoraciones_valoracion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.valoraciones_valoracion_id_seq', 2, true);


--
-- Name: apuntes apuntes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apuntes
    ADD CONSTRAINT apuntes_pkey PRIMARY KEY (apunte_id);


--
-- Name: comentarios comentarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_pkey PRIMARY KEY (comentario_id);


--
-- Name: favoritos favoritos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_pkey PRIMARY KEY (favorito_id);


--
-- Name: favoritos favoritos_usuario_id_apunte_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_usuario_id_apunte_id_key UNIQUE (usuario_id, apunte_id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (usuario_id);


--
-- Name: valoraciones valoraciones_apunte_id_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.valoraciones
    ADD CONSTRAINT valoraciones_apunte_id_usuario_id_key UNIQUE (apunte_id, usuario_id);


--
-- Name: valoraciones valoraciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.valoraciones
    ADD CONSTRAINT valoraciones_pkey PRIMARY KEY (valoracion_id);


--
-- Name: apuntes apuntes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apuntes
    ADD CONSTRAINT apuntes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: comentarios comentarios_apunte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_apunte_id_fkey FOREIGN KEY (apunte_id) REFERENCES public.apuntes(apunte_id) ON DELETE CASCADE;


--
-- Name: comentarios comentarios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: favoritos favoritos_apunte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_apunte_id_fkey FOREIGN KEY (apunte_id) REFERENCES public.apuntes(apunte_id) ON DELETE CASCADE;


--
-- Name: favoritos favoritos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;


--
-- Name: valoraciones valoraciones_apunte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.valoraciones
    ADD CONSTRAINT valoraciones_apunte_id_fkey FOREIGN KEY (apunte_id) REFERENCES public.apuntes(apunte_id) ON DELETE CASCADE;


--
-- Name: valoraciones valoraciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.valoraciones
    ADD CONSTRAINT valoraciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;


--
-- Name: equipos; Type: TABLE; Schema: public; Owner: postgres
--

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

ALTER TABLE ONLY public.equipos ALTER COLUMN equipo_id SET DEFAULT nextval('public.equipos_equipo_id_seq'::regclass);

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (equipo_id);

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_codigo_invitacion_key UNIQUE (codigo_invitacion);

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(usuario_id);


--
-- Name: miembros_equipo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.miembros_equipo (
    equipo_id integer NOT NULL,
    usuario_id integer NOT NULL,
    rol character varying(20) DEFAULT 'miembro'::character varying
);

ALTER TABLE public.miembros_equipo OWNER TO postgres;

ALTER TABLE ONLY public.miembros_equipo
    ADD CONSTRAINT miembros_equipo_pkey PRIMARY KEY (equipo_id, usuario_id);

ALTER TABLE ONLY public.miembros_equipo
    ADD CONSTRAINT miembros_equipo_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(equipo_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.miembros_equipo
    ADD CONSTRAINT miembros_equipo_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE;


--
-- Name: tareas; Type: TABLE; Schema: public; Owner: postgres
--

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

ALTER TABLE ONLY public.tareas ALTER COLUMN tarea_id SET DEFAULT nextval('public.tareas_tarea_id_seq'::regclass);

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_pkey PRIMARY KEY (tarea_id);

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(equipo_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_asignado_a_fkey FOREIGN KEY (asignado_a) REFERENCES public.usuarios(usuario_id);

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(usuario_id);


--
-- Name: mensajes_chat; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mensajes_chat (
    mensaje_id integer NOT NULL,
    equipo_id integer,
    usuario_id integer,
    texto text NOT NULL,
    fecha_envio timestamp without time zone DEFAULT CURRENT_TIMESTAMP
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

ALTER TABLE ONLY public.mensajes_chat ALTER COLUMN mensaje_id SET DEFAULT nextval('public.mensajes_chat_mensaje_id_seq'::regclass);

ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_pkey PRIMARY KEY (mensaje_id);

ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(equipo_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- PostgreSQL database dump complete
--



