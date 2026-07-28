-- Migración: Agregar sistema de administrador
-- Ejecutar este script en la base de datos existente

-- 1. Agregar campo 'rol' a tabla usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'user';

-- 2. Tabla de baneados
CREATE TABLE IF NOT EXISTS baneados (
    baneo_id SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    motivo TEXT,
    baneado_por INTEGER REFERENCES usuarios(usuario_id),
    fecha_baneo TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de logs de admin
CREATE TABLE IF NOT EXISTS admin_logs (
    log_id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES usuarios(usuario_id),
    accion VARCHAR(100) NOT NULL,
    detalle TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Hacer admin al usuario con ID 1 (Miguel)
UPDATE usuarios SET rol = 'admin' WHERE usuario_id = 1;

-- Listo. Ahora reinicia el backend.
