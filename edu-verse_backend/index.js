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

const verificarToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; // Extrae el token del Header: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ mensaje: "Acceso denegado. No hay token." });
    }

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_provisional');
        req.usuario = verificado; // Guarda los datos del usuario en la petición
        next(); // Continúa a la siguiente función
    } catch (err) {
        res.status(400).json({ mensaje: "Token no válido." });
    }
};

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
const upload = multer({ storage: storageApuntes });

// Almacenamiento para Fotos de Perfil
const storagePerfil = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/perfiles/'); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const uploadPerfil = multer({ storage: storagePerfil });
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
    if (!email.toLowerCase().endsWith('.edu')) return res.status(400).json("Solo correos .edu");
    if (password.length < 6) return res.status(400).json("Contraseña corta.");

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
        const usuario = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        
        if (usuario.rows.length === 0) return res.status(401).json("Credenciales incorrectas");

        const validPassword = await bcrypt.compare(password, usuario.rows[0].password_hash);
        if (!validPassword) return res.status(401).json("Credenciales incorrectas");

        // --- CREAR TOKEN ---
        const token = jwt.sign(
            { id: usuario.rows[0].usuario_id, nombre: usuario.rows[0].nombre },
            process.env.JWT_SECRET || 'clave_secreta_provisional',
            { expiresIn: '24h' } // El token expira en un día
        );

        res.json({
            mensaje: "¡Éxito!",
            token, // Enviamos el token al frontend
            usuario: { id: usuario.rows[0].usuario_id, nombre: usuario.rows[0].nombre }
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

app.put('/auth/perfil/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email } = req.body;
    if (!email.endsWith('.edu')) return res.status(400).json("Debe ser .edu");

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
    const usuario_id = req.usuario.id;
  try {
    const { titulo, materia, descripcion, usuario_id } = req.body;
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
    
    const valores = [`%${q}%` || '%%']; 
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
app.delete('/apuntes/:id', async (req, res) => {
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
    const usuario_id = req.usuario.id;
  try {
    const { usuario_id, apunte_id } = req.body;
    
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
app.put('/usuarios/foto/:id', uploadPerfil.single('foto'), async (req, res) => {
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

app.post('/comentarios', async (req, res) => {
    const { apunte_id, usuario_id, texto } = req.body;
    await pool.query("INSERT INTO comentarios (apunte_id, usuario_id, texto) VALUES ($1, $2, $3)", [apunte_id, usuario_id, texto]);
    res.json("Comentario añadido");
});

// 3. Valoraciones: Registrar o actualizar
app.post('/valoraciones', async (req, res) => {
    const { apunte_id, usuario_id, estrellas } = req.body;
    await pool.query(
        "INSERT INTO valoraciones (apunte_id, usuario_id, estrellas) VALUES ($1, $2, $3) ON CONFLICT (apunte_id, usuario_id) DO UPDATE SET estrellas = EXCLUDED.estrellas",
        [apunte_id, usuario_id, estrellas]
    );
    res.json("Valoración guardada");
});