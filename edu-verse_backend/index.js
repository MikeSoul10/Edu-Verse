const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET no está definido en las variables de entorno');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  socket.on('unirse-equipo', (equipoId) => {
    socket.join(`equipo-${equipoId}`);
    console.log(`👤 ${socket.id} se unió a equipo-${equipoId}`);
  });

  socket.on('salir-equipo', (equipoId) => {
    socket.leave(`equipo-${equipoId}`);
  });

  socket.on('nueva-tarea', (data) => {
    io.to(`equipo-${data.equipo_id}`).emit('tarea-creada', data);
  });

  socket.on('mover-tarea', (data) => {
    io.to(`equipo-${data.equipo_id}`).emit('tarea-movida', data);
  });

  socket.on('editar-tarea', (data) => {
    io.to(`equipo-${data.equipo_id}`).emit('tarea-editada', data);
  });

  socket.on('eliminar-tarea', (data) => {
    io.to(`equipo-${data.equipo_id}`).emit('tarea-eliminada', data);
  });

  socket.on('mensaje-chat', (data) => {
    io.to(`equipo-${data.equipo_id}`).emit('nuevo-mensaje', data);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// --- 1. MIDDLEWARES ---
app.use(cors());
app.use(express.json());
// Servir archivos estáticos (debe estar antes de las rutas)
app.use('/uploads', express.static('uploads'));

const verificarToken = require('./middleware/auth');
const { sanitize } = require('./middleware/sanitize');

// --- 2. CONFIGURACIÓN DE MULTER ---
const equiposRoutes = require('./routes/equipos');
const tareasRoutes = require('./routes/tareas');
const chatRoutes = require('./routes/chat');

app.use('/equipos', equiposRoutes);
app.use('/tareas', tareasRoutes);
app.use('/chat', chatRoutes);
const storageApuntes = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/'); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({
  storage: storageApuntes,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF, PNG o JPG'));
  }
});

const storagePerfil = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/perfiles/'); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const uploadPerfil = multer({
  storage: storagePerfil,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes PNG o JPG'));
  }
});
// --- 3. RUTAS GENERALES ---
app.get('/', (req, res) => {
  res.send("¡El servidor de Edu-Verse está vivo! 🚀");
});

// --- 4. RUTAS DE AUTENTICACIÓN (Signup/Login) ---
app.post('/auth/signup', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json("Campos obligatorios faltantes.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json("Email no válido.");
    if (!email.toLowerCase().endsWith('@alumnos.udg.mx')) return res.status(400).json("Solo correos @alumnos.udg.mx");
    if (password.length < 6) return res.status(400).json("Contraseña corta.");

    // Verificar si el email está baneado
    const baneado = await pool.query("SELECT * FROM baneados WHERE email = $1", [email.toLowerCase()]);
    if (baneado.rows.length > 0) {
      return res.status(403).json("Este correo ha sido suspendido. No puedes crear una cuenta.");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const nuevoUsuario = await pool.query(
      "INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      [nombre, email, passwordHash]
    );

    res.status(201).json({
      mensaje: "Usuario creado ✨",
      usuario: { id: nuevoUsuario.rows[0].usuario_id, nombre: nuevoUsuario.rows[0].nombre }
    });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json("El correo ya existe.");
    res.status(500).send("Error en el servidor");
  }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Verificar si el email está baneado
        const baneado = await pool.query("SELECT * FROM baneados WHERE email = $1", [email.toLowerCase()]);
        if (baneado.rows.length > 0) {
            return res.status(403).json("Tu cuenta ha sido suspendida. Contacta al administrador.");
        }

        const usuario = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        
        if (usuario.rows.length === 0) return res.status(401).json("Credenciales incorrectas");

        const validPassword = await bcrypt.compare(password, usuario.rows[0].password_hash);
        if (!validPassword) return res.status(401).json("Credenciales incorrectas");

        // --- CREAR TOKEN (incluye rol) ---
        const token = jwt.sign(
            { id: usuario.rows[0].usuario_id, nombre: usuario.rows[0].nombre, rol: usuario.rows[0].rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            mensaje: "¡Éxito!",
            token,
            usuario: { id: usuario.rows[0].usuario_id, nombre: usuario.rows[0].nombre, foto_url: usuario.rows[0].foto_url, rol: usuario.rows[0].rol }
        });
    } catch (err) {
        res.status(500).send("Error en el servidor");
    }
});

// --- 5. RUTAS DE PERFIL ---

app.get('/auth/perfil/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Agregamos foto_url a la consulta
    const usuario = await pool.query(
      "SELECT nombre, email, foto_url FROM usuarios WHERE usuario_id = $1", 
      [id]
    );
    
    if (usuario.rows.length === 0) return res.status(404).json("No encontrado");
    res.json(usuario.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.put('/auth/perfil/update/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email } = req.body;
    if (String(req.usuario.id) !== String(id)) return res.status(403).json("No autorizado");
    if (!email.endsWith('@alumnos.udg.mx')) return res.status(400).json("Debe ser @alumnos.udg.mx");

    const updateUsuario = await pool.query(
      "UPDATE usuarios SET nombre = $1, email = $2 WHERE usuario_id = $3 RETURNING *",
      [nombre, email, id]
    );
    res.json({ mensaje: "Actualizado", nombre: updateUsuario.rows[0].nombre });
  } catch (err) {
    res.status(500).send("Error");
  }
});

// --- 6. RUTAS DE APUNTES ---
app.post('/apuntes/upload', verificarToken, upload.single('archivo'), async (req, res) => {
  try {
    const { titulo, materia, descripcion } = req.body;
    const usuario_id = req.usuario.id;
    if (!req.file) return res.status(400).json("No hay archivo");

    const archivo_url = `/uploads/${req.file.filename}`;
    const nuevoApunte = await pool.query(
      "INSERT INTO apuntes (titulo, materia, descripcion, archivo_url, usuario_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [titulo, materia, descripcion, archivo_url, usuario_id]
    );

    res.json({ mensaje: "¡Subido! 🚀", apunte: nuevoApunte.rows[0] });
  } catch (err) {
    res.status(500).send("Error al subir");
  }
});

app.get('/apuntes', async (req, res) => {
  try {
    // Nota: JOIN para traer el nombre del autor
    const todosLosApuntes = await pool.query(
      "SELECT apuntes.*, usuarios.nombre AS autor FROM apuntes JOIN usuarios ON apuntes.usuario_id = usuarios.usuario_id ORDER BY fecha_subida DESC"
    );
    res.json(todosLosApuntes.rows);
  } catch (err) {
    res.status(500).send("Error al obtener");
  }
});

app.get('/apuntes/buscar', async (req, res) => {
  try {
    // Si q no existe, usamos un string vacío para que ILIKE '% %%' traiga todo
    const q = req.query.q || ''; 
    
    const consulta = `
      SELECT apuntes.*, usuarios.nombre AS autor 
      FROM apuntes 
      JOIN usuarios ON apuntes.usuario_id = usuarios.usuario_id 
      WHERE apuntes.titulo ILIKE $1 
      OR apuntes.materia ILIKE $1 
      OR apuntes.descripcion ILIKE $1
      ORDER BY fecha_subida DESC
    `;
    
    const valores = [`%${q}%`]; 
    const resultados = await pool.query(consulta, valores);
    
    res.json(resultados.rows);
  } catch (err) {
    console.error("Error en búsqueda:", err.message);
    res.status(500).send("Error en la búsqueda");
  }
});

// --- 7. ENCENDIDO ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor de Edu-Verse corriendo en el puerto ${PORT}`);
});

// --- NUEVA RUTA PARA DETALLE DE APUNTE ---
app.get('/apuntes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Usamos pool.query porque esa es tu variable definida arriba
    const consulta = `
      SELECT apuntes.*, usuarios.nombre AS autor 
      FROM apuntes 
      JOIN usuarios ON apuntes.usuario_id = usuarios.usuario_id 
      WHERE apuntes.apunte_id = $1
    `;
    
    const resultado = await pool.query(consulta, [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json("Apunte no encontrado");
    }

    // Enviamos solo el objeto del apunte
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error("Error al obtener detalle:", err.message);
    res.status(500).send("Error en el servidor");
  }
});

// OBTENER APUNTES DE UN USUARIO ESPECÍFICO
app.get('/apuntes/mis-apuntes/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const misApuntes = await pool.query(
      "SELECT * FROM apuntes WHERE usuario_id = $1 ORDER BY fecha_subida DESC",
      [usuario_id]
    );
    res.json(misApuntes.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error al obtener tus apuntes");
  }
});

// ELIMINAR UN APUNTE
app.delete('/apuntes/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Aquí podrías agregar una validación extra para ver si el archivo existe físicamente y borrarlo también
    await pool.query("DELETE FROM apuntes WHERE apunte_id = $1", [id]);
    res.json("Apunte eliminado con éxito");
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error al eliminar el apunte");
  }
});

// GUARDAR UN APUNTE COMO FAVORITO
app.post('/favoritos', async (req, res) => {
  try {
    const { usuario_id, apunte_id } = req.body;
    await pool.query(
      "INSERT INTO favoritos (usuario_id, apunte_id) VALUES ($1, $2)",
      [usuario_id, apunte_id]
    );
    res.json({ message: "Añadido a favoritos ⭐" });
  } catch (err) {
    // Si el error es por duplicado (código 23505)
    if (err.code === '23505') {
      return res.status(400).json({ message: "Ya tienes este apunte en favoritos" });
    }
    console.error(err.message);
    res.status(500).send("Error al guardar favorito");
  }
});

// OBTENER TODOS LOS FAVORITOS DE UN USUARIO
app.get('/favoritos/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const misFavoritos = await pool.query(
      `SELECT apuntes.*, usuarios.nombre AS autor 
       FROM favoritos 
       JOIN apuntes ON favoritos.apunte_id = apuntes.apunte_id 
       JOIN usuarios ON apuntes.usuario_id = usuarios.usuario_id
       WHERE favoritos.usuario_id = $1`,
      [usuario_id]
    );
    res.json(misFavoritos.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error al obtener favoritos");
  }
});
// ELIMINAR DE FAVORITOS
app.delete('/favoritos', verificarToken, async (req, res) => {
  try {
    const { apunte_id } = req.body;
    const usuario_id = req.usuario.id;
    
    await pool.query(
      "DELETE FROM favoritos WHERE usuario_id = $1 AND apunte_id = $2",
      [usuario_id, apunte_id]
    );
    
    res.json({ message: "Eliminado de favoritos 🗑️" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error al eliminar de favoritos");
  }
});

// RUTA PARA ACTUALIZAR FOTO DE PERFIL
app.put('/usuarios/foto/:id', verificarToken, uploadPerfil.single('foto'), async (req, res) => {
  try {
    const { id } = req.params;
    const urlFoto = `/uploads/perfiles/${req.file.filename}`;
    
    await pool.query(
      "UPDATE usuarios SET foto_url = $1 WHERE usuario_id = $2",
      [urlFoto, id]
    );
    
    res.json({ message: "Foto actualizada", url: urlFoto });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error al subir la foto");
  }
});

// --- RUTAS DE COMUNIDAD ---

// 1. Obtener detalles de un apunte con su promedio de rating
app.get('/apuntes/detalle/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const apunte = await pool.query(
            `SELECT apuntes.*, usuarios.nombre AS autor,
            (SELECT AVG(estrellas) FROM valoraciones WHERE apunte_id = $1) as promedio_rating,
            (SELECT COUNT(*) FROM valoraciones WHERE apunte_id = $1) as total_votos
            FROM apuntes 
            JOIN usuarios ON apuntes.usuario_id = usuarios.usuario_id
            WHERE apuntes.apunte_id = $1`, [id]
        );
        res.json(apunte.rows[0]);
    } catch (err) {
        res.status(500).send("Error al obtener detalle");
    }
});

// 2. Comentarios: Obtener y Postear
app.get('/comentarios/:apunte_id', async (req, res) => {
    const { apunte_id } = req.params;
    const result = await pool.query(
        "SELECT comentarios.*, usuarios.nombre FROM comentarios JOIN usuarios ON comentarios.usuario_id = usuarios.usuario_id WHERE apunte_id = $1 ORDER BY fecha_creacion DESC",
        [apunte_id]
    );
    res.json(result.rows);
});

app.post('/comentarios', verificarToken, async (req, res) => {
    const { apunte_id, usuario_id, texto } = req.body;
    await pool.query("INSERT INTO comentarios (apunte_id, usuario_id, texto) VALUES ($1, $2, $3)", [apunte_id, usuario_id, sanitize(texto)]);
    res.json("Comentario añadido");
});

// 3. Valoraciones: Registrar o actualizar
app.post('/valoraciones', verificarToken, async (req, res) => {
    const { apunte_id, usuario_id, estrellas } = req.body;
    await pool.query(
        "INSERT INTO valoraciones (apunte_id, usuario_id, estrellas) VALUES ($1, $2, $3) ON CONFLICT (apunte_id, usuario_id) DO UPDATE SET estrellas = EXCLUDED.estrellas",
        [apunte_id, usuario_id, estrellas]
    );
    res.json("Valoración guardada");
});

// =============================================
// RUTAS DE ADMINISTRADOR
// =============================================
const verificarAdmin = require('./middleware/admin');

// Dashboard - Estadísticas generales
app.get('/admin/stats', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const [usuarios, apuntes, equipos, comentarios, tareas, baneados, apuntesHoy, usuariosHoy, equiposHoy] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM usuarios"),
      pool.query("SELECT COUNT(*) FROM apuntes"),
      pool.query("SELECT COUNT(*) FROM equipos"),
      pool.query("SELECT COUNT(*) FROM comentarios"),
      pool.query("SELECT COUNT(*) FROM tareas"),
      pool.query("SELECT COUNT(*) FROM baneados"),
      pool.query("SELECT COUNT(*) FROM apuntes WHERE fecha_subida::date = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM usuarios WHERE fecha_registro::date = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM equipos WHERE fecha_creacion::date = CURRENT_DATE"),
    ]);

    // Apuntes por día (últimos 7 días)
    const apuntesPorDia = await pool.query(`
      SELECT fecha_subida::date AS dia, COUNT(*) AS total
      FROM apuntes
      WHERE fecha_subida >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY dia ORDER BY dia
    `);

    // Usuarios por día (últimos 7 días)
    const usuariosPorDia = await pool.query(`
      SELECT fecha_registro::date AS dia, COUNT(*) AS total
      FROM usuarios
      WHERE fecha_registro >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY dia ORDER BY dia
    `);

    // Equipos por día (últimos 7 días)
    const equiposPorDia = await pool.query(`
      SELECT fecha_creacion::date AS dia, COUNT(*) AS total
      FROM equipos
      WHERE fecha_creacion >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY dia ORDER BY dia
    `);

    res.json({
      totalUsuarios: parseInt(usuarios.rows[0].count),
      totalApuntes: parseInt(apuntes.rows[0].count),
      totalEquipos: parseInt(equipos.rows[0].count),
      totalComentarios: parseInt(comentarios.rows[0].count),
      totalTareas: parseInt(tareas.rows[0].count),
      totalBaneados: parseInt(baneados.rows[0].count),
      apuntesHoy: parseInt(apuntesHoy.rows[0].count),
      usuariosHoy: parseInt(usuariosHoy.rows[0].count),
      equiposHoy: parseInt(equiposHoy.rows[0].count),
      apuntesPorDia: apuntesPorDia.rows,
      usuariosPorDia: usuariosPorDia.rows,
      equiposPorDia: equiposPorDia.rows,
    });
  } catch (err) {
    console.error("Error en stats admin:", err.message);
    res.status(500).send("Error al obtener estadísticas");
  }
});

// Listar todos los usuarios
app.get('/admin/usuarios', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT usuario_id, nombre, email, fecha_registro, foto_url, rol FROM usuarios ORDER BY fecha_registro DESC"
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).send("Error al obtener usuarios");
  }
});

// Eliminar usuario
app.delete('/admin/usuarios/:id', verificarToken, verificarAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    if (String(req.usuario.id) === String(id)) {
      return res.status(400).json("No puedes eliminarte a ti mismo.");
    }
    await client.query('BEGIN');
    await client.query("DELETE FROM mensajes_chat WHERE usuario_id = $1", [id]);
    await client.query("DELETE FROM tareas WHERE asignado_a = $1 OR creado_por = $1", [id]);
    await client.query("DELETE FROM comentarios WHERE usuario_id = $1", [id]);
    await client.query("DELETE FROM apuntes WHERE usuario_id = $1", [id]);
    await client.query("DELETE FROM equipos WHERE creado_por = $1", [id]);
    await client.query("DELETE FROM usuarios WHERE usuario_id = $1", [id]);
    await client.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'eliminar_usuario', `Eliminó usuario ID ${id}`]
    );
    await client.query('COMMIT');
    res.json({ mensaje: "Usuario eliminado" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error al eliminar usuario:", err.message);
    res.status(500).send("Error al eliminar usuario");
  } finally {
    client.release();
  }
});

// Banear usuario
app.post('/admin/ban', verificarToken, verificarAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { usuario_id, motivo } = req.body;
    if (String(req.usuario.id) === String(usuario_id)) {
      return res.status(400).json("No puedes banearte a ti mismo.");
    }

    const usuario = await client.query("SELECT email FROM usuarios WHERE usuario_id = $1", [usuario_id]);
    if (usuario.rows.length === 0) return res.status(404).json("Usuario no encontrado");

    const email = usuario.rows[0].email;

    await client.query('BEGIN');

    // Insertar en baneados (ignorar si ya existe)
    await client.query(
      "INSERT INTO baneados (email, motivo, baneado_por) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET motivo = $2, baneado_por = $3, fecha_baneo = CURRENT_TIMESTAMP",
      [email, motivo || 'Sin motivo', req.usuario.id]
    );

    await client.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'banear_usuario', `Baneó a ${email}. Motivo: ${motivo || 'Sin motivo'}`]
    );

    await client.query('COMMIT');
    res.json({ mensaje: "Usuario baneado" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error al banear:", err.message);
    res.status(500).send("Error al banear usuario");
  } finally {
    client.release();
  }
});

// Ver lista de baneados
app.get('/admin/baneados', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT b.*, u.nombre AS admin_nombre FROM baneados b LEFT JOIN usuarios u ON b.baneado_por = u.usuario_id ORDER BY b.fecha_baneo DESC"
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).send("Error al obtener baneados");
  }
});

// Desbanear usuario
app.delete('/admin/baneados/:email', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { email } = req.params;
    await pool.query("DELETE FROM baneados WHERE email = $1", [decodeURIComponent(email)]);
    await pool.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'desbanear', `Desbaneó a ${decodeURIComponent(email)}`]
    );
    res.json({ mensaje: "Email desbaneado" });
  } catch (err) {
    res.status(500).send("Error al desbanear");
  }
});

// Eliminar apunte (como admin)
app.delete('/admin/apuntes/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM apuntes WHERE apunte_id = $1", [id]);
    await pool.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'eliminar_apunte', `Eliminó apunte ID ${id}`]
    );
    res.json({ mensaje: "Apunte eliminado" });
  } catch (err) {
    res.status(500).send("Error al eliminar apunte");
  }
});

// Eliminar comentario (como admin)
app.delete('/admin/comentarios/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM comentarios WHERE comentario_id = $1", [id]);
    await pool.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'eliminar_comentario', `Eliminó comentario ID ${id}`]
    );
    res.json({ mensaje: "Comentario eliminado" });
  } catch (err) {
    res.status(500).send("Error al eliminar comentario");
  }
});

// Eliminar tarea (como admin)
app.delete('/admin/tareas/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM tareas WHERE tarea_id = $1", [id]);
    await pool.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'eliminar_tarea', `Eliminó tarea ID ${id}`]
    );
    res.json({ mensaje: "Tarea eliminada" });
  } catch (err) {
    res.status(500).send("Error al eliminar tarea");
  }
});

// Logs de administrador
app.get('/admin/logs', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT l.*, u.nombre AS admin_nombre FROM admin_logs l LEFT JOIN usuarios u ON l.admin_id = u.usuario_id ORDER BY l.fecha DESC LIMIT 50"
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).send("Error al obtener logs");
  }
});

// Listar todos los apuntes (admin)
app.get('/admin/apuntes', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT apuntes.*, usuarios.nombre AS autor 
       FROM apuntes 
       JOIN usuarios ON apuntes.usuario_id = usuarios.usuario_id 
       ORDER BY apuntes.fecha_subida DESC`
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).send("Error al obtener apuntes");
  }
});

// Listar todos los comentarios (admin)
app.get('/admin/comentarios', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT c.*, u.nombre AS autor, a.titulo AS apunte_titulo 
       FROM comentarios c 
       JOIN usuarios u ON c.usuario_id = u.usuario_id 
       JOIN apuntes a ON c.apunte_id = a.apunte_id 
       ORDER BY c.fecha_creacion DESC`
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).send("Error al obtener comentarios");
  }
});

// Listar todos los equipos (admin)
app.get('/admin/equipos', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT e.*, u.nombre AS creador_nombre,
       (SELECT COUNT(*) FROM miembros_equipo m WHERE m.equipo_id = e.equipo_id) AS total_miembros,
       (SELECT COUNT(*) FROM tareas t WHERE t.equipo_id = e.equipo_id) AS total_tareas
       FROM equipos e 
       JOIN usuarios u ON e.creado_por = u.usuario_id 
       ORDER BY e.fecha_creacion DESC`
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).send("Error al obtener equipos");
  }
});

// Eliminar equipo (admin)
app.delete('/admin/equipos/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM equipos WHERE equipo_id = $1", [id]);
    await pool.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'eliminar_equipo', `Eliminó equipo ID ${id}`]
    );
    res.json({ mensaje: "Equipo eliminado" });
  } catch (err) {
    res.status(500).send("Error al eliminar equipo");
  }
});