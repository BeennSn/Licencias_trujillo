import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes, negocios, documentos, pagos, inspecciones } from "@/lib/db/schema";

// Detalle completo de un expediente, usado por las páginas del wizard
// (pasos B-F). El propio UUID en la URL funciona como "llave" de acceso
// mientras el negocio todavía no tiene cuenta creada (pasos A-D).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  }

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expediente.negocioId)).limit(1);
  const documentosDelExpediente = await db.select().from(documentos).where(eq(documentos.expedienteId, id));
  const pagosDelExpediente = await db.select().from(pagos).where(eq(pagos.expedienteId, id));
  const inspeccionesDelExpediente = await db
    .select()
    .from(inspecciones)
    .where(eq(inspecciones.expedienteId, id));

  return NextResponse.json({
    expediente,
    negocio,
    documentos: documentosDelExpediente,
    pagos: pagosDelExpediente,
    inspecciones: inspeccionesDelExpediente,
  });
}
