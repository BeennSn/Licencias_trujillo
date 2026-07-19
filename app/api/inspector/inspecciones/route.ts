import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { inspecciones, expedientes, negocios } from "@/lib/db/schema";

// Lista las inspecciones programadas (pendientes) del inspector autenticado,
// con los datos del negocio ya resueltos, para el calendario/lista de su dashboard.
export async function GET() {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "inspector") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const filas = await db
    .select({
      inspeccion: inspecciones,
      expediente: expedientes,
      negocio: negocios,
    })
    .from(inspecciones)
    .innerJoin(expedientes, eq(inspecciones.expedienteId, expedientes.id))
    .innerJoin(negocios, eq(expedientes.negocioId, negocios.id))
    .where(and(eq(inspecciones.inspectorId, sesion.user.id), eq(inspecciones.estado, "programada")))
    .orderBy(asc(inspecciones.fechaProgramada));

  return NextResponse.json({ inspecciones: filas });
}
