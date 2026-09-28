# 📊 Diagramas de Flujo del Proyecto — Edu-Verse

Este documento contiene la representación visual y los diagramas de flujo completos de **Edu-Verse** en formato de **imágenes PNG** y sus correspondientes especificaciones en **Mermaid**, abarcando la arquitectura de infraestructura, flujos de autenticación, módulo de apuntes, comunidad, colaboración en tiempo real con WebSockets (Socket.IO), panel de administración y el modelo entidad-relación de la base de datos PostgreSQL.

---

## 📋 Índice de Diagramas

1. [Arquitectura General e Infraestructura](#1-arquitectura-general-e-infraestructura)
2. [Flujo de Autenticación y Autorización (JWT)](#2-flujo-de-autenticacion-y-autorizacion-jwt)
   - [2.1 Registro de Usuario (`POST /auth/signup`)](#21-registro-de-usuario-post-authsignup)
   - [2.2 Inicio de Sesión (`POST /auth/login`)](#22-inicio-de-sesion-post-authlogin)
3. [Flujo de Gestión de Apuntes (Subida y Búsqueda)](#3-flujo-de-gestion-de-apuntes)
4. [Flujo de Comunidad (Favoritos, Comentarios y Valoraciones)](#4-flujo-de-comunidad)
5. [Flujo de Equipos y Colaboración en Tiempo Real (Socket.IO)](#5-flujo-de-equipos-y-colaboracion-en-tiempo-real)
6. [Flujo de Administración y Moderación de Usuarios](#6-flujo-de-administracion-y-moderacion)
7. [Modelo Entidad-Relación (Base de Datos)](#7-modelo-entidad-relacion-base-de-datos)

---

## 1. Arquitectura General e Infraestructura

Representación de la arquitectura multinivel desplegada con **Docker Compose**.

![Arquitectura General e Infraestructura](documentacion/imagenes/01_arquitectura_general.png)

<details>
<summary>🔍 Ver código del diagrama (Mermaid)</summary>

```mermaid
flowchart TD
    subgraph Cliente ["💻 Cliente (Navegador)"]
        UI["React 19 + Vite App\n(Puerto 5173)"]
        State["Estado Local & AuthContext\n(JWT en LocalStorage)"]
    end

    subgraph DockerContainer ["🐳 Contenedores Docker"]
        subgraph FrontendServer ["Servidor Frontend"]
            ViteDev["Vite Dev Server / Nginx"]
        end

        subgraph BackendServer ["Servidor Backend (Express)"]
            API["API REST Express 5\n(Puerto 4000)"]
            SocketServer["Servidor WebSocket\n(Socket.IO)"]
            StaticUploads["Middleware Estático\n(/uploads)"]
        end

        subgraph Database ["Base de Datos"]
            PostgreSQL[("PostgreSQL 16\n(Puerto 5432)")]
        end
    end

    UI -->|"Peticiones HTTP (Axios)"| API
    UI <-->|"Eventos WSS (Socket.IO-client)"| SocketServer
    API -->|"Consultas SQL (Pool pg)"| PostgreSQL
    StaticUploads -->|"Almacenamiento Local"| Storage[("Volumen uploads/")]
```
</details>

---

## 2. Flujo de Autenticación y Autorización (JWT)

### 2.1 Registro de Usuario (`POST /auth/signup`)

![Flujo de Registro de Usuario](documentacion/imagenes/02_1_flujo_registro.png)

<details>
<summary>🔍 Ver código del diagrama (Mermaid)</summary>

```mermaid
flowchart TD
    Inicio([Inicio: Formulario Registro]) --> InputData["Ingresar nombre, email, password"]
    InputData --> ValidarCampos{"¿Campos completos?"}
    
    ValidarCampos -- No --> ErrorCampos["Devolver 400: Campos obligatorios"]
    ValidarCampos -- Sí --> ValidarEmail{"¿Email válido y termina en\n@alumnos.udg.mx?"}
    
    ValidarEmail -- No --> ErrorEmail["Devolver 400: Email institucional no válido"]
    ValidarEmail -- Sí --> ValidarPassword{"¿Contraseña >= 6 caracteres?"}
    
    ValidarPassword -- No --> ErrorPass["Devolver 400: Contraseña muy corta"]
    ValidarPassword -- Sí --> CheckBaneado["Consultar tabla 'baneados' por email"]
    
    CheckBaneado --> IsBaneado{"¿Email registrado en baneados?"}
    IsBaneado -- Sí --> ErrorBaneado["Devolver 403: Cuenta suspendida"]
    IsBaneado -- No --> HashPassword["Generar Salt (10) y Hash con bcrypt"]
    
    HashPassword --> InsertUser["INSERT INTO usuarios (...) RETURNING *"]
    InsertUser --> CatchDuplicate{"¿Error 23505\n(Email duplicado)?"}
    
    CatchDuplicate -- Sí --> ErrorDup["Devolver 400: El correo ya existe"]
    CatchDuplicate -- No --> SuccessSignup["Devolver 201: Usuario creado ✨"] --> Fin([Fin])
```
</details>

### 2.2 Inicio de Sesión (`POST /auth/login`)

![Flujo de Inicio de Sesión](documentacion/imagenes/02_2_flujo_login.png)

<details>
<summary>🔍 Ver código del diagrama (Mermaid)</summary>

```mermaid
flowchart TD
    Inicio([Inicio: Formulario Login]) --> Credentials["Ingresar email y password"]
    Credentials --> CheckBan["SELECT * FROM baneados WHERE email = param"]
    
    CheckBan --> IsBanned{"¿Está baneado?"}
    IsBanned -- Sí --> RespBan["Devolver 403: Cuenta suspendida"]
    IsBanned -- No --> FindUser["SELECT * FROM usuarios WHERE email = param"]
    
    FindUser --> UserExists{"¿Usuario existe?"}
    UserExists -- No --> InvalidCreds["Devolver 401: Credenciales incorrectas"]
    
    UserExists -- Sí --> ComparePass["bcrypt.compare(password, password_hash)"]
    ComparePass --> PassValid{"¿Contraseña correcta?"}
    
    PassValid -- No --> InvalidCreds
    PassValid -- Sí --> GenJWT["jwt.sign({ id, nombre, rol }, JWT_SECRET, 24h)"]
    
    GenJWT --> SaveState["Cliente guarda Token & Usuario en LocalStorage"]
    SaveState --> Redirect{"¿Rol de Usuario?"}
    
    Redirect -- Admin --> RedirAdmin["Redirigir a /admin"]
    Redirect -- User --> RedirHome["Redirigir a /"] --> Fin([Fin])
```
</details>

---

## 3. Flujo de Gestión de Apuntes

![Flujo de Gestión de Apuntes](documentacion/imagenes/03_flujo_apuntes.png)

<details>
<summary>🔍 Ver código del diagrama (Mermaid)</summary>

```mermaid
flowchart TD
    subgraph Subida ["📤 Subida de Apuntes"]
        InicioForm([Inicio Formulario Upload]) --> AuthCheck{"¿Usuario Autenticado?"}
        AuthCheck -- No --> RedirLogin["Redirigir a /login"]
        AuthCheck -- Sí --> SelectFile["Seleccionar PDF/PNG/JPG (< 10MB)\ne ingresar Título, Materia, Descripción"]
        SelectFile --> MulterVal["Middleware Multer procesa archivo"]
        MulterVal --> SaveFile["Guardar en /uploads/ timestamp-nombre"]
        SaveFile --> DBInsert["INSERT INTO apuntes (...)"]
        DBInsert --> SuccessUpload["Devolver 201: Apunte publicado"]
    end

    subgraph Busqueda ["🔍 Búsqueda y Detalle"]
        SearchInput["Ingresar término de búsqueda ?q="] --> SearchQuery["SELECT * FROM apuntes WHERE titulo ILIKE %q%"]
        SearchQuery --> DisplayCards["Mostrar tarjetas de apuntes"]
        DisplayCards --> ClickDetail["Ver detalle apunte (GET /apuntes/detalle/:id)"]
    end
```
</details>

---

## 4. Flujo de Comunidad

![Flujo de Comunidad](documentacion/imagenes/04_flujo_comunidad.png)

<details>
<summary>🔍 Ver código del diagrama (Mermaid)</summary>

```mermaid
flowchart TD
    subgraph Favoritos ["⭐ Favoritos"]
        FavClick["Clic en Favorito"] --> CheckFav{"¿Ya es favorito?"}
        CheckFav -- No --> AddFav["POST /favoritos"]
        CheckFav -- Sí --> RemFav["DELETE /favoritos"]
    end

    subgraph Valoraciones ["🌟 Valoraciones (1-5 Estrellas)"]
        StarClick["Seleccionar Estrellas"] --> SendRating["POST /valoraciones"]
        SendRating --> UpsertRating["INSERT ON CONFLICT DO UPDATE"]
        UpsertRating --> RecalcAVG["Recalcular Promedio AVG"]
    end

    subgraph Comentarios ["💬 Comentarios"]
        WriteComment["Escribir Comentario"] --> SendComment["POST /comentarios"]
        SendComment --> InsertComment["INSERT INTO comentarios"]
        InsertComment --> UpdateList["Actualizar lista de comentarios"]
    end
```
</details>

---

## 5. Flujo de Equipos y Colaboración en Tiempo Real

![Flujo de Equipos y WebSockets](documentacion/imagenes/05_flujo_equipos_websockets.png)

<details>
<summary>🔍 Ver código del diagrama (Mermaid)</summary>

```mermaid
flowchart TD
    subgraph ClientA ["💻 Usuario A (Frontend)"]
        OpenTeamA["Abre espacio del equipo ID: 5"]
        JoinRoomA["Emit: 'unirse-equipo', 5"]
    end

    subgraph ClientB ["💻 Usuario B (Frontend)"]
        OpenTeamB["Abre espacio del equipo ID: 5"]
        JoinRoomB["Emit: 'unirse-equipo', 5"]
    end

    subgraph SocketServer ["⚡ Servidor Socket.IO (Backend)"]
        SocketJoin["Agrega sockets a la sala 'equipo-5'"]
        BroadcastTask["Recibe evento 'nueva-tarea' / 'mover-tarea'\ny retransmite a la sala 'equipo-5'"]
        BroadcastChat["Recibe evento 'mensaje-chat'\ny retransmite a la sala 'equipo-5'"]
    end

    JoinRoomA --> SocketJoin
    JoinRoomB --> SocketJoin

    ClientA -->|"Emit: 'nueva-tarea' / 'mover-tarea'"| BroadcastTask
    BroadcastTask -->|"Emit: 'tarea-creada' / 'tarea-movida'"| ClientB

    ClientB -->|"Emit: 'mensaje-chat'"| BroadcastChat
    BroadcastChat -->|"Emit: 'nuevo-mensaje'"| ClientA
```
</details>

---

## 6. Flujo de Administración y Moderación

![Flujo de Administración](documentacion/imagenes/06_flujo_administracion.png)

<details>
<summary>🔍 Ver código del diagrama (Mermaid)</summary>

```mermaid
flowchart TD
    Inicio([Inicio: Panel Admin /admin]) --> CheckAdminToken{"¿Token válido & rol === 'admin'?"}
    
    CheckAdminToken -- No --> AccessDenied["Devolver 403: Acceso denegado"]
    CheckAdminToken -- Sí --> AdminDashboard["Cargar Dashboard de Administración"]
    
    AdminDashboard --> AdminAction{"Seleccionar Acción"}
    
    AdminAction -- "Banear Usuario" --> BanUser["INSERT INTO baneados (email, motivo)\nINSERT INTO admin_logs (...)"]
    AdminAction -- "Eliminar Contenido" --> DeleteContent["DELETE FROM apuntes WHERE apunte_id = $1\nDELETE FROM comentarios WHERE comentario_id = $1"]
    AdminAction -- "Ver Métricas" --> ViewStats["SELECT count(*) FROM usuarios, apuntes, equipos"]
    
    BanUser --> LogAudit["Guardar Registro en admin_logs"]
    DeleteContent --> LogAudit
    LogAudit --> RefreshAdminUI["Actualizar Tabla de Control en Frontend"] --> Fin([Fin])
```
</details>

---

## 7. Modelo Entidad-Relación (Base de Datos)

Diagrama de la estructura de tablas de **PostgreSQL** (`Edu-verseDB`).

![Modelo Entidad-Relación](documentacion/imagenes/07_modelo_entidad_relacion.png)

<details>
<summary>🔍 Ver código del diagrama (Mermaid)</summary>

```mermaid
erDiagram
    usuarios ||--o{ apuntes : "publica"
    usuarios ||--o{ comentarios : "escribe"
    usuarios ||--o{ valoraciones : "califica"
    usuarios ||--o{ favoritos : "guarda"
    usuarios ||--o{ miembros_equipo : "pertenece"
    usuarios ||--o{ mensajes_chat : "envía"
    usuarios ||--o{ admin_logs : "ejecuta_accion"

    apuntes ||--o{ comentarios : "recibe"
    apuntes ||--o{ valoraciones : "recibe"
    apuntes ||--o{ favoritos : "es_guardado"

    equipos ||--o{ miembros_equipo : "contiene"
    equipos ||--o{ tareas : "gestiona"
    equipos ||--o{ mensajes_chat : "almacena"

    usuarios {
        int usuario_id PK
        string nombre
        string email
        string password_hash
        timestamp fecha_registro
        string foto_url
        string rol
    }

    apuntes {
        int apunte_id PK
        string titulo
        string materia
        text descripcion
        string archivo_url
        int usuario_id FK
        timestamp fecha_subida
    }

    comentarios {
        int comentario_id PK
        int apunte_id FK
        int usuario_id FK
        text texto
        timestamp fecha_creacion
    }

    valoraciones {
        int valoracion_id PK
        int apunte_id FK
        int usuario_id FK
        int estrellas
        timestamp fecha_creacion
    }

    favoritos {
        int favorito_id PK
        int usuario_id FK
        int apunte_id FK
        timestamp fecha_agregado
    }

    equipos {
        int equipo_id PK
        string nombre
        text descripcion
        int creador_id FK
        timestamp fecha_creacion
    }

    miembros_equipo {
        int miembro_id PK
        int equipo_id FK
        int usuario_id FK
        string rol
        timestamp fecha_unión
    }

    tareas {
        int tarea_id PK
        int equipo_id FK
        string titulo
        text descripcion
        string estado
        int asignado_a FK
        timestamp fecha_creacion
    }

    mensajes_chat {
        int mensaje_id PK
        int equipo_id FK
        int usuario_id FK
        text texto
        timestamp fecha_envio
    }

    baneados {
        int ban_id PK
        string email
        text motivo
        timestamp fecha_baneo
    }

    admin_logs {
        int log_id PK
        int admin_id FK
        string accion
        text detalles
        timestamp fecha
    }
```
</details>

---

*Documentación oficial del proyecto Edu-Verse.*
