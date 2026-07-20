import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { licencias, expedientes, negocios } from "@/lib/db/schema";
import { generarPdfLicencia } from "@/lib/pdfLicencia";
import { estaVencida } from "@/lib/estadosLicencia";
import { aFechaIso } from "@/lib/diasHabilesPeru";

// Descarga "en vivo" de la licencia: genera el PDF en cada request en vez
// de servir un archivo estático, porque el estado de la licencia puede
// cambiar con el tiempo (vence, se renueva) y el PDF debe reflejar eso
// siempre exacto. La decisión de mostrar la marca de agua "VENCIDA" se
// toma comparando fechaVencimiento contra la fecha de hoy EN VIVO, nunca
// contra el campo licencias.estado guardado en BD — ese campo lo actualiza
// un cron una vez al día (ver app/api/cron), así que puede tener hasta 24h
// de rezago; la comparación en vivo nunca tiene ese rezago.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [licencia] = await db.select().from(licencias).where(eq(licencias.id, id)).limit(1);
  if (!licencia) {
    return NextResponse.json({ error: "Licencia no encontrada." }, { status: 404 });
  }

  if (licencia.estado === "CLAUSURADA") {
    return NextResponse.json({ error: "Esta licencia no está disponible para descarga." }, { status: 403 });
  }

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, licencia.expedienteId)).limit(1);
  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, licencia.negocioId)).limit(1);
  if (!expediente || !negocio) {
    return NextResponse.json({ error: "No se pudo generar el PDF de esta licencia." }, { status: 500 });
  }

  const vencida = estaVencida(licencia.fechaVencimiento, aFechaIso(new Date()));
  const urlConsultaPublica = `${process.env.NEXT_PUBLIC_SITE_URL}/consulta?ruc=${negocio.ruc}`;

  const pdfBuffer = await generarPdfLicencia(
    {
      numeroLicencia: licencia.numeroLicencia,
      numeroExpediente: expediente.numeroExpediente ?? "",
      razonSocial: negocio.razonSocial,
      ruc: negocio.ruc,
      distrito: expediente.distrito ?? "",
      direccionLocal: expediente.direccionLocal ?? "",
      giroActividad: expediente.giroActividad ?? "",
      fechaEmision: licencia.fechaEmision,
      fechaVencimiento: licencia.fechaVencimiento,
      urlConsultaPublica,
    },
    vencida
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${licencia.numeroLicencia}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
