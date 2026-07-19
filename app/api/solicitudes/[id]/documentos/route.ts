import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/lib/db/client";
import { documentos, expedientes } from "@/lib/db/schema";
import { esquemaDocumento } from "@/lib/validaciones";
import { puedeTransicionar } from "@/lib/estadosExpediente";
import { TAMANO_MAXIMO_DOCUMENTO_BYTES, TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS } from "@/lib/constantes";

// Paso C del wizard: sube un documento (ej. plano del local) a Vercel Blob
// y lo registra en la base de datos. Requisito legal explícito del cliente:
// todo documento debe tener fecha de vigencia futura y no estar "en trámite"
// (esa validación vive en lib/validaciones.ts::esquemaDocumento).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
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

  const analisis = esquemaDocumento.safeParse({
    tipo: formulario.get("tipo"),
    nombre: formulario.get("nombre") ?? archivo.name,
    urlArchivo: blob.url,
    fechaVigencia: formulario.get("fechaVigencia"),
    enTramite: formulario.get("enTramite") === "true",
  });

  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  await db.insert(documentos).values({ expedienteId: id, ...analisis.data });

  // Con el plano del local (documento obligatorio) ya subido y válido, el
  // expediente pasa de BORRADOR a DOCUMENTOS_COMPLETOS.
  const documentosActuales = await db.select().from(documentos).where(eq(documentos.expedienteId, id));
  const tienePlanoValido = documentosActuales.some((doc) => doc.tipo === "plano_local" && !doc.enTramite);

  if (
    tienePlanoValido &&
    expediente.estado === "BORRADOR" &&
    puedeTransicionar(expediente.estado, "DOCUMENTOS_COMPLETOS")
  ) {
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
