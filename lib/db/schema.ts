// Esquema completo de la base de datos (fuente de verdad).
// Cada tabla tiene un comentario corto explicando su rol en el proceso de licencia.
import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  date,
  timestamp,
  numeric,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import type { DireccionTrujillo } from "../sunat";

export const rolUsuario = pgEnum("rol_usuario", ["negocio", "inspector", "admin"]);

export const tipoExpediente = pgEnum("tipo_expediente", ["nueva", "renovacion"]);

// Debe reflejar exactamente los valores de EstadoExpediente en lib/estadosExpediente.ts
export const estadoExpediente = pgEnum("estado_expediente", [
  "BORRADOR",
  "DOCUMENTOS_COMPLETOS",
  "PAGO_PENDIENTE",
  "PAGO_APROBADO",
  "PRIMERA_INSPECCION_PROGRAMADA",
  "SEGUNDA_INSPECCION_PROGRAMADA",
  "APROBADA",
  "RECHAZADA",
]);

export const tipoDocumento = pgEnum("tipo_documento", ["plano_local", "otro"]);

export const estadoPago = pgEnum("estado_pago", ["pendiente", "aprobado", "rechazado"]);

// Medios de pago habilitados por Mercado Pago Perú (verificar en el
// dashboard de Mercado Pago cuáles están realmente activos para la cuenta).
export const medioPago = pgEnum("medio_pago", ["tarjeta", "yape", "pagoefectivo"]);

export const tipoInspeccion = pgEnum("tipo_inspeccion", ["primera", "segunda"]);

export const estadoInspeccion = pgEnum("estado_inspeccion", [
  "programada",
  "conforme",
  "observada",
]);

// Debe reflejar exactamente los valores de EstadoLicencia en lib/estadosLicencia.ts
export const estadoLicencia = pgEnum("estado_licencia", [
  "VIGENTE",
  "VENCIDA",
  "RENOVADA",
  "CLAUSURADA",
]);

// Cuentas de acceso al sistema. El negocio recién obtiene una fila aquí
// después de pagar (paso E del wizard); inspectores y admin se crean por seed/admin.
export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rol: rolUsuario("rol").notNull(),
  negocioId: uuid("negocio_id").references(() => negocios.id),
  nombre: varchar("nombre", { length: 255 }),
  telefono: varchar("telefono", { length: 30 }),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// La entidad RUC en sí. Se crea en el paso A del wizard y se reutiliza
// en renovaciones o nuevos trámites del mismo negocio.
export const negocios = pgTable("negocios", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruc: varchar("ruc", { length: 11 }).notNull().unique(),
  razonSocial: varchar("razon_social", { length: 500 }).notNull(),
  estadoSunat: varchar("estado_sunat", { length: 50 }),
  condicionHabido: varchar("condicion_habido", { length: 50 }),
  // Direcciones en la Provincia de Trujillo (domicilio fiscal y/o locales
  // anexos) que SUNAT tiene registradas para este RUC, cacheadas en la
  // última validación exitosa. Se usan para sugerir/autocompletar el
  // domicilio del local en el paso B del wizard (ver lib/sunat.ts).
  direccionesTrujillo: jsonb("direcciones_trujillo").$type<DireccionTrujillo[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Un "expediente" es una solicitud de licencia (nueva o renovación).
// numeroExpediente es el identificador legible que ve el usuario (EXP-2026-000123);
// id (uuid) es el identificador interno usado en las URLs del wizard.
export const expedientes = pgTable("expedientes", {
  id: uuid("id").primaryKey().defaultRandom(),
  numeroExpediente: varchar("numero_expediente", { length: 30 }).unique(),
  negocioId: uuid("negocio_id")
    .notNull()
    .references(() => negocios.id),
  tipo: tipoExpediente("tipo").notNull().default("nueva"),
  estado: estadoExpediente("estado").notNull().default("BORRADOR"),
  distrito: varchar("distrito", { length: 100 }),
  direccionLocal: text("direccion_local"),
  giroActividad: varchar("giro_actividad", { length: 255 }),
  emailContacto: varchar("email_contacto", { length: 255 }),
  telefonoContacto: varchar("telefono_contacto", { length: 30 }),
  licenciaAnteriorId: uuid("licencia_anterior_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Documentos subidos en el paso C. fechaVigencia debe ser futura y enTramite
// debe ser false para que el expediente pueda avanzar (ver lib/validaciones/documentos.ts).
export const documentos = pgTable("documentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  expedienteId: uuid("expediente_id")
    .notNull()
    .references(() => expedientes.id),
  tipo: tipoDocumento("tipo").notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  urlArchivo: text("url_archivo").notNull(),
  fechaVigencia: date("fecha_vigencia").notNull(),
  enTramite: boolean("en_tramite").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Pago del derecho de trámite (S/180, ver lib/constantes.ts).
export const pagos = pgTable("pagos", {
  id: uuid("id").primaryKey().defaultRandom(),
  expedienteId: uuid("expediente_id")
    .notNull()
    .references(() => expedientes.id),
  monto: numeric("monto", { precision: 10, scale: 2 }).notNull(),
  medioPago: medioPago("medio_pago").notNull(),
  estado: estadoPago("estado").notNull().default("pendiente"),
  referenciaPago: varchar("referencia_pago", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Cada visita del inspector. tipo distingue la primera de la segunda (por
// observación). La segunda se crea automáticamente vía lib/agenda.ts.
export const inspecciones = pgTable("inspecciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  expedienteId: uuid("expediente_id")
    .notNull()
    .references(() => expedientes.id),
  tipo: tipoInspeccion("tipo").notNull(),
  fechaProgramada: date("fecha_programada").notNull(),
  // Hora de la visita dentro del día (ver HORAS_INSPECCION en lib/constantes.ts).
  // Nullable porque las inspecciones creadas antes de este campo no tienen hora.
  horaProgramada: varchar("hora_programada", { length: 5 }),
  inspectorId: uuid("inspector_id")
    .notNull()
    .references(() => usuarios.id),
  estado: estadoInspeccion("estado").notNull().default("programada"),
  observaciones: text("observaciones"),
  fechaRealizada: date("fecha_realizada"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// La licencia emitida. fechaVencimiento = fechaEmision + 1 año (ver lib/constantes.ts).
export const licencias = pgTable("licencias", {
  id: uuid("id").primaryKey().defaultRandom(),
  expedienteId: uuid("expediente_id")
    .notNull()
    .references(() => expedientes.id),
  negocioId: uuid("negocio_id")
    .notNull()
    .references(() => negocios.id),
  numeroLicencia: varchar("numero_licencia", { length: 30 }).notNull().unique(),
  fechaEmision: date("fecha_emision").notNull(),
  fechaVencimiento: date("fecha_vencimiento").notNull(),
  pdfUrl: text("pdf_url"),
  estado: estadoLicencia("estado").notNull().default("VIGENTE"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Reportes de cambios de infraestructura del local (obligación del negocio).
// revisado lo marca el admin/inspector luego de evaluarlo.
export const reportesInfraestructura = pgTable("reportes_infraestructura", {
  id: uuid("id").primaryKey().defaultRandom(),
  expedienteId: uuid("expediente_id")
    .notNull()
    .references(() => expedientes.id),
  descripcion: text("descripcion").notNull(),
  fechaReporte: timestamp("fecha_reporte").notNull().defaultNow(),
  revisado: boolean("revisado").notNull().default(false),
});

// Tokens de un solo uso para recuperar contraseña (expiran en 1 hora).
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiraEn: timestamp("expira_en").notNull(),
  usado: boolean("usado").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
