import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db/client";
import { documentos, expedientes } from "@/lib/db/schema";
import { esquemaDocumento } from "@/lib/validaciones";
import { ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS, puedeTransicionar } from "@/lib/estadosExpediente";
import { TAMANO_MAXIMO_DOCUMENTO_BYTES, TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS } from "@/lib/constantes";

// Paso C del wizard: sube el plano del local (único documento que se pide)
// a Vercel Blob y lo registra en la base de datos. Un solo plano por
// expediente: si ya había uno, se borra (fila + blob) antes de guardar el
// nuevo, así subir otro archivo simplemente lo reemplaza.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  }

  if (!ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS.includes(expediente.estado)) {
    return NextResponse.json(
      { error: "Ya no se pueden subir documentos a este expediente (el trámite avanzó a pago)." },
      { status: 409 }
    );
  }

  const formulario = await request.formData();
  const archivo = formulario.get("archivo");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: "Debes adjuntar un archivo." }, { status: 400 });
  }

  if (!TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS.includes(archivo.type as (typeof TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS)[number])) {
    return NextResponse.json(
      { error: "Solo se aceptan archivos PDF, JPG o PNG." },
      { status: 400 }
    );
  }

  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_BYTES) {
    return NextResponse.json(
      { error: `El archivo supera el tamaño máximo permitido (${TAMANO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024)} MB).` },
      { status: 400 }
    );
  }

  const blob = await put(`documentos/${id}/${Date.now()}-${archivo.name}`, archivo, {
    access: "public",
  });

  const analisis = esquemaDocumento.safeParse({ urlArchivo: blob.url });
  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const documentosAnteriores = await db.select().from(documentos).where(eq(documentos.expedienteId, id));
  if (documentosAnteriores.length > 0) {
    await db.delete(documentos).where(eq(documentos.expedienteId, id));
    await Promise.all(documentosAnteriores.map((doc) => del(doc.urlArchivo).catch(() => {})));
  }

  await db.insert(documentos).values({ expedienteId: id, ...analisis.data });

  // Con el plano del local ya subido, el expediente pasa de BORRADOR a
  // DOCUMENTOS_COMPLETOS.
  if (expediente.estado === "BORRADOR" && puedeTransicionar(expediente.estado, "DOCUMENTOS_COMPLETOS")) {
    await db
      .update(expedientes)
      .set({ estado: "DOCUMENTOS_COMPLETOS", updatedAt: new Date() })
      .where(eq(expedientes.id, id));
  }

  return NextResponse.json({ ok: true, url: blob.url });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lista = await db.select().from(documentos).where(eq(documentos.expedienteId, id));
  return NextResponse.json({ documentos: lista });
}
