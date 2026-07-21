import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { cajas } from "@/lib/db/schema";
import { obtenerCajaVigente, calcularTotalesCaja } from "@/lib/caja";
import { puedeTransicionarCaja } from "@/lib/estadosCaja";

// El cajero no puede cerrar su caja directamente: solo puede solicitar el
// cierre. Un admin tiene que aprobarlo (ver app/api/admin/caja/[id]/aprobar)
// para que quede realmente cerrada.
export async function POST() {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const caja = await obtenerCajaVigente(sesion.user.id);
  if (!caja) {
    return NextResponse.json({ error: "No tienes una caja abierta." }, { status: 409 });
  }

  if (!puedeTransicionarCaja(caja.estado, "cierre_solicitado")) {
    return NextResponse.json({ error: "Ya solicitaste el cierre de esta caja." }, { status: 409 });
  }

  const [actualizada] = await db
    .update(cajas)
    .set({ estado: "cierre_solicitado", cierreSolicitadoEn: new Date() })
    .where(eq(cajas.id, caja.id))
    .returning();

  const totales = await calcularTotalesCaja(actualizada);
  return NextResponse.json({ ok: true, caja: actualizada, totales });
}
