import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes } from "@/lib/db/schema";
import { esquemaDomicilio } from "@/lib/validaciones";

// Paso B del wizard: domicilio fiscal/local (restringido a distritos de
// Trujillo), giro de negocio y datos de contacto. No cambia el estado del
// expediente todavía: eso ocurre recién cuando los documentos quedan completos.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuerpo = await request.json();
  const analisis = esquemaDomicilio.safeParse(cuerpo);

  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  }

  await db
    .update(expedientes)
    .set({ ...analisis.data, updatedAt: new Date() })
    .where(eq(expedientes.id, id));

  return NextResponse.json({ ok: true });
}
