# ROADMAP — Lavadero SaaS

> Referencias: `docs/lavadero-spec.md` (qué construimos) y `CLAUDE.md` (cómo trabajamos).
> Cada tarea está pensada para **una sesión de Claude Code**: alcance chico, criterios verificables y sin dependencias ocultas.

---

## Cómo usar este roadmap

1. Tomar **la primera tarea sin marcar** cuyas dependencias estén hechas.
2. Pedirle a Claude Code, con el prompt de la plantilla del final:
   - que lea la tarea
   - que proponga un plan
   - que implemente
   - que corra los tests
3. Validar a mano los criterios de aceptación.
4. Marcar `[x]` y hacer commit (`feat(F2-T03): ...`).
5. Si durante la tarea cambia una decisión, actualizar `docs/lavadero-spec.md` en el mismo commit.

**Definición de terminado (aplica a TODAS las tareas):**
- `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan.
- Todo endpoint nuevo:
  - valida su input con zod
  - tiene test de caso feliz, de validación y de **aislamiento entre lavaderos**
  - respeta los roles
- No quedan `TODO` sin issue ni código comentado.
- Si se tocó el schema de Prisma: la migración está creada y el seed sigue funcionando.

---

## Fase 0 — Fundaciones

### [x] F0-T01 · Monorepo
- **Objetivo:** estructura base del proyecto.
- **Hacer:**
  - pnpm workspaces con `apps/web`, `apps/api`, `packages/db` y `packages/shared`
  - TypeScript estricto y `tsconfig` base compartido
  - ESLint y Prettier
  - scripts raíz `dev`, `build`, `lint`, `typecheck` y `test`
- **Aceptación:** `pnpm install && pnpm typecheck` funciona en limpio.

### [x] F0-T02 · Supabase + Prisma
- **Depende de:** T01
- **Hacer:**
  - Supabase local con la Supabase CLI (`supabase init`, `supabase start`).
  - Prisma en `packages/db`, conectado al Postgres de Supabase. Seguir la **guía oficial actual de Prisma para Supabase**: la configuración de URLs (pooler vs. conexión directa para migraciones) cambió entre versiones.
  - Exportar un cliente Prisma singleton.
  - Crear `.env.example` con todas las variables necesarias.
- **Aceptación:** `pnpm db:migrate` aplica una migración vacía, y `pnpm db:studio` abre.

### [ ] F0-T03 · API base (Express)
- **Depende de:** T01
- **Hacer:**
  - Variables de entorno validadas con zod (la API no arranca si falta alguna).
  - Logger con pino.
  - Middleware de errores con respuesta uniforme `{ error: { code, message } }`.
  - Middleware `validate(schema)`.
  - `GET /health`.
  - Vitest + supertest.
- **Aceptación:** test de `/health` pasa; un body inválido devuelve 400 con el formato uniforme.

### [ ] F0-T04 · Web base (Next.js)
- **Depende de:** T01
- **Hacer:**
  - Next.js App Router, Tailwind y shadcn/ui.
  - Layout con navegación de los módulos (links vacíos).
  - Cliente HTTP tipado hacia la API.
- **Aceptación:** `pnpm dev` levanta web y API; la web muestra el estado de `/health`.

### [ ] F0-T05 · CI
- **Hacer:** GitHub Actions que corra lint, typecheck y test en cada PR.
- **Aceptación:** un PR de prueba muestra el check en verde.

### [ ] F0-T06 · Blindaje de Supabase ⚠️
- **Objetivo:** que nadie pueda leer las tablas usando la anon key.
- **Hacer:**
  - Migración que **habilite RLS en todas las tablas de `public` sin políticas**.
  - Script `pnpm db:check-rls` que falle si alguna tabla de `public` tiene RLS desactivado.
  - Correr el script en CI.
- **Aceptación:** con la anon key, una consulta a la Data API sobre cualquier tabla devuelve vacío o error.
- **Nota:** repetir el chequeo con cada tabla nueva (el script de CI lo garantiza).

---

## Fase 1 — Auth, multi-tenancy y roles

### [ ] F1-T01 · Modelos base
- **Hacer:** en Prisma:
  - `Lavadero`
  - `Usuario`: `id` = UUID de `auth.users`, `lavaderoId`, `rol` enum `DUENO | ENCARGADO | LAVADOR`, `nombre`, `activo`
  - `AuditLog`
- Seed con un lavadero de ejemplo y un dueño.
- **Aceptación:** migración + seed corren; el seed también crea el usuario en Supabase Auth local.

### [ ] F1-T02 · Autenticación en la API
- **Depende de:** F1-T01
- **Hacer:**
  - Middleware `requireAuth` que verifica el JWT de Supabase (usar el método recomendado en la doc actual de Supabase).
  - Cargar `Usuario` y dejar `req.auth = { userId, lavaderoId, rol }`.
  - 401 si no hay token; 403 si el usuario está inactivo o no existe en nuestra tabla.
- **Aceptación:** tests con token válido, sin token, con token inválido y con usuario inactivo.

### [ ] F1-T03 · Aislamiento por lavadero ⚠️ (tarea crítica)
- **Hacer:**
  - Extensión de Prisma `forTenant(lavaderoId)`: inyecta `lavaderoId` en los `where` de lectura, update y delete, y en los `data` de create, para todos los modelos del negocio.
  - Los handlers **solo** usan `req.db` (el cliente scoped); nunca el cliente global.
  - Regla de lint o test que falle si un archivo de `routes/` importa el cliente global.
- **Aceptación:** test con dos lavaderos donde A no puede leer, editar ni borrar datos de B (probar con IDs reales de B).

### [ ] F1-T04 · Roles (RBAC)
- **Hacer:** middleware `requireRole(...roles)` y tabla de permisos en `packages/shared`.
- **Aceptación:** tests de un endpoint de ejemplo con los 3 roles.

### [ ] F1-T05 · Login en la web
- **Hacer:**
  - Pantallas de login, logout y "olvidé mi contraseña" con Supabase Auth.
  - Rutas protegidas.
  - Guardar el token y enviarlo a la API.
  - Redirigir según el rol.
- **Aceptación:** login con el usuario del seed y navegación protegida funcionando.

### [ ] F1-T06 · Invitar empleados
- **Hacer:**
  - `POST /usuarios/invitar` (solo DUENO): usa la Admin API de Supabase para invitar por email y crea el `Usuario`.
  - Pantalla de aceptación de la invitación (definir contraseña).
  - Listar, activar y desactivar usuarios.
- **Aceptación:** el flujo completo funciona con el mail de Supabase local (Inbucket/Mailpit).

### [ ] F1-T07 · Helper de auditoría
- **Hacer:** `audit(req, accion, entidad, entidadId, antes, despues)`.
- **Aceptación:** test que verifica que queda el registro.

---

## Fase 2 — Configuración del negocio

### [ ] F2-T01 · Tipos de vehículo
- **Hacer:** CRUD (solo DUENO), con seed por defecto: Auto, SUV, Camioneta, Moto, Utilitario. Borrado lógico.
- **Aceptación:** tests + pantalla.

### [ ] F2-T02 · Servicios
- **Hacer:** CRUD de `Servicio` (nombre, descripción, duración estimada, activo). Borrado lógico.
- **Aceptación:** un servicio desactivado no aparece al cargar una orden, pero sí en el historial.

### [ ] F2-T03 · Matriz de precios
- **Hacer:** `PrecioServicio` (servicio × tipo de vehículo, `precioCentavos` entero) y pantalla tipo grilla editable.
- Todo cambio de precio pasa por `audit`.
- **Aceptación:** editar un precio queda auditado; los montos siempre son enteros.

### [ ] F2-T04 · Perfil del lavadero
- **Hacer:**
  - Datos del lavadero (nombre, dirección, teléfono, horarios, zona horaria).
  - Logo en Supabase Storage (bucket privado + URL firmada), con subida pasando por la API.
- **Aceptación:** subir el logo y verlo en el layout.

---

## Fase 3 — Operación diaria (= MVP) 🎯

### [ ] F3-T01 · Jornada
- **Hacer:**
  - Modelo `Jornada`.
  - `POST /jornadas/abrir`: caja inicial opcional y empleados presentes. Solo una jornada abierta por lavadero.
  - `GET /jornadas/actual`.
- **Aceptación:** no se puede abrir una segunda jornada; no se puede crear una orden sin jornada abierta.

### [ ] F3-T02 · Clientes y vehículos
- **Hacer:**
  - Modelos `Cliente` y `Vehiculo`.
  - **Normalizar la matrícula:** mayúsculas, sin espacios ni guiones.
  - **Normalizar el teléfono:** formato E.164, `+598` por defecto.
  - Matrícula única por lavadero.
  - `GET /vehiculos/buscar?matricula=` devuelve el vehículo + cliente + puntos (puntos en 0 por ahora).
- **Aceptación:** "abc 1234" y "ABC-1234" encuentran el mismo vehículo.

### [ ] F3-T03 · Crear orden (botón Agregar)
- **Hacer:**
  - Modelos `Orden` y `OrdenItem`, con `precioCentavos` **congelado** en cada item.
  - Si la matrícula no existe, crear vehículo y cliente en la misma transacción.
  - El precio editado distinto al de lista se audita.
  - Formulario web con autocompletado por matrícula.
- **Aceptación:** cambiar después el precio de lista no altera las órdenes existentes.

### [ ] F3-T04 · Estados de la orden
- **Hacer:**
  - Máquina de estados `EN_ESPERA → LAVANDO → LISTO → ENTREGADO`, más `CANCELADA` (solo DUENO/ENCARGADO, con motivo).
  - Timestamp por cada estado.
  - Asignar lavadores.
  - Rechazar transiciones inválidas.
- **Aceptación:** tests de todas las transiciones válidas e inválidas.

### [ ] F3-T05 · Dashboard kanban
- **Hacer:**
  - Columnas por estado.
  - Tarjetas con matrícula, modelo, servicios, lavador, tiempo transcurrido y precio.
  - Mover una orden con botones (no hace falta drag & drop).
  - Pensado para tablet.
- **Aceptación:** usable en una pantalla de 768 px.

### [ ] F3-T06 · Tiempo real
- **Hacer:**
  - Socket.io en la API, autenticado con el mismo JWT.
  - Una room por `lavaderoId`.
  - Evento `orden:actualizada` en cada cambio.
- **Aceptación:** dos navegadores ven el cambio sin recargar; un usuario de otro lavadero no recibe el evento (test).

### [ ] F3-T07 · Aviso por WhatsApp (link)
- **Hacer:**
  - Al pasar a LISTO, mostrar un botón que abre `https://wa.me/<tel>?text=<mensaje>` con una plantilla configurable.
  - Registrar `avisadoAt`.
- **Aceptación:** el link abre WhatsApp con el mensaje correcto (acentos incluidos).

### [ ] F3-T08 · Cobro
- **Hacer:**
  - Modelo `Pago` con medio `EFECTIVO | DEBITO | CREDITO | TRANSFERENCIA | MERCADOPAGO`.
  - Registrar el pago al entregar, con opción de "pagado por adelantado".
  - Permitir pago dividido en varios medios.
- **Aceptación:** una orden no pasa a ENTREGADO si no está paga, salvo que la marque un DUENO.

### [ ] F3-T09 · Cierre de jornada
- **Hacer:**
  - Resumen del día: cantidad de autos, totales por medio de pago, órdenes sin cobrar.
  - Caja contada vs. esperada.
  - Una jornada cerrada queda bloqueada; solo DUENO puede reabrirla, y queda auditado.
- **Aceptación:** los totales coinciden con la suma de pagos (test con datos de seed).

### [ ] F3-T10 · Pulido del MVP + deploy
- **Hacer:**
  - Deploy a staging: Supabase cloud + API (Railway/Render/Fly) + web (Vercel).
  - Estados vacíos, loaders y errores legibles.
- **Aceptación:** el flujo completo de un día funciona en staging.

> 🚩 **Hito: piloto en un lavadero real.** Usarlo 2–4 semanas antes de seguir, y ajustar el spec con lo aprendido.

---

## Fase 4 — Gestión

> Las tareas de acá en adelante son más grandes. **Antes de arrancar cada una, pedirle a Claude Code que la divida en subtareas del tamaño de la Fase 3** y agregarlas a este archivo.

- [ ] **F4-T01 · Comisiones:** esquema por empleado (% o fijo). Se calcula al ENTREGAR (división en partes iguales si hay varios lavadores) y se guarda en `Comision`.
- [ ] **F4-T02 · Pagos a empleados:** adelantos y liquidaciones, con reporte por período.
- [ ] **F4-T03 · Gastos:** CRUD por categoría y comprobante en Storage. Se incluyen en el cierre de jornada.
- [ ] **F4-T04 · Estadísticas:** facturación por período, horas pico, servicios más vendidos, ticket promedio, tiempo promedio de lavado, ganancia neta, export CSV.
- [ ] **F4-T05 · Puntos:** regla configurable ("cada N, 1 gratis"), contador por cliente, canje (orden a precio 0 registrada como `CanjePuntos`).

## Fase 5 — WhatsApp automático y fidelización

- [ ] **F5-T01 · Cola de trabajos:** pg-boss (sobre el mismo Postgres) con reintentos.
- [ ] **F5-T02 · Integración con WhatsApp Cloud API:**
  - envío de plantillas
  - webhook de estados (enviado, entregado, leído, fallido) con verificación de firma
  - costo estimado por mensaje
- [ ] **F5-T03 · Onboarding del número de cada lavadero** (Embedded Signup de Meta). Los tokens se guardan cifrados.
- [ ] **F5-T04 · Mensajes automáticos de utilidad:** "listo", "te falta 1 para el gratis" y vencimiento de membresía. El plan básico sigue usando `wa.me`.
- [ ] **F5-T05 · Membresías:** planes, asignación, descuento de saldo al crear la orden y vencimientos.
- [ ] **F5-T06 · Campañas:**
  - segmentación
  - **costo estimado antes de enviar**
  - solo a clientes con consentimiento
  - baja con "BAJA"
  - historial

## Fase 6 — SaaS completo

- [ ] **F6-T01 · Panel de superadmin:** lavaderos, uso, soporte.
- [ ] **F6-T02 · Planes y suscripciones:** evaluar suscripciones de Mercado Pago. Bloqueo suave por falta de pago.
- [ ] **F6-T03 · Registro self-service** de nuevos lavaderos.
- [ ] **F6-T04 · PWA instalable.**
- [ ] **F6-T05 · Extras:** fotos de ingreso, stock de insumos, multi-sucursal.

---

## Plantilla de prompt para Claude Code

```
Leé CLAUDE.md, docs/lavadero-spec.md y la tarea <ID> de docs/ROADMAP.md.
1. Antes de escribir código, proponé un plan: archivos a crear/modificar,
   cambios de schema y tests. Esperá mi OK.
2. Implementá solo lo que pide la tarea (nada de fases futuras).
3. Corré lint, typecheck y test; arreglá lo que falle.
4. Mostrame cómo verificar a mano los criterios de aceptación.
5. Marcá la tarea como [x] en ROADMAP.md y proponé el mensaje de commit.
```
