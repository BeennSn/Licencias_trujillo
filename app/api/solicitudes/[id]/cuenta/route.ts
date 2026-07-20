import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes, usuarios } from "@/lib/db/schema";
import { esquemaCuenta } from "@/lib/validaciones";
import { ESTADOS_SIN_PAGO_APROBADO } from "@/lib/estadosExpediente";

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

  if (ESTADOS_SIN_PAGO_APROBADO.includes(expediente.estado)) {
    return NextResponse.json(
      { error: "Debes completar el pago del trámite antes de crear tu cuenta." },
      { status: 409 }
    );
  }

  const [cuentaExistente] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.negocioId, expediente.negocioId))
    .limit(1);

  if (!cuentaExistente) {
    const cuerpo = await request.json();
    const analisis = await esquemaCuenta.safeParseAsync(cuerpo);
    if (!analisis.success) {
      return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
    }

    const { email, password } = analisis.data;
    const emailNormalizado = email.toLowerCase().trim();

    // El correo de la cuenta es único en todo el sistema (la tabla lo exige
    // a nivel de base de datos); se verifica antes para dar un mensaje
    // claro en vez de que la inserción falle con un error genérico.
    const [correoEnUso] = await db.select().from(usuarios).where(eq(usuarios.email, emailNormalizado)).limit(1);
    if (correoEnUso) {
      return NextResponse.json(
        { error: "Este correo ya está en uso por otra cuenta. Ingresa uno distinto o recupera tu contraseña si ya es tuyo." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(usuarios).values({
      email: emailNormalizado,
      passwordHash,
      rol: "negocio",
      negocioId: expediente.negocioId,
    });
  }

  // La notificación de la inspección programada ya se envía al pagar (ver
  // .../pago y .../pago-presencial), sin depender de que exista cuenta —
  // por eso no se reenvía acá.
  return NextResponse.json({ ok: true, cuentaReutilizada: Boolean(cuentaExistente) });
}
