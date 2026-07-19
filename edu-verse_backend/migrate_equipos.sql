CREATE TABLE IF NOT EXISTS public.equipos (
    equipo_id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    codigo_invitacion VARCHAR(6) NOT NULL UNIQUE,
    creado_por INTEGER REFERENCES public.usuarios(usuario_id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.miembros_equipo (
    equipo_id INTEGER REFERENCES public.equipos(equipo_id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES public.usuarios(usuario_id) ON DELETE CASCADE,
    rol VARCHAR(20) DEFAULT 'miembro',
    PRIMARY KEY (equipo_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.tareas (
    tarea_id SERIAL PRIMARY KEY,
    equipo_id INTEGER REFERENCES public.equipos(equipo_id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT DEFAULT '',
    estado VARCHAR(20) DEFAULT 'pendiente',
    prioridad VARCHAR(20) DEFAULT 'verde',
    fecha_entrega TIMESTAMP,
    asignado_a INTEGER REFERENCES public.usuarios(usuario_id),
    creado_por INTEGER REFERENCES public.usuarios(usuario_id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.mensajes_chat (
    mensaje_id SERIAL PRIMARY KEY,
    equipo_id INTEGER REFERENCES public.equipos(equipo_id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES public.usuarios(usuario_id),
    texto TEXT NOT NULL,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
