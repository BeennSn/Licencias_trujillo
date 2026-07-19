import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes, usuarios, inspecciones } from "@/lib/db/schema";
import { esquemaCuenta } from "@/lib/validaciones";
import { enviarCorreoInspeccionProgramada } from "@/lib/email";

// Paso E del wizard: crea la cuenta (correo + contraseña) que el negocio
// usará de ahora en adelante para ver su expediente y renovar su licencia.
// Solo se pide UNA vez: si el negocio ya tiene cuenta (por un trámite o
// renovación anterior), se reutiliza en vez de pedir otra contraseña.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  }

  const [cuentaExistente] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.negocioId, expediente.negocioId))
    .limit(1);

  let correoDeNotificacion = cuentaExistente?.email;

  if (!cuentaExistente) {
    const cuerpo = await request.json();
    const analisis = esquemaCuenta.safeParse(cuerpo);
    if (!analisis.success) {
      return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
    }

    const { email, password } = analisis.data;
    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(usuarios).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      rol: "negocio",
      negocioId: expediente.negocioId,
    });

    correoDeNotificacion = email;
  }

  const [ultimaInspeccion] = await db
    .select()
    .from(inspecciones)
    .where(and(eq(inspecciones.expedienteId, id), eq(inspecciones.tipo, "primera")))
    .orderBy(desc(inspecciones.createdAt))
    .limit(1);

  if (correoDeNotificacion && ultimaInspeccion) {
    await enviarCorreoInspeccionProgramada(
      correoDeNotificacion,
      expediente.numeroExpediente ?? "",
      ultimaInspeccion.fechaProgramada,
      "primera"
    );
  }

  return NextResponse.json({ ok: true, cuentaReutilizada: Boolean(cuentaExistente) });
}
