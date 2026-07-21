import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { cajas } from "@/lib/db/schema";
import { puedeTransicionarCaja } from "@/lib/estadosCaja";

async function exigirAdmin() {
  const sesion = await auth();
  return sesion?.user?.rol === "admin" ? sesion : null;
}

// Aprobar = la caja queda cerrada de inmediato (no hay un paso extra del
// cajero después de la aprobación).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirAdmin();
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const { id } = await params;
  const [caja] = await db.select().from(cajas).where(eq(cajas.id, id)).limit(1);
  if (!caja) {
    return NextResponse.json({ error: "Caja no encontrada." }, { status: 404 });
  }

  if (!puedeTransicionarCaja(caja.estado, "cerrada")) {
    return NextResponse.json({ error: "Esta caja no tiene un cierre pendiente de aprobar." }, { status: 409 });
  }

  const [actualizada] = await db
    .update(cajas)
    .set({ estado: "cerrada", cierreAprobadoPorId: sesion.user.id, cerradaEn: new Date() })
    .where(eq(cajas.id, id))
    .returning();

  return NextResponse.json({ ok: true, caja: actualizada });
}
