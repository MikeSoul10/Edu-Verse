# Filtro del Chat — Groserías y Moderación

> Documento técnico del sistema de filtrado de lenguaje ofensivo en el chat de equipos.
> Cubre normalización, lista de palabras, enmascarado, lectura filtrada, registro y falsos positivos.

---

## 1. Visión general

El filtro vive en `edu-verse_backend/middleware/profanity.js` y se aplica **solo** en la ruta
`POST /chat/enviar` (`routes/chat.js`). El flujo:

1. El frontend manda `{ equipo_id, texto }` con el token JWT en `Authorization`.
2. Backend:
   - Normaliza el texto (NFD, quita tildes, mapa leet, colapsa repeticiones).
   - Busca palabras bloqueadas con **límites de palabra** (no subcadenas).
   - Enmascara conservando la primera letra (`puta` → `p***`).
   - Escapa HTML (`sanitize`) y guarda en `mensajes_chat`.
   - Si hubo censura, registra en `moderacion_logs` (usuario, equipo, palabras, cantidad).
   - Emite `nuevo-mensaje` por Socket.IO a la sala `equipo-${equipo_id}`.
   - Responde `201` con `{ ..., censurado: true, palabras: [...] }`.
3. Frontend muestra toast si `censurado === true`.

**El GET `/chat/:equipo_id` ahora también filtra en lectura** (red de seguridad para
historial anterior al filtro) y exige autenticación + membresía.

---

## 2. Normalización (`normalizar`)

Entrada → proceso → salida:

| Paso | Qué hace | Ejemplo |
|---|---|---|
| NFD + strip diacríticos | `míércoles` → `miercoles` | ✓ |
| Mapa leet (1 char) | `p4l4br4` → `palabra` | 4→a, 3→e, 1→i, 0→o, 5→s, 7→t, @→a, $→s, +→t, !→i |
| Colapsa repeticiones | `putaaaa` → `puta` | ✓ |
| Solo alfanuméricos | Ignora espacios, signos, emojis | ✓ |

La función devuelve `{ texto: string, spans: [ [ini, fin], ... ] }` donde `spans`
mapea cada carácter alfanumérico normalizado a su índice en el original. Así el
enmascarado sabe exactamente qué posiciones tapar aunque el original tenga tildes,
leet o repetidos.

---

## 3. Detección con límites de palabra

Una palabra bloqueada **solo dispara si está delimitada** por no-alfanuméricos
(inicio/fin de string, espacio, puntuación). Ejemplos:

| Texto | Dispara | Por qué |
|---|---|---|
| `puta` | ✓ | límites reales |
| `puta!` | ✓ | `!` no es alfanumérico |
| `putas` | ✓ | forma plural en lista |
| `computadora` | ✗ | `puta` es subcadena, `o`/`d` son alfanuméricos |
| `puta3` | ✗ | `3` es alfanumérico |
| `PUTA` | ✓ | normaliza a minúsculas |

Esto evita falsos positivos en palabras compuestas técnicas (`computadora`,
`reputación`, `input`, `output`, etc.).

---

## 4. Enmascarado (conserva la primera letra)

Código clave (`profanity.js:106-112`):

```js
if (!mask[i]) { salida += texto[i]; i++; continue; }
salida += texto[i];                 // ← primera letra visible
let j = i + 1;
while (j < texto.length && mask[j]) { salida += '*'; j++; }
i = j;
```

| Entrada | Longitud | Sale | Se lee |
|---|---|---|---|
| `puta` | 4 | `p***` | obvio |
| `mierda` | 6 | `m*****` | obvio |
| `hijueputa` | 9 | `h********` | obvio |

**Decisión de diseño (no se cambia):** la primera letra queda visible para que
el autor reconozca su propia palabra y el contexto no pierda toda la forma.
Si se quiere tapar todo, habría que cambiar la máscara a longitud fija
(`****` para cualquier palabra) y aceptar que el largo original se oculta.

---

## 5. Lista de palabras bloqueadas (`PALABRAS_BLOQUEADAS`)

### Español (latino, énfasis México)
```
mierda, mierdas
cagar, cagada, cagadas, cagon, cagones, cagona, cagonas
puta, puto, putas, putos, puton, putona, putones, putonas
joder, jodido, jodidos, jodida, jodidas, jodes
carajo, carajos
verga, vergas
polla, pollas, pola, polas
chingar, chingada, chingadas, chingado, chingados
chinga, chingas, chingo, chingon, chingona, chinguear
huevon, huevona, huevones
pendejo, pendeja, pendejos, pendejas, pendejon, pendejona
imbecil, imbiciles
malparido, malparida, malparidos, malparidas
cabron, cabrona, cabrones
gilipollas, gilipolla, gilipolas
nomames
pinche, pinches
hijodeputa, hijosdeputa, hijodelaputa, hijosdelaputa
hijueputa, hijueputas, hijosdehijueputa
hijodeperra, hijadeperra, hijosdeperra
culero, culera, culeros, culeras
webo, weba, webon, webas, webos
mamahuevo, mamahuevos
mamon, mamona, mamones
maricon, marica, maricones
joto, jotos
zorra, zorras
gonorrea, gonorreas
```

### Inglés (común en gaming/tech)
```
fuck, fucking, fucked, fucker, fuckers
motherfucker, motherfuckers
bitch, bitches
asshole, assholes, ashole, asholes
shit, shits
dumbass, dumbasses, dumbas
cunt, cunts
slut, sluts
whore, whores
retard, retards, retarded
bastard, dick, prick, pussy, wanker, twat, jackass
bollocks, douchebag, dipshit, cocksucker
```

**Total: ~95 entradas** (incluye variantes plurales/femeninas).

---

## 6. Falsos positivos conocidos (y por qué se aceptan)

| Palabra | También significa | Riesgo | Mitigación |
|---|---|---|---|
| `verga` | vara, palo, medida | Medio (México: "echar la verga" = medir) | Límite de palabra evita "averiguar", "convergencia" |
| `polla` | cometa, gallina | Bajo (España) | Contexto escolar raro; límite evita "pollar" (no existe) |
| `carajo` | cabo de barco, "a la mierda" | Bajo | Marítimo muy raro en chat escolar |
| `cabron` | cabrón (animal), "qué cabrón" (admiración) | Medio | Límite evita "cabrona" (sí está), "cabrones" (sí está) |

**`perro` / `perra`:** `perra` **sí** está (insulto). `perro` **no** (animal, "qué perro" = cansado). No se agrega `perros` para no capturar "perros guía", "amo a los perros".

**`cono` / `conos`:** **fuera**. Médico/geométrico ("cono de luz", "cono truncado"). Límite de palabra lo dispararía solo suelto, pero el riesgo de falso positivo en clase de mates es real.

**`zorra`:** dentro. "Zorra" = zorra (animal) es raro; "zorra" = insulto es común. Se asume contexto escolar no zoológico.

---

## 7. Filtrado en lectura (`GET /chat/:equipo_id`)

Desde el commit actual, el endpoint:

```js
router.get('/:equipo_id', verificarToken, async (req, res) => {
  // 1. Verifica membresía (403 si no es del equipo)
  // 2. Trae últimos 100 mensajes
  // 3. Aplica filtrarTexto() a cada uno SOLO para mostrar
  // 4. Devuelve { ..., texto: filtrado.texto, censurado: filtrado.censurado }
});
```

**Paginación:** el endpoint acepta `?antes=<mensaje_id>` para traer 100 mensajes **anteriores** a ese ID (orden cronológico ASC). **El filtro `filtrarTexto` se aplica también a los bloques paginados** — igual que a los últimos 100.

**Implicaciones:**
- Mensajes guardados **antes** del filtro se muestran enmascarados al leerlos.
- La base de datos **no se modifica** — el filtrado es solo en la respuesta JSON.
- Si un admin quiere limpiar la BD de verdad, hace falta un script aparte
  (no incluido).

---

## 8. Registro en `moderacion_logs`

Cuando `filtrado.censurado === true`:

```sql
INSERT INTO moderacion_logs (usuario_id, equipo_id, palabras_bloqueadas, sustituciones)
VALUES ($1, $2, $3, $4);
```

- `palabras_bloqueadas`: lista única separada por comas (`puta, mierda`).
- `sustituciones`: contador total de ocurrencias en el mensaje.
- Usa `SAVEPOINT mod` + `RELEASE` / `ROLLBACK TO mod` → **un fallo en el log
  nunca tira la transacción del mensaje**. El mensaje se guarda aunque el log falle.

Endpoint admin: `GET /admin/moderacion` (requiere rol `admin`) devuelve
últimos 100 con `usuario_nombre`, `equipo_nombre`, `palabras_bloqueadas`,
`sustituciones`, `fecha`.

---

## 9. Qué **no** filtra este sistema

| Área | Estado | Por qué |
|---|---|---|
| Títulos/descripciones de tareas | Sin filtro | Solo `sanitize` (anti-XSS). Decisión: mantener chat aislado. |
| Comentarios de tareas | Sin filtro | Idem. |
| Nombres de equipos | Sin filtro | Idem. |
| Apuntes / Biblioteca | Sin filtro | Contenido académico, falso positivo alto. |
| WebSocket `nuevo-mensaje` | Ya filtrado | El backend emite el texto **ya filtrado**. |

Para extender a tareas/comentarios: importar `filtrarTexto` en `routes/tareas.js`
y aplicar igual que en chat. No se hizo por decisión de alcance.

---

## 10. Pruebas manuales rápidas

```bash
# Enviar mensaje limpio
curl -X POST http://localhost:4000/chat/enviar \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"equipo_id": 1, "texto": "Hola equipo"}'

# Enviar con grosería
curl -X POST ... -d '{"equipo_id": 1, "texto": "Esto es una puta prueba"}'
# Respuesta: { ..., censurado: true, palabras: ["puta"], texto: "Esto es una p*** prueba" }

# Leer historial (filtro en lectura)
curl http://localhost:4000/chat/1 -H "Authorization: Bearer <token>"
# Mensajes viejos sin filtrar salen filtrados en la respuesta
```

---

## 11. Archivos tocados en este cambio

| Archivo | Cambio |
|---|---|
| `edu-verse_backend/middleware/profanity.js` | +40 palabras a `PALABRAS_BLOQUEADAS` |
| `edu-verse_backend/routes/chat.js` | `GET` con auth + membresía + filtro en lectura |
| `edu-verse_backend/_diag2.js` | **Borrado** (script temporal de diagnóstico) |
| `edu-verse/src/pages/GestorEquipos.jsx` | Bugs A–F del chat (ver `FRONTEND.md`) |
| `documentacion/BACKEND.md` | `GET /chat` ahora requiere auth |
| `documentacion/FRONTEND.md` | Bugs del chat + fix de auto-scroll/keys/maxLength |
| `documentacion/CAMBIOS_AUDITORIA.md` | Registro del commit |
| `documentacion/FILTRO_CHAT.md` | **Este archivo** |

---

## 12. Próximos pasos sugeridos

1. **Script de saneamiento de BD** — recorre `mensajes_chat`, aplica `filtrarTexto`,
   actualiza `texto` y registra en `moderacion_logs` los que cambien.
2. **Extender a tareas/comentarios** — si el equipo decide que hace falta.
3. **Longitud fija en máscara** — si la primera letra visible sigue molestando,
   cambiar a `****` (4 asteriscos) para cualquier palabra.
4. **Lista dinámica** — sacar `PALABRAS_BLOQUEADAS` a BD o config para que admins
   agreguen/quiten sin redeploy.

---

> **Nota:** este documento describe el estado **después** del commit que agrega
> las 40 palabras, el filtro en lectura, la auth en GET y la limpieza de
> `_diag2.js`. Los cambios en `GestorEquipos.jsx` (bugs A–F) están documentados
> en `FRONTEND.md`.