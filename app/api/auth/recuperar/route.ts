import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { usuarios, passwordResetTokens } from "@/lib/db/schema";
import { enviarCorreoRecuperacion } from "@/lib/email";

const UNA_HORA_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const { email } = await request.json();

  if (typeof email !== "string") {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }

  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email.toLowerCase().trim()))
    .limit(1);

  // Respuesta idéntica exista o no la cuenta, para no filtrar qué correos
  // están registrados en el sistema.
  const mensajeGenerico = {
    mensaje: "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.",
  };

  if (!usuario) {
    return NextResponse.json(mensajeGenerico);
  }

  const token = randomBytes(32).toString("hex");

  await db.insert(passwordResetTokens).values({
    usuarioId: usuario.id,
    token,
    expiraEn: new Date(Date.now() + UNA_HORA_MS),
  });

  const enlace = `${process.env.NEXT_PUBLIC_SITE_URL}/restablecer-password/${token}`;
  await enviarCorreoRecuperacion(usuario.email, enlace);

  return NextResponse.json(mensajeGenerico);
}
