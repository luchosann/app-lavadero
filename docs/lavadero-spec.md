# Lavadero SaaS — Documento de especificación

> Documento vivo. Acá registramos qué estamos construyendo, por qué y en qué orden.
> Última actualización: 24/09/2026

---

## 1. Visión

Aplicación SaaS para que lavaderos de autos gestionen su operación diaria:
- registrar los vehículos que ingresan
- avisar al cliente por WhatsApp
- controlar la caja, a los empleados y los gastos
- fidelizar clientes

Cada lavadero es un **tenant** independiente dentro de la misma plataforma.

**Alcance del cliente final en esta etapa:** el cliente del lavadero **no usa la app**. Solo recibe mensajes de WhatsApp.

---

## 2. Usuarios y roles

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| **Superadmin** | Nosotros (dueños del SaaS) | Crear lavaderos, gestionar planes y suscripciones, dar soporte, ver métricas globales |
| **Dueño** | Dueño del lavadero | Todo lo del encargado, más: precios, empleados, comisiones, gastos, estadísticas completas, promociones, configuración del lavadero |
| **Encargado** | Quien opera el día a día | Abrir/cerrar el día, registrar servicios, cambiar estados, cobrar, avisar a clientes |
| **Lavador** *(opcional, fase 2)* | Empleado que lava | Ver la cola y marcar sus autos como terminados. Sin acceso a dinero ni a datos de clientes |

> **Decisión abierta:** ¿dueño y encargado pueden ser la misma persona? Sí: un usuario puede tener rol Dueño y operar también. El rol Encargado existe para cuando el dueño delega.

Los permisos se definen por rol (RBAC) y siempre dentro del lavadero (tenant) del usuario.

---

## 3. Autenticación

Usamos **Supabase Auth**.

- Login con email + contraseña, gestionado por Supabase Auth.
- Recuperación de contraseña por email (Supabase).
- El dueño invita a empleados; la invitación se envía desde el backend con la Admin API de Supabase.
- El backend verifica el JWT de Supabase en cada request. Después carga el `Usuario` propio (lavadero + rol) desde nuestra base de datos.
- **Sesión por dispositivo:** la tablet del lavadero puede quedar logueada. El encargado se identifica al abrir el día (ver 4.0).
- Log de auditoría para acciones sensibles: cambios de precio, anulaciones, cambios de comisiones.

## 4. Módulos

### 4.0 Apertura y cierre del día *(agregado)*

Flujo: el encargado se loguea al inicio del día y queda registrado quién abrió el día.

- **Apertura:** registrar quién abre el día, con monto inicial en caja opcional. Marcar qué empleados trabajan hoy, para asignar servicios y calcular comisiones.
- **Cierre:** resumen del día con:
  - cantidad de autos
  - total por medio de pago
  - comisiones del día
  - gastos del día
  - diferencia de caja (lo esperado contra lo contado)
- Un día cerrado queda bloqueado. Solo el dueño puede reabrirlo, y queda registrado en la auditoría.

### 4.1 Dashboard del día (pantalla principal)

Vista tipo kanban con los vehículos del día, agrupados por estado:

```
En espera → Lavando → Listo → Entregado
```

- Cada tarjeta muestra: matrícula, modelo, servicio, lavador asignado, tiempo transcurrido y precio.
- Se actualiza en tiempo real (WebSocket/SSE), para que varios dispositivos vean lo mismo.
- Al pasar un auto a **Listo** → se envía (o se ofrece enviar) el WhatsApp "tu auto está listo".
- Al pasar a **Entregado** → se registra el cobro (medio de pago).
- Acceso rápido a los botones del menú: Agregar, Configuración, Perfil, Empleados, Puntos, Promociones, Membresías, Gastos.

### 4.2 Agregar servicio (botón 1)

Formulario para registrar un auto que ingresa.

**Flujo:**
1. Se ingresa la **matrícula**.
2. Si el vehículo ya existe, se autocompletan marca, modelo, tipo y cliente, y se muestran los puntos y la membresía del cliente.
3. Si no existe, se cargan los datos del vehículo y del cliente.
4. Se eligen uno o más servicios. El precio se calcula según el tipo de vehículo y es editable, por ejemplo para aplicar un descuento.
5. Se asigna un lavador (opcional).
6. Se guarda → aparece en el dashboard como **En espera**.

**Datos:**
- **Vehículo:** matrícula, marca, modelo, tipo (auto / SUV / camioneta / moto / utilitario), color *(agregado, ayuda a identificarlo en el patio)*.
- **Cliente:** nombre, teléfono (WhatsApp), consentimiento para recibir promociones *(agregado, ver 6)*.
- **Servicio:** servicios elegidos, precio final, lavador, observaciones.
- *(Fase 2)* Fotos del estado del vehículo al ingresar, para registrar daños previos.

Todo queda guardado para usarlo en estadísticas, puntos e historial.

### 4.3 Configuración del negocio (botón 2)

- **Servicios:** crear, editar y desactivar (lavado exterior, completo, encerado, tapizado, motor, etc.).
- **Precios por tipo de vehículo:** matriz servicio × tipo de vehículo.
- **Tipos de vehículo** personalizables.
- **Medios de pago** habilitados.
- **Plantillas de mensajes de WhatsApp.**
- Reglas de puntos y membresías (ver 4.6 y 4.8).

> Los servicios **no se borran, se desactivan**. Así las estadísticas históricas siguen siendo correctas. El precio se guarda "congelado" en cada servicio realizado.

### 4.4 Perfil del lavadero (botón 3)

- Nombre, logo, dirección, teléfono, horarios.
- Número de WhatsApp conectado y su estado de conexión.
- Datos fiscales (RUT) para facturación, fase 2.
- Plan de suscripción SaaS actual y su estado de pago.

### 4.5 Empleados y comisiones (botón 4)

- Alta, baja y edición de empleados, con su rol.
- **Esquema de comisión por empleado:**
  - % sobre el precio del servicio, o
  - monto fijo por auto, o
  - sueldo fijo + % (fase 2).
- **Reporte por período:** autos lavados, facturación generada y comisión a pagar.
- Registro de pagos a empleados (adelantos, liquidaciones).

> **Decisión abierta:** si dos lavadores trabajan en el mismo auto, ¿cómo se reparte la comisión? Propuesta: permitir asignar varios lavadores y dividir en partes iguales.

### 4.6 Sistema de puntos (botón 5)

- **Regla configurable:** "cada N lavados, 1 gratis" (por defecto N = 10).
- El contador es por **cliente** (teléfono). *Decisión abierta: ¿por cliente o por vehículo? Propuesta: por cliente.*
- Al registrar un servicio se ve el progreso ("6/10").
- Cuando el cliente llega a N, el sistema avisa que el próximo lavado es gratis. Se canjea con un clic y el precio queda en 0, registrado como canje.
- WhatsApp automático opcional: "¡Te falta 1 lavado para el gratis!".
- *(Fase 2)* Puntos por monto gastado en vez de por cantidad de lavados, y vencimiento de puntos.

### 4.7 Promociones por WhatsApp (botón 6)

- Crear una campaña a partir de una plantilla aprobada por Meta.
- **Segmentación:**
  - todos los clientes
  - clientes inactivos hace X días
  - clientes con membresía
  - por tipo de vehículo
- **Estimación de costo antes de enviar:** cantidad de destinatarios × tarifa de marketing.
- Solo se envía a clientes con consentimiento para promociones.
- Historial de campañas: enviados, entregados y leídos.

> Los mensajes de marketing cuestan unas 6–7 veces más que los de utilidad. Ver sección 6.

### 4.8 Membresías (botón 7) *(detalle propuesto)*

- El dueño define planes, por ejemplo: "Plan mensual: 4 lavados exteriores por USD X" o "lavados ilimitados".
- Se asigna un plan a un cliente o vehículo, con fecha de inicio y vencimiento.
- Al registrar un servicio, si el vehículo tiene membresía activa, se descuenta del saldo y no se cobra.
- Aviso por WhatsApp antes del vencimiento.
- Reporte de membresías activas, vencidas e ingreso recurrente.

### 4.9 Gastos e insumos (botón 8)

- Registro de gastos: fecha, categoría, monto, descripción y comprobante opcional (foto).
- **Categorías:** insumos (jabón, cera, microfibras), servicios (agua, luz), alquiler, mantenimiento, otros.
- *(Fase 2)* Stock de insumos con alerta de mínimo.
- Los gastos alimentan el reporte de **ganancia neta**.

### 4.10 Estadísticas *(agregado)*

- Facturación por día, semana y mes.
- Autos por día y horas pico.
- Servicios más vendidos y ticket promedio.
- Tiempo promedio de lavado (a partir de los timestamps de cada estado).
- Clientes nuevos contra recurrentes.
- Ingresos − gastos − comisiones = **ganancia neta**.
- Exportar a CSV/Excel.

---

## 5. Comunicación con el cliente (WhatsApp)

El cliente **solo recibe mensajes** en esta etapa.

| Mensaje | Categoría Meta | Cuándo |
|---|---|---|
| "Tu auto está listo" | Utilidad | Al pasar a Listo |
| "Te falta 1 lavado para el gratis" | Utilidad* | Al registrar un servicio |
| "Tu membresía vence en 3 días" | Utilidad | Automático |
| Promociones / "hace 30 días que no venís" | Marketing | Campaña manual |

\* Meta clasifica cada plantilla al aprobarla. Puede que la considere marketing.

**Dos modos:**
- **Plan básico:** botón que abre `wa.me/<teléfono>?text=...` con el mensaje armado. El encargado lo envía a mano desde el WhatsApp del lavadero. Costo cero.
- **Plan pro:** envío automático con la WhatsApp Cloud API, usando el número propio de cada lavadero (onboarding con Embedded Signup).

---

## 6. Costos y consideraciones de WhatsApp

- Meta cobra por mensaje de plantilla entregado, según la categoría y el país del destinatario.
- Referencia aproximada para Uruguay (Resto de LatAm): utilidad ≈ USD 0,01 por mensaje; marketing ≈ USD 0,07–0,085 por mensaje. **Verificar la tarifa oficial vigente.**
- Hay un posible cambio desde oct/2026: las respuestas dentro de la ventana de 24 h pasarían a cobrarse después de 1.000 gratis por mes. **Verificar.**
- **Modelo de cobro propuesto:** cada plan incluye N mensajes de utilidad. Los excedentes y los mensajes de marketing se cobran aparte o se descuentan de un saldo prepago.
- Guardar el **consentimiento** del cliente para marketing y permitir la baja ("responder BAJA").

---

## 7. Arquitectura técnica

Ver detalle en `ROADMAP.md` y `CLAUDE.md`.

- **Monorepo** con pnpm workspaces: `apps/web` (Next.js), `apps/api` (Express), `packages/db` (Prisma) y `packages/shared` (schemas zod y tipos).
- **Supabase:**
  - Postgres
  - Auth
  - Storage (logos, comprobantes, fotos)
- **Prisma:** ORM y migraciones sobre el Postgres de Supabase.
- **Acceso a datos:** todo pasa por la API Express. El frontend usa Supabase **solo para Auth**.
- **Multi-tenancy:** `lavaderoId` en todas las tablas del negocio, filtrado por una extensión de Prisma.
- **RLS activado sin políticas** en todas las tablas de `public`, para que la Data API de Supabase no las exponga.
- **Tiempo real:** Socket.io en la API, con una room por lavadero.
- **Colas (fase 5):** pg-boss, que usa el mismo Postgres, así no hace falta Redis.
- **Montos y horarios:** montos en centavos (enteros); zona horaria por lavadero (America/Montevideo por defecto).

## 8. Modelo de datos (borrador)

```
Lavadero (tenant)
 ├─ Usuario (rol: DUENO | ENCARGADO | LAVADOR)
 ├─ TipoVehiculo
 ├─ Servicio ── PrecioServicio (servicio × tipoVehiculo, precio)
 ├─ Cliente (nombre, telefono, aceptaPromos, puntos)
 │    └─ Vehiculo (matricula, marca, modelo, tipo, color)
 ├─ Jornada (fecha, abiertaPor, cerradaPor, cajaInicial, cajaContada)
 │    └─ Orden (vehiculo, cliente, estado, lavadores, timestamps por estado, obs)
 │         ├─ OrdenItem (servicio, precioCongelado)
 │         ├─ Pago (monto, medio)
 │         └─ FotoIngreso (fase 2)
 ├─ Comision (empleado, orden, monto)
 ├─ PagoEmpleado
 ├─ PlanMembresia ── Membresia (cliente/vehiculo, desde, hasta, saldo)
 ├─ CanjePuntos
 ├─ Gasto (categoria, monto, fecha, comprobante)
 ├─ PlantillaMensaje
 ├─ Campana ── MensajeEnviado (estado Meta, costo)
 └─ AuditLog

Superadmin
 └─ PlanSaaS ── Suscripcion (lavadero, estado, vencimiento)
```

> La matrícula es única **por lavadero**, no global.

---

## 9. Roadmap

Ver `ROADMAP.md`.

---

## 10. Decisiones (valores por defecto)

Estas decisiones se pueden cambiar. Si cambian, se actualiza este documento.

- **Puntos:** se cuentan por **cliente** (teléfono).
- **Comisión con varios lavadores:** se divide **en partes iguales**.
- **Precio al cargar un servicio:** el encargado puede editarlo. Todo precio distinto al de lista queda en `AuditLog`.
- **Cuándo se cobra:** al **entregar**. Se permite marcar "pagado por adelantado".
- **Backend:** Express.
- **Pendiente:** precio del SaaS y qué incluye cada plan.
