# CLAUDE.md

SaaS multi-tenant para lavaderos de autos. Cada lavadero es un tenant.

- **Qué construimos:** `docs/lavadero-spec.md`
- **Qué sigue:** `docs/ROADMAP.md`

## Stack
- **Monorepo:** pnpm workspaces.
  - `apps/web`: Next.js (App Router) + Tailwind + shadcn/ui
  - `apps/api`: Express + TypeScript
  - `packages/db`: Prisma (schema, migraciones, seed, cliente)
  - `packages/shared`: schemas zod, tipos, enums y permisos compartidos entre web y api
- **Supabase:** Postgres, Auth y Storage. Local con la Supabase CLI.
- **Tests:** Vitest + supertest.

## Comandos
```
pnpm dev              # web + api
pnpm test             # todos los tests
pnpm lint / typecheck
pnpm db:migrate       # prisma migrate dev
pnpm db:seed
pnpm db:check-rls     # falla si alguna tabla de public no tiene RLS
supabase start/stop   # Supabase local
```

## Reglas NO negociables

1. **Aislamiento por lavadero:**
   - Todo modelo del negocio tiene `lavaderoId`.
   - En los handlers se usa **solo `req.db`** (el cliente Prisma scoped por tenant). Nunca se importa el cliente global en `routes/`.
   - Todo endpoint nuevo lleva un test que pruebe que un lavadero no accede a datos de otro.
2. **El frontend no accede a datos por Supabase.**
   - La web usa Supabase **solo para Auth**; todos los datos pasan por la API.
   - Todas las tablas de `public` tienen RLS activado sin políticas.
3. **Dinero:**
   - Siempre en **centavos, como `Int`**. Nunca float.
   - Los precios se **congelan** en `OrdenItem`.
4. **Nada se borra físicamente** si tiene historial: se usa `activo: false`.
5. **Validación:**
   - Todo input de la API se valida con un schema zod de `packages/shared`.
   - Los errores se devuelven como `{ error: { code, message } }`.
6. **Acciones sensibles** pasan por `audit()`: precios, anulaciones, comisiones, reapertura de jornada.
7. **Fechas:** se guardan en UTC y se muestran en la zona horaria del lavadero (`America/Montevideo` por defecto).
8. **Normalización:**
   - Matrícula: mayúsculas, sin espacios ni guiones.
   - Teléfono: formato E.164 (`+598` por defecto).

## Convenciones
- **Idioma:** el dominio va en español, tal como en el spec (modelos `Lavadero`, `Orden`, `Jornada`; rutas `/ordenes`; funciones `crearOrden`). La infraestructura técnica va en inglés (`validate`, `requireAuth`, `logger`). Los mensajes al usuario van en español rioplatense.
- **Estructura de la API por módulo:** `apps/api/src/modules/<modulo>/{routes,service,schemas}.ts`, con tests al lado.
- **Commits:** Conventional Commits con el ID de la tarea, por ejemplo `feat(F3-T03): crear orden`.
- **Documentación:** ante dudas de Prisma o Supabase, seguir la documentación oficial actual. La configuración de conexión y la verificación de JWT cambiaron entre versiones.

## Cómo trabajar
- Una tarea del roadmap por sesión. Primero se propone un plan y se espera el OK.
- No implementar nada de fases futuras "por si acaso".
- Si una decisión del spec no alcanza para implementar algo, preguntar; no inventar.
