import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/lib/db/client";
import { documentos, expedientes } from "@/lib/db/schema";
import { ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS } from "@/lib/estadosExpediente";

// Permite borrar un documento subido por error (ej. archivo equivocado) antes
// de que el expediente pase a pago. Una vez que el pago está en curso o
// aprobado, el negocio ya no puede tocar los documentos del expediente.

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentoId: string }> }
) {
  const { id, documentoId } = await params;

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  }

  if (!ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS.includes(expediente.estado)) {
    return NextResponse.json(
      { error: "Ya no se pueden eliminar documentos de este expediente (el trámite avanzó a pago)." },
      { status: 409 }
    );
  }

  const [documento] = await db
    .select()
    .from(documentos)
    .where(and(eq(documentos.id, documentoId), eq(documentos.expedienteId, id)))
    .limit(1);

  if (!documento) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  await db.delete(documentos).where(eq(documentos.id, documentoId));
  await del(documento.urlArchivo).catch(() => {});

  // Si el documento borrado era el plano válido, el expediente vuelve a
  // BORRADOR: ya no cumple el requisito para haber pasado a DOCUMENTOS_COMPLETOS.
  const documentosRestantes = await db.select().from(documentos).where(eq(documentos.expedienteId, id));
  const sigueTeniendoPlanoValido = documentosRestantes.some((doc) => doc.tipo === "plano_local" && !doc.enTramite);

  if (!sigueTeniendoPlanoValido && expediente.estado === "DOCUMENTOS_COMPLETOS") {
    await db.update(expedientes).set({ estado: "BORRADOR", updatedAt: new Date() }).where(eq(expedientes.id, id));
  }

  return NextResponse.json({ ok: true });
}
