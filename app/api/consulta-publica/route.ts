import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { negocios, expedientes, licencias } from "@/lib/db/schema";
import { ETIQUETAS_ESTADO_EXPEDIENTE } from "@/lib/estadosExpediente";

// Consulta pública por RUC (sin login). Por protección de datos del
// negocio, esta respuesta SOLO expone razón social, estado del trámite/
// licencia y el PDF si está aprobada. Nunca dirección, pagos ni
// observaciones del inspector: por eso se seleccionan campos explícitos en
// vez de devolver las filas completas.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ruc = searchParams.get("ruc") ?? "";

  if (!/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: "El RUC debe tener 11 dígitos." }, { status: 400 });
  }

  const [negocio] = await db.select().from(negocios).where(eq(negocios.ruc, ruc)).limit(1);
  if (!negocio) {
    return NextResponse.json({ encontrado: false });
  }

  const [expediente] = await db
    .select()
    .from(expedientes)
    .where(eq(expedientes.negocioId, negocio.id))
    .orderBy(desc(expedientes.createdAt))
    .limit(1);

  const [licencia] = await db
    .select()
    .from(licencias)
    .where(eq(licencias.negocioId, negocio.id))
    .orderBy(desc(licencias.createdAt))
    .limit(1);

  return NextResponse.json({
    encontrado: true,
    razonSocial: negocio.razonSocial,
    estadoExpediente: expediente ? ETIQUETAS_ESTADO_EXPEDIENTE[expediente.estado] : null,
    licencia: licencia
      ? {
          estado: licencia.estado,
          fechaVencimiento: licencia.fechaVencimiento,
          pdfUrl: licencia.estado === "CLAUSURADA" ? null : licencia.pdfUrl,
        }
      : null,
  });
}
