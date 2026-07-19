import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";
import { usuarios, passwordResetTokens } from "@/lib/db/schema";

export async function POST(request: Request) {
  const { token, password } = await request.json();

  if (typeof token !== "string" || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Datos inválidos. La contraseña debe tener al menos 8 caracteres." },
      { status: 400 }
    );
  }

  const [registroToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.usado, false),
        gt(passwordResetTokens.expiraEn, new Date())
      )
    )
    .limit(1);

  if (!registroToken) {
    return NextResponse.json({ error: "El enlace es inválido o ya expiró." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.update(usuarios).set({ passwordHash }).where(eq(usuarios.id, registroToken.usuarioId));
  await db
    .update(passwordResetTokens)
    .set({ usado: true })
    .where(eq(passwordResetTokens.id, registroToken.id));

  return NextResponse.json({ mensaje: "Contraseña actualizada correctamente." });
}
