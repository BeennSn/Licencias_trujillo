import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes, negocios, licencias, pagos } from "@/lib/db/schema";
import { cobrarDerechoDeTramite } from "@/lib/pagos/mercadopago";
import { generarNumeroExpediente, generarNumeroLicencia } from "@/lib/numeracion";
import { generarPdfLicencia } from "@/lib/pdfLicencia";
import { sumarAnios } from "@/lib/fechas";
import { aFechaIso } from "@/lib/diasHabilesPeru";
import { VIGENCIA_LICENCIA_ANIOS, MONTO_TRAMITE_SOLES } from "@/lib/constantes";
import { puedeTransicionarLicencia } from "@/lib/estadosLicencia";
import { enviarCorreoDecisionInspeccion } from "@/lib/email";

// Renovación anual: regla de negocio explícita del cliente -> es AUTOMÁTICA
// con solo el pago, PERO únicamente si es el MISMO local. Por eso este
// expediente de tipo "renovacion" nunca pasa por documentos ni inspección:
// se salta directo de BORRADOR a APROBADA tras el pago (a propósito, no es
// un bug en la máquina de estados general, que sigue exigiendo inspección
// para trámites nuevos).
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "negocio") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { mismoLocal, medioPago, tokenPago, email } = await request.json();

  if (!mismoLocal) {
    return NextResponse.json(
      {
        error:
          "La renovación automática solo aplica si es el mismo local. Para un local distinto debes iniciar un trámite nuevo completo.",
      },
      { status: 400 }
    );
  }

  const negocioId = sesion.user.negocioId!;

  const [licenciaAnterior] = await db
    .select()
    .from(licencias)
    .where(eq(licencias.negocioId, negocioId))
    .orderBy(desc(licencias.createdAt))
    .limit(1);

  if (!licenciaAnterior || licenciaAnterior.estado === "CLAUSURADA") {
    return NextResponse.json({ error: "No tienes una licencia elegible para renovar." }, { status: 409 });
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

  const resultadoPago = await cobrarDerechoDeTramite(tokenPago, email, medioPago);

  const [pago] = await db
    .insert(pagos)
    .values({
      expedienteId: expedienteRenovacion.id,
      monto: MONTO_TRAMITE_SOLES.toFixed(2),
      medioPago,
      estado: resultadoPago.aprobado ? "aprobado" : "rechazado",
      referenciaPago: resultadoPago.aprobado ? resultadoPago.referencia : null,
    })
    .returning();

  if (!resultadoPago.aprobado) {
    return NextResponse.json({ error: resultadoPago.motivo, pagoId: pago.id }, { status: 402 });
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

  await db.update(expedientes).set({ estado: "APROBADA", updatedAt: new Date() }).where(eq(expedientes.id, expedienteRenovacion.id));

  if (puedeTransicionarLicencia(licenciaAnterior.estado, "RENOVADA")) {
    await db.update(licencias).set({ estado: "RENOVADA" }).where(eq(licencias.id, licenciaAnterior.id));
  }

  await enviarCorreoDecisionInspeccion(email, expedienteRenovacion.numeroExpediente ?? "", true);

  return NextResponse.json({ ok: true, pdfUrl: licenciaNueva.pdfUrl, fechaVencimiento });
}
