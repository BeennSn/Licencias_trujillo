import { NextResponse } from "next/server";
import { and, eq, ne, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes } from "@/lib/db/schema";
import { esquemaDomicilio } from "@/lib/validaciones";

// Paso B del wizard: domicilio fiscal/local (restringido a distritos de
// Trujillo), giro de negocio y datos de contacto. No cambia el estado del
// expediente todavía: eso ocurre recién cuando los documentos quedan completos.
//
// Solo se puede editar mientras el expediente sigue en BORRADOR: una vez
// que pasó a DOCUMENTOS_COMPLETOS (o más adelante), el distrito/dirección
// ya pueden estar ligados a documentos subidos o a una inspección
// programada, así que cambiarlos después invalidaría esos pasos.
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

  if (expediente.estado !== "BORRADOR") {
    return NextResponse.json(
      { error: "El domicilio ya no se puede modificar: este paso quedó completado." },
      { status: 409 }
    );
  }

  // El correo/teléfono de contacto no se puede repetir entre RUC distintos
  // (evita que un mismo contacto abra solicitudes para varias empresas de
  // fachada). Sí se permite que el MISMO negocio lo reutilice.
  const { emailContacto, telefonoContacto } = analisis.data;

  const [conflicto] = await db
    .select()
    .from(expedientes)
    .where(
      and(
        ne(expedientes.negocioId, expediente.negocioId),
        or(eq(expedientes.emailContacto, emailContacto), eq(expedientes.telefonoContacto, telefonoContacto))
      )
    )
    .limit(1);

  if (conflicto) {
    const camposEnConflicto = [
      conflicto.emailContacto === emailContacto && "correo",
      conflicto.telefonoContacto === telefonoContacto && "teléfono",
    ]
      .filter(Boolean)
      .join(" y ");

    return NextResponse.json(
      { error: `El ${camposEnConflicto} de contacto ya está registrado con otro RUC. Usa datos de contacto distintos.` },
      { status: 409 }
    );
  }

  await db
    .update(expedientes)
    .set({ ...analisis.data, updatedAt: new Date() })
    .where(eq(expedientes.id, id));

  return NextResponse.json({ ok: true });
}
