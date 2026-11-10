const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const pool = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { borrarArchivo, borrarArchivos, tamanoArchivo } = require('./utils/files');
// Fail-fast y con un único valor compartido. Sin valor por defecto: un secreto
// conocido en el repositorio permitiría falsificar tokens de cualquier rol.
const { JWT_SECRET } = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});
app.set('io', io);

const { verificarToken, autenticarSocket } = require('./middleware/auth');
const { sanitize } = require('./middleware/sanitize');
const { obtenerRolEnEquipo, aEnteroPositivo } = require('./middleware/membresia');

// --- SOCKET.IO ---
// 1) Solo entran sockets con un JWT válido (el cliente lo manda en `auth`).
//    Se revalida contra la BD: un baneo o un cambio de rol cortan el acceso
//    en tiempo real, igual que en las rutas REST.
io.use((socket, next) => autenticarSocket(socket, next));

io.on('connection', (socket) => {
  // Sala propia del usuario: permite expulsarlo de inmediato (al banearlo)
  // sin esperar a que el cliente intente reconectar.
  socket.join(`usuario-${socket.usuario.id}`);

  // 2) Solo se puede entrar a la sala de un equipo del que se es miembro: sin
  //    esto cualquiera escuchaba el chat y el tablero de cualquier equipo.
  socket.on('unirse-equipo', async (equipoId, ack) => {
    try {
      const id = aEnteroPositivo(equipoId);
      const rol = id ? await obtenerRolEnEquipo(id, socket.usuario.id) : null;
      if (!rol) return ack?.({ ok: false });
      socket.join(`equipo-${id}`);
      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false });
    }
  });

  socket.on('salir-equipo', (equipoId) => {
    const id = aEnteroPositivo(equipoId);
    if (id) socket.leave(`equipo-${id}`);
  });

  // 3) Ya NO se retransmiten eventos enviados por clientes (nueva-tarea,
  //    mover-tarea, ...): los emiten las rutas REST tras escribir en la base,
  //    así nadie puede falsificarlos.
});

// --- 1. MIDDLEWARES ---
// Detrás de Nginx hay un proxy de confianza: sin esto el rate limit vería la
// IP del proxy en lugar de la del cliente.
app.set('trust proxy', 1);
// Cabeceras defensivas. CSP se desactiva porque este servicio solo devuelve
// JSON y archivos; la CSP de la aplicación la pone Nginx. Los uploads se sirven
// a propósito con CORP cross-origin (el frontend vive en otro puerto/origen en
// desarrollo), pero mantienen nosniff y el sandbox de más abajo.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Fuerza bruta: 10 intentos fallidos por IP cada 15 minutos. Los logins
// correctos no cuentan, así un usuario legítimo no se bloquea por entrar.
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 15 minutos.',
});

const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Demasiados registros desde esta dirección. Inténtalo más tarde.',
});

// Archivos subidos (debe estar antes de las rutas). Cabeceras defensivas:
// - nosniff: el navegador no adivina el tipo y respeta el de la extensión.
// - Cualquier extensión fuera de la lista (p. ej. un .html heredado) se sirve
//   como descarga y en sandbox, así nunca ejecuta scripts con el origen de la app.
const EXTENSIONES_PERMITIDAS = ['.pdf', '.png', '.jpg', '.jpeg'];
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, rutaArchivo) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!EXTENSIONES_PERMITIDAS.includes(path.extname(rutaArchivo).toLowerCase())) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    }
  }
}));

// --- 2. CONFIGURACIÓN DE MULTER ---
const equiposRoutes = require('./routes/equipos');
const tareasRoutes = require('./routes/tareas');
const chatRoutes = require('./routes/chat');

app.use('/equipos', equiposRoutes);
app.use('/tareas', tareasRoutes);
app.use('/chat', chatRoutes);
// --- SUBIDA DE ARCHIVOS ---
// El mimetype lo declara el cliente y es falsificable, así que un archivo se
// acepta solo si coinciden TRES cosas: mimetype, extensión y firma real de los
// primeros bytes (esta última se comprueba en `validarFirma`, tras guardarlo).
const TIPOS_APUNTE = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg', 'image/jpg'],
  '.jpeg': ['image/jpeg', 'image/jpg'],
};
const TIPOS_FOTO = {
  '.png': TIPOS_APUNTE['.png'],
  '.jpg': TIPOS_APUNTE['.jpg'],
  '.jpeg': TIPOS_APUNTE['.jpeg'],
};

// Nombre seguro y legible: sin acentos ni caracteres raros, extensión en minúsculas.
const nombreSeguro = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const base = path.basename(originalname, path.extname(originalname))
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80) || 'archivo';
  return `${Date.now()}-${base}${ext}`;
};

const filtroArchivo = (tiposPermitidos, mensaje) => (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (tiposPermitidos[ext]?.includes(file.mimetype)) cb(null, true);
  else cb(new Error(mensaje));
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, nombreSeguro(file.originalname)); }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: filtroArchivo(TIPOS_APUNTE, 'Solo se permiten archivos PDF, PNG o JPG')
});

const uploadPerfil = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/perfiles/'); },
    filename: (req, file, cb) => { cb(null, nombreSeguro(file.originalname)); }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: filtroArchivo(TIPOS_FOTO, 'Solo se permiten imágenes PNG o JPG')
});

const FIRMAS = {
  '.pdf': [Buffer.from('%PDF')],
  '.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  '.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
};

// Middleware: tras multer, comprueba los primeros bytes. Si no coinciden con la
// extensión, borra el archivo y rechaza la subida.
const validarFirma = (req, res, next) => {
  if (!req.file) return next();
  try {
    const ext = path.extname(req.file.filename).toLowerCase();
    const cabecera = Buffer.alloc(8);
    const fd = fs.openSync(req.file.path, 'r');
    try { fs.readSync(fd, cabecera, 0, 8, 0); } finally { fs.closeSync(fd); }
    const valido = (FIRMAS[ext] || []).some((firma) => cabecera.subarray(0, firma.length).equals(firma));
    if (valido) return next();
  } catch { /* se trata como inválido */ }
  fs.unlink(req.file.path, () => {});
  res.status(400).json('El contenido del archivo no coincide con su extensión');
};
// Cuota de disco por usuario para apuntes. Sin esto, 10 MB por archivo no
// impiden que una sola cuenta llene el volumen con cientos de subidas.
const CUOTA_APUNTES_MB = Number(process.env.UPLOAD_QUOTA_MB) > 0
  ? Number(process.env.UPLOAD_QUOTA_MB)
  : 100;
const CUOTA_APUNTES_BYTES = CUOTA_APUNTES_MB * 1024 * 1024;

async function usoApuntes(usuarioId) {
  const { rows } = await pool.query(
    'SELECT archivo_url FROM apuntes WHERE usuario_id = $1',
    [usuarioId]
  );
  const tamanos = await Promise.all(rows.map((fila) => tamanoArchivo(fila.archivo_url)));
  return tamanos.reduce((total, actual) => total + actual, 0);
}

const verificarCuotaApuntes = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const usado = await usoApuntes(req.usuario.id);
    if (usado + req.file.size > CUOTA_APUNTES_BYTES) {
      await borrarArchivo(`/uploads/${req.file.filename}`);
      return res.status(413).json(
        `Superaste la cuota de ${CUOTA_APUNTES_MB} MB de apuntes. Elimina archivos antiguos para liberar espacio.`
      );
    }
    next();
  } catch (err) {
    await borrarArchivo(`/uploads/${req.file.filename}`);
    next(err);
  }
};

// --- 3. RUTAS GENERALES ---
app.get('/', (req, res) => {
  res.send("¡El servidor de Edu-Verse está vivo! 🚀");
});

// --- 4. RUTAS DE AUTENTICACIÓN (Signup/Login) ---
const DOMINIO_INSTITUCIONAL = '@alumnos.udg.mx';
const normalizarEmail = (email) => String(email || '').trim().toLowerCase();

// Comparación sin distinguir mayúsculas en AMBOS lados, así también detecta
// baneos guardados antes de que existiera la normalización.
const estaBaneado = async (emailNorm) => {
  const r = await pool.query("SELECT 1 FROM baneados WHERE lower(email) = $1", [emailNorm]);
  return r.rows.length > 0;
};

app.post('/auth/signup', limitadorRegistro, async (req, res) => {
  try {
    const { nombre, email, password } = req.body || {};
    if (typeof nombre !== 'string' || typeof email !== 'string' || typeof password !== 'string'
        || !nombre.trim() || !email.trim() || !password) {
      return res.status(400).json("Campos obligatorios faltantes.");
    }

    // El email se guarda SIEMPRE en minúsculas. Antes se guardaba tal cual y el
    // baneo (que compara en minúsculas) se podía evadir registrándose con
    // mayúsculas en el correo.
    const emailNorm = normalizarEmail(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNorm)) return res.status(400).json("Email no válido.");
    if (!emailNorm.endsWith(DOMINIO_INSTITUCIONAL)) return res.status(400).json("Solo correos @alumnos.udg.mx");
    if (password.length < 6) return res.status(400).json("Contraseña corta.");
    if (nombre.trim().length > 100) return res.status(400).json("El nombre no puede superar 100 caracteres.");

    if (await estaBaneado(emailNorm)) {
      return res.status(403).json("Este correo ha sido suspendido. No puedes crear una cuenta.");
    }

    // Unicidad sin distinguir mayúsculas (cuentas heredadas pueden tenerlas).
    const existente = await pool.query("SELECT 1 FROM usuarios WHERE lower(email) = $1", [emailNorm]);
    if (existente.rows.length > 0) return res.status(400).json("El correo ya existe.");

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const nuevoUsuario = await pool.query(
      "INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      [nombre.trim(), emailNorm, passwordHash]
    );

    res.status(201).json({
      mensaje: "Usuario creado ✨",
      usuario: { id: nuevoUsuario.rows[0].usuario_id, nombre: nuevoUsuario.rows[0].nombre }
    });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json("El correo ya existe.");
    console.error("❌ Error en signup:", err);
    res.status(500).send("Error en el servidor");
  }
});

app.post('/auth/login', limitadorLogin, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
            return res.status(400).json("Ingresa tu correo y contraseña.");
        }
        const emailNorm = normalizarEmail(email);

        // Verificar si el email está baneado
        if (await estaBaneado(emailNorm)) {
            return res.status(403).json("Tu cuenta ha sido suspendida. Contacta al administrador.");
        }

        const usuario = await pool.query("SELECT * FROM usuarios WHERE lower(email) = $1 ORDER BY usuario_id LIMIT 1", [emailNorm]);

        if (usuario.rows.length === 0) return res.status(401).json("Credenciales incorrectas");

        // Una cuenta sin contraseña (p. ej. creada por un proveedor externo)
        // no puede entrar por aquí: antes bcrypt.compare lanzaba y daba un 500.
        const hash = usuario.rows[0].password_hash;
        const validPassword = hash ? await bcrypt.compare(password, hash) : false;
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
        console.error("❌ Error en login:", err);
        res.status(500).send("Error en el servidor");
    }
});

// --- 5. RUTAS DE PERFIL ---

// Devuelve el correo, así que solo lo puede ver su dueño (o un admin). Antes era
// público y permitía recorrer ids para recolectar los correos de los alumnos.
app.get('/auth/perfil/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.usuario.id) !== String(id) && req.usuario.rol !== 'admin') {
      return res.status(403).json("No autorizado");
    }
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
    const { nombre, email } = req.body || {};
    if (String(req.usuario.id) !== String(id)) return res.status(403).json("No autorizado");
    if (typeof nombre !== 'string' || !nombre.trim() || typeof email !== 'string') {
      return res.status(400).json("Nombre y correo son obligatorios");
    }
    if (nombre.trim().length > 100) return res.status(400).json("El nombre no puede superar 100 caracteres.");

    const emailNorm = normalizarEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm) || !emailNorm.endsWith(DOMINIO_INSTITUCIONAL)) {
      return res.status(400).json("Debe ser @alumnos.udg.mx");
    }
    // Cambiar el correo no debe servir para tomar uno ya baneado ni uno ajeno.
    if (await estaBaneado(emailNorm)) return res.status(403).json("Este correo ha sido suspendido.");
    const ocupado = await pool.query(
      "SELECT 1 FROM usuarios WHERE lower(email) = $1 AND usuario_id <> $2",
      [emailNorm, id]
    );
    if (ocupado.rows.length > 0) return res.status(400).json("El correo ya existe.");

    const updateUsuario = await pool.query(
      "UPDATE usuarios SET nombre = $1, email = $2 WHERE usuario_id = $3 RETURNING *",
      [nombre.trim(), emailNorm, id]
    );
    res.json({ mensaje: "Actualizado", nombre: updateUsuario.rows[0].nombre });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json("El correo ya existe.");
    res.status(500).send("Error");
  }
});

// --- 6. RUTAS DE APUNTES ---
app.post('/apuntes/upload', verificarToken, upload.single('archivo'), validarFirma, verificarCuotaApuntes, async (req, res) => {
  try {
    const { titulo, materia, descripcion } = req.body;
    const usuario_id = req.usuario.id;
    if (!req.file) return res.status(400).json("No hay archivo");
    const descartarArchivo = () => fs.unlink(req.file.path, () => {});
    if (typeof titulo !== 'string' || !titulo.trim() || typeof materia !== 'string' || !materia.trim()) {
      descartarArchivo();
      return res.status(400).json("Título y materia son obligatorios");
    }
    if (titulo.trim().length > 100 || materia.trim().length > 100) {
      descartarArchivo();
      return res.status(400).json("Título y materia no pueden superar 100 caracteres");
    }

    const archivo_url = `/uploads/${req.file.filename}`;
    const nuevoApunte = await pool.query(
      "INSERT INTO apuntes (titulo, materia, descripcion, archivo_url, usuario_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [sanitize(titulo.trim()), sanitize(materia.trim()), sanitize(typeof descripcion === 'string' ? descripcion : ''), archivo_url, usuario_id]
    );

    res.json({ mensaje: "¡Subido! 🚀", apunte: nuevoApunte.rows[0] });
  } catch (err) {
    // Si el INSERT falla, el archivo ya está en disco: se borra para no dejar
    // basura que además consumiría la cuota del usuario.
    if (req.file) await borrarArchivo(`/uploads/${req.file.filename}`);
    console.error("Error al subir apunte:", err.message);
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
// Solo los suyos: antes cualquiera podía recorrer ids y ver el inventario de
// apuntes de los demás.
app.get('/apuntes/mis-apuntes/:usuario_id', verificarToken, async (req, res) => {
  try {
    const { usuario_id } = req.params;
    if (String(usuario_id) !== String(req.usuario.id)) {
      return res.status(403).json("No autorizado");
    }
    const misApuntes = await pool.query(
      "SELECT * FROM apuntes WHERE usuario_id = $1 ORDER BY fecha_subida DESC",
      [req.usuario.id]
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
    const id = aEnteroPositivo(req.params.id);
    if (!id) return res.status(400).json("Apunte inválido");

    // Solo el autor (o un admin) puede borrar: antes cualquier usuario con
    // sesión podía borrar los apuntes de otros.
    const apunte = await pool.query(
      "SELECT usuario_id, archivo_url FROM apuntes WHERE apunte_id = $1",
      [id]
    );
    if (apunte.rows.length === 0) return res.status(404).json("Apunte no encontrado");
    if (String(apunte.rows[0].usuario_id) !== String(req.usuario.id) && req.usuario.rol !== 'admin') {
      return res.status(403).json("Solo el autor puede eliminar este apunte");
    }

    await pool.query("DELETE FROM apuntes WHERE apunte_id = $1", [id]);
    // El registro ya no existe; el archivo tampoco debe quedarse ocupando disco.
    await borrarArchivo(apunte.rows[0].archivo_url);
    res.json("Apunte eliminado con éxito");
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error al eliminar el apunte");
  }
});

// GUARDAR UN APUNTE COMO FAVORITO
app.post('/favoritos', verificarToken, async (req, res) => {
  try {
    const apunte_id = aEnteroPositivo(req.body?.apunte_id);
    if (!apunte_id) return res.status(400).json({ message: "Apunte inválido" });
    // La identidad sale del token: no se puede guardar favoritos a nombre de otro.
    await pool.query(
      "INSERT INTO favoritos (usuario_id, apunte_id) VALUES ($1, $2)",
      [req.usuario.id, apunte_id]
    );
    res.json({ message: "Añadido a favoritos ⭐" });
  } catch (err) {
    // Si el error es por duplicado (código 23505)
    if (err.code === '23505') {
      return res.status(400).json({ message: "Ya tienes este apunte en favoritos" });
    }
    if (err.code === '23503') {
      return res.status(404).json({ message: "Apunte no encontrado" });
    }
    console.error(err.message);
    res.status(500).send("Error al guardar favorito");
  }
});

// OBTENER TODOS LOS FAVORITOS DE UN USUARIO
app.get('/favoritos/:usuario_id', verificarToken, async (req, res) => {
  try {
    const { usuario_id } = req.params;
    if (String(req.usuario.id) !== String(usuario_id)) return res.status(403).json("No autorizado");
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
// La comprobación de dueño va ANTES de multer: así un usuario no autorizado
// ni siquiera llega a escribir un archivo en el disco.
const soloMismoUsuario = (req, res, next) => {
  if (String(req.usuario.id) !== String(req.params.id)) return res.status(403).json("No autorizado");
  next();
};

app.put('/usuarios/foto/:id', verificarToken, soloMismoUsuario, uploadPerfil.single('foto'), validarFirma, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json("No hay imagen");
    const urlFoto = `/uploads/perfiles/${req.file.filename}`;

    const anterior = await pool.query(
      "SELECT foto_url FROM usuarios WHERE usuario_id = $1",
      [id]
    );

    await pool.query(
      "UPDATE usuarios SET foto_url = $1 WHERE usuario_id = $2",
      [urlFoto, id]
    );

    // La foto anterior ya no la referencia nadie: se borra para no acumular
    // archivos huérfanos con cada cambio de avatar.
    if (anterior.rows[0]?.foto_url && anterior.rows[0].foto_url !== urlFoto) {
      await borrarArchivo(anterior.rows[0].foto_url);
    }

    res.json({ message: "Foto actualizada", url: urlFoto });
  } catch (err) {
    if (req.file) await borrarArchivo(`/uploads/perfiles/${req.file.filename}`);
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

// El usuario sale del token (el `usuario_id` del body se ignora): antes se
// podía comentar y calificar a nombre de otra persona.
app.post('/comentarios', verificarToken, async (req, res) => {
    try {
        const apunte_id = aEnteroPositivo(req.body?.apunte_id);
        const { texto } = req.body || {};
        if (!apunte_id) return res.status(400).json("Apunte inválido");
        if (typeof texto !== 'string' || !texto.trim()) return res.status(400).json("El comentario no puede estar vacío");
        await pool.query("INSERT INTO comentarios (apunte_id, usuario_id, texto) VALUES ($1, $2, $3)", [apunte_id, req.usuario.id, sanitize(texto.trim())]);
        res.json("Comentario añadido");
    } catch (err) {
        if (err.code === '23503') return res.status(404).json("Apunte no encontrado");
        console.error("Error al comentar:", err.message);
        res.status(500).send("Error al comentar");
    }
});

// 3. Valoraciones: Registrar o actualizar
app.post('/valoraciones', verificarToken, async (req, res) => {
    try {
        const apunte_id = aEnteroPositivo(req.body?.apunte_id);
        const estrellas = Number(req.body?.estrellas);
        if (!apunte_id) return res.status(400).json("Apunte inválido");
        if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) return res.status(400).json("La valoración debe ser de 1 a 5");
        await pool.query(
            "INSERT INTO valoraciones (apunte_id, usuario_id, estrellas) VALUES ($1, $2, $3) ON CONFLICT (apunte_id, usuario_id) DO UPDATE SET estrellas = EXCLUDED.estrellas",
            [apunte_id, req.usuario.id, estrellas]
        );
        res.json("Valoración guardada");
    } catch (err) {
        if (err.code === '23503') return res.status(404).json("Apunte no encontrado");
        console.error("Error al valorar:", err.message);
        res.status(500).send("Error al valorar");
    }
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
    const id = aEnteroPositivo(req.params.id);
    if (!id) return res.status(400).json("Usuario inválido");
    if (String(req.usuario.id) === String(id)) {
      return res.status(400).json("No puedes eliminarte a ti mismo.");
    }

    const objetivo = await client.query(
      "SELECT nombre, email, foto_url FROM usuarios WHERE usuario_id = $1",
      [id]
    );
    if (objetivo.rows.length === 0) return res.status(404).json("Usuario no encontrado");

    await client.query('BEGIN');

    // Equipos en los que participaba (se consulta ANTES de borrar la membresía).
    const equipos = await client.query("SELECT equipo_id FROM miembros_equipo WHERE usuario_id = $1", [id]);

    // Archivos asociados: sus apuntes (la fila se borra en cascada) y su foto.
    const archivos = await client.query("SELECT archivo_url FROM apuntes WHERE usuario_id = $1", [id]);

    // Las claves foráneas ya hacen lo correcto: sus apuntes, comentarios,
    // favoritos, valoraciones y membresías se borran en cascada, y sus mensajes,
    // tareas creadas/asignadas y equipos creados quedan con el autor en NULL.
    // Antes se borraban a mano TODAS las tareas donde figuraba y TODOS los
    // equipos que creó, destruyendo el trabajo de los demás miembros.
    await client.query("DELETE FROM usuarios WHERE usuario_id = $1", [id]);

    // Que ningún equipo quede huérfano o sin administrador.
    for (const { equipo_id } of equipos.rows) {
      const restantes = await client.query(
        "SELECT usuario_id, rol FROM miembros_equipo WHERE equipo_id = $1 ORDER BY usuario_id",
        [equipo_id]
      );
      if (restantes.rows.length === 0) {
        await client.query("DELETE FROM equipos WHERE equipo_id = $1", [equipo_id]);
      } else if (!restantes.rows.some((m) => m.rol === 'admin')) {
        await client.query(
          "UPDATE miembros_equipo SET rol = 'admin' WHERE equipo_id = $1 AND usuario_id = $2",
          [equipo_id, restantes.rows[0].usuario_id]
        );
      }
    }

    await client.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'eliminar_usuario', `Eliminó usuario ID ${id} (${objetivo.rows[0].email})`]
    );
    await client.query('COMMIT');

    // Solo después del COMMIT: si algo falló y hubo ROLLBACK, los archivos
    // siguen siendo necesarios para las filas que no se borraron.
    await borrarArchivos([
      objetivo.rows[0].foto_url,
      ...archivos.rows.map((fila) => fila.archivo_url),
    ]);

    res.json({ mensaje: "Usuario eliminado" });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
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

    // En minúsculas, igual que se comparan en login y registro.
    const email = usuario.rows[0].email.toLowerCase();

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

    // El baneo corta el acceso de inmediato: se expulsan los sockets del
    // usuario para que no siga escuchando el chat de sus equipos. Sus
    // peticiones REST ya las rechaza verificarToken.
    const io = req.app.get('io');
    io?.in(`usuario-${usuario_id}`).disconnectSockets(true);

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
    const email = normalizarEmail(decodeURIComponent(req.params.email));
    await pool.query("DELETE FROM baneados WHERE lower(email) = $1", [email]);
    await pool.query(
      "INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)",
      [req.usuario.id, 'desbanear', `Desbaneó a ${email}`]
    );
    res.json({ mensaje: "Email desbaneado" });
  } catch (err) {
    res.status(500).send("Error al desbanear");
  }
});

// Eliminar apunte (como admin)
app.delete('/admin/apuntes/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const id = aEnteroPositivo(req.params.id);
    if (!id) return res.status(400).json("Apunte inválido");

    const apunte = await pool.query(
      "SELECT archivo_url FROM apuntes WHERE apunte_id = $1",
      [id]
    );
    if (apunte.rows.length === 0) return res.status(404).json("Apunte no encontrado");

    await pool.query("DELETE FROM apuntes WHERE apunte_id = $1", [id]);
    await borrarArchivo(apunte.rows[0].archivo_url);
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

app.get('/admin/moderacion', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT m.*, u.nombre AS usuario_nombre, e.nombre AS equipo_nombre
       FROM moderacion_logs m
       LEFT JOIN usuarios u ON m.usuario_id = u.usuario_id
       LEFT JOIN equipos e ON m.equipo_id = e.equipo_id
       ORDER BY m.fecha DESC LIMIT 100`
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).send("Error al obtener logs de moderación");
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
      `SELECT e.*, COALESCE(u.nombre, 'Usuario eliminado') AS creador_nombre,
       (SELECT COUNT(*) FROM miembros_equipo m WHERE m.equipo_id = e.equipo_id) AS total_miembros,
       (SELECT COUNT(*) FROM tareas t WHERE t.equipo_id = e.equipo_id) AS total_tareas
       FROM equipos e
       LEFT JOIN usuarios u ON e.creado_por = u.usuario_id
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

// =============================================
// MANEJO DE ERRORES (debe ir DESPUÉS de todas las rutas)
// =============================================
// Cualquier URL que no haya coincidido con una ruta responde JSON, no el HTML
// por defecto de Express.
app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Responde JSON (los errores de subida y de cuerpo mal formado antes salían
// como un 500 con HTML) y no filtra detalles internos al cliente.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const mensaje = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido' : 'No se pudo procesar el archivo';
    return res.status(400).json(mensaje);
  }
  if (err?.message?.startsWith('Solo se permiten')) {
    return res.status(400).json(err.message);
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json('El cuerpo de la petición no es un JSON válido');
  }

  console.error('❌ Error no controlado:', err?.message);
  res.status(500).json('Error en el servidor');
});
