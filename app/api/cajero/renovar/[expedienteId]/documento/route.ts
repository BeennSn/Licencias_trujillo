import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { documentos, expedientes } from "@/lib/db/schema";
import { exigirCajaAbierta } from "@/lib/caja";
import { TAMANO_MAXIMO_DOCUMENTO_BYTES, TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS } from "@/lib/constantes";

// Paso opcional entre .../iniciar y .../confirmar: si el negocio cambió
// algo en el local, el cajero le reemplaza el plano acá antes de cobrar la
// renovación. Si no hace falta, este paso simplemente se salta y la
// renovación queda con el plano que ya tenía (si tenía alguno) sin tocarlo.
export async function POST(request: Request, { params }: { params: Promise<{ expedienteId: string }> }) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const caja = await exigirCajaAbierta(sesion.user.id);
  if (!caja) {
    return NextResponse.json({ error: "Debes abrir tu caja antes de continuar." }, { status: 409 });
  }

  const { expedienteId } = await params;
  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);
  if (!expediente || expediente.tipo !== "renovacion" || expediente.estado !== "PAGO_PENDIENTE") {
    return NextResponse.json({ error: "Este expediente no admite cambiar el plano en este momento." }, { status: 409 });
  }

  const formulario = await request.formData();
  const archivo = formulario.get("archivo");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: "Debes adjuntar un archivo." }, { status: 400 });
  }

  if (!TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS.includes(archivo.type as (typeof TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS)[number])) {
    return NextResponse.json({ error: "Solo se aceptan archivos PDF, JPG o PNG." }, { status: 400 });
  }

  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_BYTES) {
    return NextResponse.json(
      { error: `El archivo supera el tamaño máximo permitido (${TAMANO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024)} MB).` },
      { status: 400 }
    );
  }

  const blob = await put(`documentos/${expedienteId}/${Date.now()}-${archivo.name}`, archivo, { access: "public" });

  const documentosAnteriores = await db.select().from(documentos).where(eq(documentos.expedienteId, expedienteId));
  if (documentosAnteriores.length > 0) {
    await db.delete(documentos).where(eq(documentos.expedienteId, expedienteId));
    await Promise.all(documentosAnteriores.map((doc) => del(doc.urlArchivo).catch(() => {})));
  }

  await db.insert(documentos).values({ expedienteId, urlArchivo: blob.url });

  return NextResponse.json({ ok: true, url: blob.url });
}
