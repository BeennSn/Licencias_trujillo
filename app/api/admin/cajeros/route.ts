import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { usuarios } from "@/lib/db/schema";
import { esquemaNuevoInspector } from "@/lib/validaciones";

async function exigirAdmin() {
  const sesion = await auth();
  return sesion?.user?.rol === "admin" ? sesion : null;
}

export async function GET() {
  const sesion = await exigirAdmin();
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const cajeros = await db.select().from(usuarios).where(eq(usuarios.rol, "cajero"));
  return NextResponse.json({ cajeros });
}

// Mismo esquema (email/password/nombre) que se usa para crear inspectores:
// las cuentas de staff no difieren en esos campos, solo en el rol asignado.
export async function POST(request: Request) {
  const sesion = await exigirAdmin();
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const cuerpo = await request.json();
  const analisis = await esquemaNuevoInspector.safeParseAsync(cuerpo);
  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const { email, password, nombre } = analisis.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const [cajero] = await db
    .insert(usuarios)
    .values({ email: email.toLowerCase().trim(), passwordHash, nombre, rol: "cajero" })
    .returning();

  return NextResponse.json({ cajero });
}
