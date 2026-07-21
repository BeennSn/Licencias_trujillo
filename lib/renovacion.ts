// Núcleo compartido de la renovación automática de licencia (regla de
// negocio explícita del cliente: es automática con solo el pago, sin
// inspección, siempre que sea el MISMO local — ver docs/marco-legal.md).
//
// Se parte en dos pasos porque el pago web ahora usa Checkout Pro
// (redirección a Mercado Pago, ver app/api/negocio/renovar): no se puede
// cobrar y emitir la licencia en la misma llamada como antes, porque entre
// medio el negocio se va a la plataforma de Mercado Pago y vuelve después.
//
// - iniciarExpedienteRenovacion: valida elegibilidad y crea el expediente
//   de renovación (PAGO_PENDIENTE), ANTES de cualquier intento de cobro.
// - completarRenovacionAprobada: una vez el pago está confirmado (por la
//   página de resultado tras Checkout Pro, o directo en el caso presencial/
//   simulado), emite la licencia nueva y marca la anterior como RENOVADA.
//   Es idempotente: si ya existe una licencia para ese expediente, no hace
//   nada de nuevo (evita duplicar si la redirección y el webhook llegan
//   los dos).
//
// ejecutarRenovacion combina ambos pasos en una sola llamada síncrona; lo
// sigue usando la renovación presencial en caja (app/api/cajero/renovar,
// pago en efectivo confirmado por el cajero) y el modo simulado, donde el
// pago se resuelve al toque, sin redirección.
import { desc, eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "./db/client";
import { expedientes, negocios, licencias, pagos } from "./db/schema";
import { generarNumeroExpediente, generarNumeroLicencia } from "./numeracion";
import { generarPdfLicencia } from "./pdfLicencia";
import { sumarAnios } from "./fechas";
import { aFechaIso } from "./diasHabilesPeru";
import { VIGENCIA_LICENCIA_ANIOS, MONTO_TRAMITE_SOLES } from "./constantes";
import { puedeTransicionarLicencia } from "./estadosLicencia";
import { enviarCorreoDecisionInspeccion } from "./email";
import type { ResultadoCobro, MedioPago } from "./pagos/mercadopago";

export type ResultadoIniciarRenovacion =
  | { ok: true; expedienteId: string }
  | { ok: false; error: string; status: number };

export async function iniciarExpedienteRenovacion(negocioId: string): Promise<ResultadoIniciarRenovacion> {
  const [licenciaAnterior] = await db
    .select()
    .from(licencias)
    .where(eq(licencias.negocioId, negocioId))
    .orderBy(desc(licencias.createdAt))
    .limit(1);

  if (!licenciaAnterior || licenciaAnterior.estado === "CLAUSURADA") {
    return { ok: false, error: "No tiene una licencia elegible para renovar.", status: 409 };
  }

  const [expedienteAnterior] = await db
    .select()
    .from(expedientes)
    .where(eq(expedientes.id, licenciaAnterior.expedienteId))
    .limit(1);

  const numeroExpediente = await generarNumeroExpediente();
  const [expedienteRenovacion] = await db
    .insert(expedientes)
    .values({
      numeroExpediente,
      negocioId,
      tipo: "renovacion",
      estado: "PAGO_PENDIENTE",
      distrito: expedienteAnterior?.distrito,
      direccionLocal: expedienteAnterior?.direccionLocal,
      giroActividad: expedienteAnterior?.giroActividad,
      emailContacto: expedienteAnterior?.emailContacto,
      telefonoContacto: expedienteAnterior?.telefonoContacto,
      nombreComercial: expedienteAnterior?.nombreComercial,
      representanteLegalNombre: expedienteAnterior?.representanteLegalNombre,
      representanteLegalDni: expedienteAnterior?.representanteLegalDni,
      licenciaAnteriorId: licenciaAnterior.id,
    })
    .returning();

  return { ok: true, expedienteId: expedienteRenovacion.id };
}

export type ResultadoCompletarRenovacion =
  | { ok: true; pdfUrl: string | null; fechaVencimiento: string }
  | { ok: false; error: string };

export type PagoRealizado = { medioPago: MedioPago; monto: number; referenciaPago: string };

export async function completarRenovacionAprobada(params: {
  expedienteId: string;
  // Normalmente un solo elemento (un medio de pago), pero el cajero puede
  // cobrar la renovación mitad efectivo, mitad Yape (pago mixto) — en ese
  // caso vienen dos, y cada uno se registra como su propia fila en "pagos".
  pagosRealizados: PagoRealizado[];
  canal: "web" | "presencial";
  registradoPorId?: string;
  emailNotificacion: string;
}): Promise<ResultadoCompletarRenovacion> {
  const { expedienteId, pagosRealizados, canal, registradoPorId, emailNotificacion } = params;

  // Idempotente: si ya se emitió una licencia para este expediente de
  // renovación, no se vuelve a cobrar/emitir (redirección + webhook llegando
  // los dos, o el negocio recargando la página de resultado).
  const [licenciaExistente] = await db.select().from(licencias).where(eq(licencias.expedienteId, expedienteId)).limit(1);
  if (licenciaExistente) {
    return { ok: true, pdfUrl: licenciaExistente.pdfUrl, fechaVencimiento: licenciaExistente.fechaVencimiento };
  }

  const [expedienteRenovacion] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);
  if (!expedienteRenovacion) {
    return { ok: false, error: "Expediente de renovación no encontrado." };
  }

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expedienteRenovacion.negocioId)).limit(1);
  if (!negocio) {
    return { ok: false, error: "Negocio no encontrado." };
  }

  await db.insert(pagos).values(
    pagosRealizados.map((pago) => ({
      expedienteId,
      monto: pago.monto.toFixed(2),
      medioPago: pago.medioPago,
      estado: "aprobado" as const,
      referenciaPago: pago.referenciaPago,
      canal,
      registradoPorId,
    }))
  );

  const hoy = aFechaIso(new Date());
  const fechaVencimiento = sumarAnios(hoy, VIGENCIA_LICENCIA_ANIOS);
  const numeroLicencia = await generarNumeroLicencia();
  const urlConsultaPublica = `${process.env.NEXT_PUBLIC_SITE_URL}/consulta?ruc=${negocio.ruc}`;

  const pdfBuffer = await generarPdfLicencia({
    numeroLicencia,
    numeroExpediente: expedienteRenovacion.numeroExpediente ?? "",
    razonSocial: negocio.razonSocial,
    ruc: negocio.ruc,
    representanteLegalNombre: expedienteRenovacion.representanteLegalNombre ?? "",
    representanteLegalDni: expedienteRenovacion.representanteLegalDni ?? "",
    nombreComercial: expedienteRenovacion.nombreComercial ?? "",
    distrito: expedienteRenovacion.distrito ?? "",
    direccionLocal: expedienteRenovacion.direccionLocal ?? "",
    giroActividad: expedienteRenovacion.giroActividad ?? "",
    fechaEmision: hoy,
    fechaVencimiento,
    urlConsultaPublica,
  });

  // allowOverwrite: ver comentario equivalente en
  // app/api/inspector/expediente/[id]/decision/route.ts.
  const blob = await put(`licencias/${numeroLicencia}.pdf`, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
    allowOverwrite: true,
  });

  const [licenciaNueva] = await db
    .insert(licencias)
    .values({
      expedienteId,
      negocioId: expedienteRenovacion.negocioId,
      numeroLicencia,
      fechaEmision: hoy,
      fechaVencimiento,
      pdfUrl: blob.url,
      estado: "VIGENTE",
    })
    .returning();

  await db
    .update(expedientes)
    .set({ estado: "APROBADA", updatedAt: new Date() })
    .where(eq(expedientes.id, expedienteId));

  if (expedienteRenovacion.licenciaAnteriorId) {
    const [licenciaAnterior] = await db
      .select()
      .from(licencias)
      .where(eq(licencias.id, expedienteRenovacion.licenciaAnteriorId))
      .limit(1);

    if (licenciaAnterior && puedeTransicionarLicencia(licenciaAnterior.estado, "RENOVADA")) {
      await db.update(licencias).set({ estado: "RENOVADA" }).where(eq(licencias.id, licenciaAnterior.id));
    }
  }

  await enviarCorreoDecisionInspeccion(emailNotificacion, expedienteRenovacion.numeroExpediente ?? "", true);

  return { ok: true, pdfUrl: licenciaNueva.pdfUrl, fechaVencimiento };
}

export type ResultadoRenovacion =
  | { ok: true; pdfUrl: string | null; fechaVencimiento: string }
  | { ok: false; error: string; status: number; pagoId?: string };

// Resuelve el pago de forma síncrona (efectivo en caja o modo simulado) y
// completa la renovación en la misma llamada. No la usa el pago web con
// Checkout Pro (ver app/api/negocio/renovar), que reparte estos mismos dos
// pasos en dos requests distintas.
export async function ejecutarRenovacion(params: {
  negocioId: string;
  medioPago: MedioPago;
  canal: "web" | "presencial";
  registradoPorId?: string;
  emailNotificacion: string;
  resolverPago: () => Promise<ResultadoCobro>;
}): Promise<ResultadoRenovacion> {
  const { negocioId, medioPago, canal, registradoPorId, emailNotificacion, resolverPago } = params;

  const inicio = await iniciarExpedienteRenovacion(negocioId);
  if (!inicio.ok) {
    return inicio;
  }

  const resultadoPago = await resolverPago();

  if (!resultadoPago.aprobado) {
    const [pago] = await db
      .insert(pagos)
      .values({
        expedienteId: inicio.expedienteId,
        monto: MONTO_TRAMITE_SOLES.toFixed(2),
        medioPago,
        estado: "rechazado",
        canal,
        registradoPorId,
      })
      .returning();
    return { ok: false, error: resultadoPago.motivo, status: 402, pagoId: pago.id };
  }

  const completado = await completarRenovacionAprobada({
    expedienteId: inicio.expedienteId,
    pagosRealizados: [{ medioPago, monto: MONTO_TRAMITE_SOLES, referenciaPago: resultadoPago.referencia }],
    canal,
    registradoPorId,
    emailNotificacion,
  });

  if (!completado.ok) {
    return { ok: false, error: completado.error, status: 500 };
  }

  return { ok: true, pdfUrl: completado.pdfUrl, fechaVencimiento: completado.fechaVencimiento };
}
