// Núcleo compartido de la renovación automática de licencia (regla de
// negocio explícita del cliente: es automática con solo el pago, sin
// inspección, siempre que sea el MISMO local — ver docs/marco-legal.md).
// Lo usan tanto la renovación web (app/api/negocio/renovar) como la
// presencial en caja (app/api/cajero/renovar); lo único que cambia entre
// canales es CÓMO se resuelve el pago (pasarela vs efectivo), por eso se
// recibe como un callback `resolverPago` que se invoca en el mismo punto
// del flujo donde la ruta original cobraba con Mercado Pago (después de
// validar que hay una licencia elegible y de crear el expediente de
// renovación, nunca antes: así nunca se intenta cobrar si no corresponde).
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

export type ResultadoRenovacion =
  | { ok: true; pdfUrl: string | null; fechaVencimiento: string }
  | { ok: false; error: string; status: number; pagoId?: string };

export async function ejecutarRenovacion(params: {
  negocioId: string;
  medioPago: MedioPago;
  canal: "web" | "presencial";
  registradoPorId?: string;
  emailNotificacion: string;
  resolverPago: () => Promise<ResultadoCobro>;
}): Promise<ResultadoRenovacion> {
  const { negocioId, medioPago, canal, registradoPorId, emailNotificacion, resolverPago } = params;

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

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, negocioId)).limit(1);

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
      licenciaAnteriorId: licenciaAnterior.id,
    })
    .returning();

  const resultadoPago = await resolverPago();

  const [pago] = await db
    .insert(pagos)
    .values({
      expedienteId: expedienteRenovacion.id,
      monto: MONTO_TRAMITE_SOLES.toFixed(2),
      medioPago,
      estado: resultadoPago.aprobado ? "aprobado" : "rechazado",
      referenciaPago: resultadoPago.aprobado ? resultadoPago.referencia : null,
      canal,
      registradoPorId,
    })
    .returning();

  if (!resultadoPago.aprobado) {
    return { ok: false, error: resultadoPago.motivo, status: 402, pagoId: pago.id };
  }

  const hoy = aFechaIso(new Date());
  const fechaVencimiento = sumarAnios(hoy, VIGENCIA_LICENCIA_ANIOS);
  const numeroLicencia = await generarNumeroLicencia();
  const urlConsultaPublica = `${process.env.NEXT_PUBLIC_SITE_URL}/consulta?ruc=${negocio.ruc}`;

  const pdfBuffer = await generarPdfLicencia({
    numeroLicencia,
    numeroExpediente: expedienteRenovacion.numeroExpediente ?? "",
    razonSocial: negocio.razonSocial,
    ruc: negocio.ruc,
    distrito: expedienteRenovacion.distrito ?? "",
    direccionLocal: expedienteRenovacion.direccionLocal ?? "",
    giroActividad: expedienteRenovacion.giroActividad ?? "",
    fechaEmision: hoy,
    fechaVencimiento,
    urlConsultaPublica,
  });

  const blob = await put(`licencias/${numeroLicencia}.pdf`, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
  });

  const [licenciaNueva] = await db
    .insert(licencias)
    .values({
      expedienteId: expedienteRenovacion.id,
      negocioId,
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
    .where(eq(expedientes.id, expedienteRenovacion.id));

  if (puedeTransicionarLicencia(licenciaAnterior.estado, "RENOVADA")) {
    await db.update(licencias).set({ estado: "RENOVADA" }).where(eq(licencias.id, licenciaAnterior.id));
  }

  await enviarCorreoDecisionInspeccion(emailNotificacion, expedienteRenovacion.numeroExpediente ?? "", true);

  return { ok: true, pdfUrl: licenciaNueva.pdfUrl, fechaVencimiento };
}
