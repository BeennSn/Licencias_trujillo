# Sistema de Licencias de Funcionamiento - Municipalidad Provincial de Trujillo

MVP del sistema de otorgamiento de licencias de funcionamiento municipal para la Municipalidad Provincial de Trujillo (MPT). El marco legal y las reglas de negocio implementadas están resumidas en [`docs/marco-legal.md`](docs/marco-legal.md); el plan de implementación completo (arquitectura, cronograma, alcance) está en el plan de este proyecto.

## Stack

- **Next.js 16 (App Router)** + TypeScript + Tailwind CSS.
- **Neon Postgres** + **Drizzle ORM** (`lib/db/schema.ts` es la fuente de verdad del modelo de datos).
- **Auth.js (NextAuth v5)** con credenciales (correo + contraseña) para 3 roles: negocio, inspector, admin.
- **Mercado Pago** para el pago del derecho de trámite; si no hay credenciales configuradas, el pago se **simula** automáticamente (ver `lib/pagos/mercadopago.ts`). **Importante:** usar credenciales de prueba (`TEST-...`) durante desarrollo/demo — un access token de producción (`APP_USR-...`) hace cobros reales.
- **API pública tipo SUNAT** para validar RUC (con fallback manual si el servicio externo falla, ver `lib/sunat.ts`).
- **Vercel Blob** para archivos (documentos subidos y PDFs de licencias).
- **Resend** para correos (recuperación de contraseña, notificaciones); si no hay API key, los correos se imprimen en consola.
- **@react-pdf/renderer** para generar el PDF de la licencia con código QR.

## Primeros pasos (desarrollo local)

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar `.env.example` a `.env.local` y completar al menos `DATABASE_URL` (crea una base gratuita en [neon.tech](https://neon.tech)) y `AUTH_SECRET` (generar con `openssl rand -base64 32`). El resto de variables son opcionales: sin ellas, el sistema funciona en modo simulado (pagos, RUC, correos).
3. Crear las tablas en la base de datos:
   ```bash
   npm run db:push
   ```
4. Crear un usuario administrador y dos inspectores de prueba:
   ```bash
   npm run seed
   ```
   Esto crea `admin@licencias-trujillo.pe` y `inspector1@licencias-trujillo.pe` / `inspector2@licencias-trujillo.pe`, todos con la contraseña `CambiarEsta123` (cámbiala apenas puedas).
5. Levantar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - servidor de desarrollo.
- `npm run build` / `npm run start` - build y arranque en modo producción.
- `npm run test` - corre los tests de Vitest (lógica de días hábiles peruanos y máquina de estados del expediente).
- `npm run db:push` - sincroniza `lib/db/schema.ts` con la base de datos (sin migraciones formales, por velocidad).
- `npm run seed` - crea el administrador y los inspectores de prueba.

## Estructura del código (dónde buscar cada cosa)

- `lib/db/schema.ts` - todas las tablas de la base de datos.
- `lib/estadosExpediente.ts` / `lib/estadosLicencia.ts` - máquinas de estado (qué transiciones son válidas).
- `lib/diasHabilesPeru.ts` + `lib/feriadosPeru.ts` - cálculo de días hábiles peruanos (usado para la agenda de inspecciones). **Los feriados móviles deben actualizarse a mano cada enero.**
- `lib/agenda.ts` - auto-programación de la primera y segunda inspección.
- `lib/sunat.ts` - validación de RUC contra la API pública, con fallback manual.
- `lib/pagos/mercadopago.ts` - cobro del derecho de trámite (real o simulado).
- `lib/pdfLicencia.tsx` - generación del PDF de la licencia con QR.
- `lib/auth.ts` / `lib/auth.config.ts` / `middleware.ts` - autenticación y protección de rutas por rol.
- `app/solicitud/` - wizard de la solicitud (pasos A-F, sin necesidad de cuenta previa).
- `app/negocio/`, `app/inspector/`, `app/admin/` - paneles privados de cada rol.
- `app/consulta/` - consulta pública por RUC (sin login).

## Notas para el equipo

- El pago y la validación de RUC tienen un **modo simulado automático** cuando faltan las credenciales reales (Mercado Pago / API SUNAT). Esto es intencional para no bloquear el desarrollo ni la demo mientras se gestionan esas cuentas; los comentarios en `lib/pagos/mercadopago.ts` y `lib/sunat.ts` explican cómo activar el modo real.
- Mercado Pago tiene cuentas de prueba separadas de la de producción (Developers > Tus integraciones > tu app > Cuentas de prueba). Úsenlas mientras desarrollan; solo pasen el access token de producción cuando de verdad quieran que el sistema cobre dinero real.
- El monto del derecho de trámite, los días hábiles de la segunda inspección y la vigencia de la licencia son constantes en `lib/constantes.ts` - cambiar ahí si la municipalidad actualiza el TUPA.
- Los distritos válidos están en `lib/distritosTrujillo.ts`.
