import { NextResponse } from "next/server";
import { and, eq, ne, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes } from "@/lib/db/schema";
import { esquemaDomicilio } from "@/lib/validaciones";

// Paso B del wizard: domicilio fiscal/local (restringido a distritos de
// Trujillo), giro de negocio y datos de contacto. No cambia el estado del
// expediente todavía: eso ocurre recién cuando los documentos quedan completos.
//
// El distrito/dirección solo se puede guardar UNA VEZ: apenas quedan
// escritos en el expediente (distrito deja de ser null), cualquier intento
// posterior de PATCH se rechaza. Importante: esto NO depende del estado
// del expediente (que solo cambia al subir documentos), porque el negocio
// podría volver atrás en el wizard antes de subir nada y editar el
// domicilio que ya había guardado — el dato guardado es la fuente de
// verdad de "¿ya se pasó este paso?", no la máquina de estados.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuerpo = await request.json();
  const analisis = await esquemaDomicilio.safeParseAsync(cuerpo);

  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  }

  if (expediente.distrito) {
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
