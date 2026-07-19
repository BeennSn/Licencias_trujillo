import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes, reportesInfraestructura } from "@/lib/db/schema";
import { esquemaReporteInfraestructura } from "@/lib/validaciones";

// El negocio reporta un cambio de infraestructura de su local. Requisito
// legal: si el negocio modifica el local y NO lo reporta, corre riesgo de
// clausura (ver docs/marco-legal.md). Este MVP registra el reporte para que
// el inspector/admin lo revise; no automatiza la detección física del cambio.
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "negocio") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const cuerpo = await request.json();
  const analisis = esquemaReporteInfraestructura.safeParse(cuerpo);
  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const [expedienteActual] = await db
    .select()
    .from(expedientes)
    .where(eq(expedientes.negocioId, sesion.user.negocioId!))
    .orderBy(desc(expedientes.createdAt))
    .limit(1);

  if (!expedienteActual) {
    return NextResponse.json({ error: "No se encontró un expediente asociado a tu cuenta." }, { status: 404 });
  }

  await db.insert(reportesInfraestructura).values({
    expedienteId: expedienteActual.id,
    descripcion: analisis.data.descripcion,
  });

  return NextResponse.json({ ok: true });
}
