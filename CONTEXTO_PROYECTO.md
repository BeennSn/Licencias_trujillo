# Contexto Completo del Proyecto

> **Nota importante:** este NO es un sistema de licencias de conducir. Es un sistema de **Licencias de Funcionamiento municipales** (permiso para operar un negocio) para la **Municipalidad Provincial de Trujillo (MPT)**, Perú. Términos como "pago mixto", "comprobante", "QR Yape/Plin", "cajero" e "inspector" pertenecen a este trámite municipal, no a un carné de conducir.

## 1. Qué es el proyecto

MVP del sistema de otorgamiento y renovación de **Licencias de Funcionamiento** municipal, amparado en la Ley N° 28976 y ordenanzas propias de la MPT (ver [`docs/marco-legal.md`](docs/marco-legal.md) para el detalle legal/reglas de negocio, y [`README.md`](README.md) para la guía técnica de arranque).

Permite que un **negocio** solicite, pague, sea inspeccionado y obtenga (o renueve) su licencia para funcionar, todo gestionado a través de un flujo web (wizard) + paneles privados por rol, con soporte para pago presencial en caja (efectivo / Yape / mixto) además del pago web con Mercado Pago.

## 2. Stack tecnológico

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS 4**.
- **Base de datos**: Neon Postgres + **Drizzle ORM** — la fuente de verdad del modelo es [`lib/db/schema.ts`](lib/db/schema.ts). Sin migraciones formales: `npm run db:push` sincroniza el esquema directamente.
- **Autenticación**: Auth.js / NextAuth v5 (beta), credenciales (correo + contraseña, hash con bcryptjs), sesión JWT. Protección de rutas por rol en `proxy.ts` (equivalente a `middleware.ts` en Next 16) + `lib/auth.config.ts` (`authorized()`).
- **Pagos**: Mercado Pago (Perú) — Checkout Pro (redirect) para pago web; API de token directo para flujos legacy/renovación/simulado. Si no hay credenciales configuradas (`MERCADOPAGO_ACCESS_TOKEN`), el pago se **simula automáticamente** como aprobado (modo desarrollo/demo). El pago presencial (en caja) no pasa por la pasarela.
- **Archivos**: Vercel Blob — documentos subidos (plano de ubicación), PDFs de licencia y de comprobante de pago.
- **Correo**: Nodemailer/SMTP (`lib/email.ts`); sin credenciales SMTP, los correos se imprimen en consola en vez de enviarse.
- **PDFs**: `@react-pdf/renderer` — PDF de licencia con código QR (`lib/pdfLicencia.tsx`) y PDF de comprobante (`lib/pdfComprobante.tsx`).
- **Validación de RUC/SUNAT**: API pública tipo SUNAT (Decolecta, `lib/sunat.ts`) con fallback manual si falla; autocompletado de representante legal vía `consultasPeru.com`/`apiperu.dev` (`lib/consultasPeru.ts`).
- **Validación de formularios**: Zod (`lib/validaciones.ts`).
- **Tests**: Vitest — lógica de días hábiles peruanos, máquinas de estado, dominios de correo, validación de RUC (`lib/*.test.ts`).
- **Cron**: Vercel Cron, una vez al día (`app/api/cron/route.ts`, protegido con `CRON_SECRET`).

## 3. Estructura de carpetas

- `app/` — rutas de la aplicación:
  - Páginas públicas: `/`, `/login`, `/consulta` (consulta pública por RUC), `/solicitud/...` (wizard de solicitud), recuperación de contraseña.
  - Paneles privados por rol: `/negocio`, `/inspector`, `/admin`, `/cajero`.
  - `app/api/*` — route handlers (pagos, inspecciones, admin, cron, etc.).
- `components/` — `ui/` (Badge, Button, Card, Input, Select), `cajero/CamposCobroPresencial.tsx`, `inspector/` (AutoRefresh, FormularioDecision), `wizard/StepIndicator.tsx`, `providers/SessionProvider.tsx`, `AreaPrivadaNav.tsx`.
- `lib/` — toda la lógica de negocio: máquinas de estado, constantes, integraciones externas, `lib/db/{schema.ts, client.ts}`.
- `db/` — `seed.ts` (crea usuarios admin/inspector de prueba) y `reset.ts`.
- `docs/marco-legal.md` — marco legal y reglas de negocio.
- `types/next-auth.d.ts` — extensión de tipos de sesión (role, negocioId).
- `proxy.ts` — protección de rutas por rol (reemplazo de `middleware.ts` en Next 16).

## 4. Roles de usuario

Enum `rolUsuario`: **negocio**, **inspector**, **admin**, **cajero**. Se aplica en `proxy.ts` + `lib/auth.config.ts` (un rol por prefijo de ruta).

| Rol | Descripción | Rutas clave |
|---|---|---|
| **Público (sin cuenta)** | Cualquiera puede iniciar una solicitud o consultar una licencia por RUC, sin login. | `/solicitud/nuevo`, `/consulta` |
| **Negocio** | El titular del negocio. Ya no se crea cuenta al solicitar (se eliminó ese paso); se usa para renovación/login legacy vía `negocioId`. | `app/negocio/*` (renovar, reportar cambio de infraestructura) |
| **Inspector** | Revisa expedientes asignados, ve su cupo diario y registra decisión (conforme/observada). Regla actual: solo un inspector activo a la vez. | `app/inspector`, `app/inspector/expediente/[id]` |
| **Admin** | Supervisión total: expedientes, inspecciones, gestión de inspectores/cajeros, historial de pagos, aprobación de cierre de caja. | `app/admin/*` |
| **Cajero** | Rol más nuevo. Abre/cierra caja (mínimo S/500 de apertura), cobra pagos presenciales (efectivo/Yape/mixto), gestiona renovaciones presenciales y reemplazo de documentos observados. | `app/cajero/*` |

## 5. Flujo completo del trámite (viaje del usuario)

1. **Inicio de solicitud** (`app/solicitud/nuevo`) — se ingresa el RUC; validación local (checksum/formato) y luego contra API tipo SUNAT (activo/habido y presencia en la provincia de Trujillo).
2. **Domicilio** (`.../domicilio`) — se elige distrito/dirección del negocio (solo los 11 distritos de la provincia de Trujillo, `lib/distritosTrujillo.ts`), con autocompletado desde direcciones registradas en SUNAT.
3. **Documentos** (`.../documentos`) — se sube el plano de ubicación (único documento requerido; PDF/JPEG/PNG, máx. 10MB) a Vercel Blob.
4. **Pago** (`.../pago` o `.../pago-presencial`) — derecho de trámite de S/180, vía Mercado Pago (web) o efectivo/Yape/mixto en caja (presencial).
5. Al aprobarse el pago, el sistema **auto-programa la primera inspección técnica** en el día hábil más próximo con cupo disponible (`lib/agenda.ts`, máx. 4 inspecciones/día repartidas entre inspectores activos).
6. El **inspector** visita el local y registra su decisión:
   - **Conforme** → se genera y emite la licencia (PDF) de inmediato.
   - **Observada (1ª vez)** → se auto-programa una **segunda inspección exactamente 30 días hábiles peruanos después** (plazo legal fijo, sin importar cupo diario).
   - **Observada (2ª vez)** → el expediente queda **RECHAZADO** definitivamente; para reintentar hay que iniciar una solicitud nueva y pagar de nuevo.
7. **Confirmación** (`.../confirmacion`) — pantalla final; no se crea cuenta.
8. **Consulta pública** (`app/consulta`) — cualquiera puede verificar el estado/licencia de un negocio por RUC, mostrando solo datos no sensibles.
9. **Renovación** — solo mediante pago (sin nueva inspección), desde el panel del negocio (`app/negocio/renovar`, web) o desde caja (`app/cajero/renovar`, presencial).
10. **Reporte de cambio de infraestructura** (`app/negocio/reportar-cambio`) — el negocio debe reportar cambios en el local; revisado por admin/inspector, puede derivar en licencia **CLAUSURADA**.
11. **Cron diario** (`app/api/cron`) — marca licencias vencidas (VENCIDA) y notifica por correo, envía recordatorios de renovación (30 días antes) y recordatorios de inspección el mismo día (a negocio e inspector).

## 6. Modelo de datos (`lib/db/schema.ts`)

**Enums**: `rolUsuario`, `tipoExpediente` (nueva/renovacion), `estadoExpediente`, `estadoPago`, `medioPago` (tarjeta/yape/pagoefectivo/efectivo), `canalPago` (web/presencial), `tipoInspeccion` (primera/segunda), `estadoInspeccion`, `estadoLicencia`, `estadoCaja`.

**Tablas**:
- **usuarios**: id, email, passwordHash, rol, negocioId (FK opcional), nombre, telefono, activo, createdAt.
- **negocios**: id, ruc (único), razonSocial, estadoSunat, condicionHabido, direccionesTrujillo (jsonb, caché de direcciones SUNAT), createdAt.
- **expedientes** (el "caso"/solicitud): id, numeroExpediente (ej. EXP-2026-000123), negocioId FK, tipo, estado (máquina de estados), distrito, direccionLocal, giroActividad, emailContacto, telefonoContacto, nombreComercial, representanteLegalNombre/Dni, licenciaAnteriorId, timestamps.
- **documentos**: id, expedienteId FK, urlArchivo (una fila por expediente; un nuevo upload reemplaza al anterior), createdAt.
- **pagos**: id, expedienteId FK, monto, medioPago, estado (pendiente/aprobado/rechazado), referenciaPago, canal (web/presencial), registradoPorId (FK a cajero, solo si es presencial), createdAt. Un pago mixto genera varias filas.
- **inspecciones**: id, expedienteId FK, tipo (primera/segunda), fechaProgramada, turno (1-4, cupo diario), inspectorId FK, estado (programada/conforme/observada), observaciones, requiereCambioDocumento (bool), fechaRealizada, recordatorioDiaEnviado, createdAt.
- **licencias**: id, expedienteId FK, negocioId FK, numeroLicencia (único), fechaEmision, fechaVencimiento (+1 año), pdfUrl, estado (VIGENTE/VENCIDA/RENOVADA/CLAUSURADA), recordatorioRenovacionEnviado, createdAt.
- **reportesInfraestructura**: id, expedienteId FK, descripcion, fechaReporte, revisado.
- **cajas** (sesión de caja del cajero): id, cajeroId FK, estado (abierta/cierre_solicitado/cerrada), montoApertura, abiertaEn, cierreSolicitadoEn, cierreAprobadoPorId FK, cerradaEn. Los totales se calculan al vuelo, no se guardan.
- **comprobantesPago** (comprobante interno, no fiscal): id, numeroComprobante (único), expedienteId FK, negocioId FK, monto, pdfUrl, createdAt — una fila por venta aunque el pago haya sido mixto.
- **passwordResetTokens**: id, usuarioId FK, token (único), expiraEn, usado, createdAt.

## 7. Funcionalidades clave

- **Máquina de estados del expediente** (`lib/estadosExpediente.ts`): `BORRADOR → DOCUMENTOS_COMPLETOS → PAGO_PENDIENTE → PAGO_APROBADO → PRIMERA_INSPECCION_PROGRAMADA → (APROBADA | SEGUNDA_INSPECCION_PROGRAMADA) → (APROBADA | RECHAZADA)`. Todas las transiciones pasan por `puedeTransicionar()`.
- **Máquina de estados de la licencia**: `VIGENTE → (VENCIDA | RENOVADA | CLAUSURADA)`. `estaPorVencer`/`estaVencida` se calculan a partir de fechas (no se guardan).
- **Máquina de estados de caja**: `abierta → cierre_solicitado → (cerrada | abierta)` (si el admin rechaza el cierre). El admin debe aprobar el cierre (`app/api/admin/caja/[id]/aprobar|rechazar`).
- **Pago mixto**: `lib/hooks/useCobroPresencial.ts` + `components/cajero/CamposCobroPresencial.tsx` autocompletan el monto complementario (efectivo vs Yape) para que la suma sea exacta, validan que el "vuelto" en efectivo no sea irrazonable (`VUELTO_MAXIMO_RAZONABLE_SOLES=500`, detecta errores de tipeo) y exigen número de operación para la parte pagada por Yape. Validación espejo en el servidor (`app/api/solicitudes/[id]/pago-presencial/route.ts`), reutilizada en renovaciones presenciales (`lib/renovacion.ts`).
- **QR Yape/Plin**: `QR_YAPE_PLIN_IMAGEN = "/qr-yape-plin.png"` — QR personal estático (sin monto fijo codificado; el cliente escribe el monto manualmente en su app), mostrado por el cajero durante el cobro presencial.
- **Comprobante de pago**: `lib/comprobante.ts` genera el PDF (vía `@react-pdf/renderer`), lo sube a Vercel Blob, lo registra en `comprobantesPago` y lo envía por correo al negocio — diseñado para nunca lanzar una excepción (una falla al generar el comprobante no debe revertir una venta ya completada).
- **Emisión de licencia**: `app/api/inspector/expediente/[id]/decision/route.ts` — el PDF y su subida a Blob se generan *antes* de mutar el estado en la base de datos, específicamente para evitar el bug de estado inconsistente corregido (inspección marcada conforme sin que la licencia se haya emitido realmente).
- **Programación de inspecciones** (`lib/agenda.ts`): la primera inspección se agenda en el día hábil más próximo con cupo (round-robin entre el inspector activo con menos carga, `CUPO_INSPECCIONES_POR_DIA=4`/día, con "turno" numerado); la segunda inspección es siempre +30 días hábiles peruanos fijos (`lib/diasHabilesPeru.ts` + `lib/feriadosPeru.ts`), sin importar el cupo.
- **Notificaciones/recordatorios** (`lib/notificacionesInspeccion.ts`, `lib/email.ts`, cron): correo de inspección programada, recordatorio el mismo día de la inspección (negocio + inspector), correos de pago/decisión, recordatorio de renovación (30 días antes), aviso de licencia vencida.
- **Integración Mercado Pago**: actualmente con token de producción configurado, pero el monto real cobrado está reducido temporalmente a S/1.80 (`MONTO_TRAMITE_COBRO_REAL_SOLES`) mientras se valida el flujo, aunque el negocio/BD sigue mostrando el monto oficial de S/180 (`MONTO_TRAMITE_SOLES`) — **pendiente de quitar antes de producción real**.
- **Validación de RUC/SUNAT**: la validación local de formato/checksum (`lib/validacionRuc.ts`) siempre corre primero (bloqueante si es inválida); la llamada a la API externa (`lib/sunat.ts`) verifica activo/habido y presencia en la provincia de Trujillo (domicilio fiscal o algún anexo); si la API externa falla, no bloquea (permite entrada manual).
- **Numeración**: `lib/numeracion.ts` genera de forma secuencial `numeroExpediente`, `numeroLicencia` y `numeroComprobante`.
- **Bloqueo de correos temporales/desechables**: `lib/correoTemporal.ts` + paquete `disposable-email-domains` + lista manual adicional (`lib/dominiosTemporalesManual.ts`).

## 8. Constantes de negocio (`lib/constantes.ts`)

- `MONTO_TRAMITE_SOLES = 180` — monto oficial del derecho de trámite.
- `MONTO_TRAMITE_COBRO_REAL_SOLES = 1.80` — monto real cobrado temporalmente mientras se valida Mercado Pago en producción (**quitar antes de ir en serio**).
- `VUELTO_MAXIMO_RAZONABLE_SOLES = 500` — límite para detectar errores de tipeo en el vuelto.
- `DIAS_HABILES_SEGUNDA_INSPECCION = 30` — plazo legal fijo para la segunda inspección.
- `VIGENCIA_LICENCIA_ANIOS = 1` — vigencia de la licencia.
- `CUPO_INSPECCIONES_POR_DIA = 4` — cupo diario de inspecciones.
- `MONTO_MINIMO_APERTURA_CAJA = 500` — monto mínimo para abrir caja.
- Tipos/tamaños de archivo permitidos para documentos, y textos legales fijos embebidos en el PDF de licencia (`RESOLUCION_GERENCIAL_LICENCIA`, `ORDENANZA_MUNICIPAL_LICENCIA`, nombre/cargo del firmante).

## 9. Variables de entorno (solo nombres, sin valores)

`AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `CONSULTASPERU_TOKEN`, `CRON_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEON_PROJECT_ID`, `NEXT_PUBLIC_SITE_URL`, `PGDATABASE`, `PGHOST`, `PGHOST_UNPOOLED`, `PGPASSWORD`, `PGUSER`, `POSTGRES_DATABASE`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_USER`, `SMTP_HOST`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_USER`, `SUNAT_API_TOKEN`, `SUNAT_API_URL`, `VERCEL_OIDC_TOKEN`.

> Nota: sin credenciales de Mercado Pago, SUNAT o SMTP, el sistema funciona en **modo simulado** automáticamente (no bloquea el desarrollo ni las demos). Se notó que falta un `.env.example` en el repo (aparece como eliminado en `git status`); considerar recrearlo para nuevos desarrolladores.

## 10. Scripts disponibles

- `npm run dev` — servidor de desarrollo.
- `npm run build` / `npm run start` — build y arranque en producción.
- `npm run test` — tests de Vitest (días hábiles peruanos, máquinas de estado, validación de RUC, dominios de correo).
- `npm run db:push` — sincroniza `lib/db/schema.ts` con la base de datos.
- `npm run seed` — crea admin (`admin@licencias-trujillo.pe`) y dos inspectores de prueba (`inspector1@` / `inspector2@licencias-trujillo.pe`), todos con contraseña `CambiarEsta123`.

## 11. Usabilidad / consideraciones de UX

- El wizard de solicitud (`app/solicitud/`) no exige cuenta previa — reduce fricción para el ciudadano/negocio.
- La consulta pública por RUC permite transparencia sin exponer datos sensibles.
- El pago presencial con autocompletado de montos (mixto) reduce errores aritméticos del cajero y valida vueltos irrazonables.
- Recordatorios automáticos (inspección el mismo día, renovación 30 días antes) reducen inasistencias y licencias vencidas por olvido.
- Un solo inspector activo a la vez (regla reciente) simplifica la asignación de turnos, aunque limita la capacidad de escalar el equipo de inspección sin cambiar esa regla.
- Modo simulado automático (pagos/SUNAT/correo) permite desarrollar y hacer demos sin depender de credenciales reales — buena práctica para un MVP en construcción.

## 12. Puntos pendientes / a vigilar

- `MONTO_TRAMITE_COBRO_REAL_SOLES = 1.80` en `lib/constantes.ts` es un throttle temporal de pruebas en producción; debe quitarse antes de operar con cobros reales de S/180.
- Falta `.env.example` en el repo (aparece eliminado en el working tree) — recrearlo ayudaría a nuevos desarrolladores a saber qué variables configurar.
- El README menciona "Resend" para correos, pero el código usa Nodemailer/SMTP — desalineación menor entre documentación y código a corregir.
