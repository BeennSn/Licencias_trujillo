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

  const inspectores = await db.select().from(usuarios).where(eq(usuarios.rol, "inspector"));
  return NextResponse.json({ inspectores });
}

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

  const [inspector] = await db
    .insert(usuarios)
    .values({ email: email.toLowerCase().trim(), passwordHash, nombre, rol: "inspector" })
    .returning();

  return NextResponse.json({ inspector });
}
