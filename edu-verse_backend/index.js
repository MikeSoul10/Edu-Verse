const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');
const multer = require('multer'); // Movido arriba con los demás imports
const path = require('path');
require('dotenv').config();

const app = express();

// --- 1. MIDDLEWARES ---
app.use(cors());
app.use(express.json());
// Servir archivos estáticos (debe estar antes de las rutas)
app.use('/uploads', express.static('uploads'));

// --- 2. CONFIGURACIÓN DE MULTER ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

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

    res.json({
      mensaje: "¡Éxito!",
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
    const usuario = await pool.query("SELECT nombre, email FROM usuarios WHERE usuario_id = $1", [id]);
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
app.post('/apuntes/upload', upload.single('archivo'), async (req, res) => {
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
app.listen(PORT, () => {
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