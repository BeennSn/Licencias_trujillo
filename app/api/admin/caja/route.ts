import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { cajas, usuarios } from "@/lib/db/schema";
import { calcularTotalesCaja } from "@/lib/caja";

async function exigirAdmin() {
  const sesion = await auth();
  return sesion?.user?.rol === "admin" ? sesion : null;
}

// Lista las solicitudes de cierre de caja pendientes de aprobación, con el
// arqueo de cada una para que el admin decida con esa información.
export async function GET() {
  const sesion = await exigirAdmin();
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const filas = await db
    .select({ caja: cajas, cajero: usuarios })
    .from(cajas)
    .innerJoin(usuarios, eq(cajas.cajeroId, usuarios.id))
    .where(eq(cajas.estado, "cierre_solicitado"))
    .orderBy(desc(cajas.cierreSolicitadoEn));

  const pendientes = await Promise.all(
    filas.map(async ({ caja, cajero }) => ({
      caja,
      cajero: { id: cajero.id, nombre: cajero.nombre, email: cajero.email },
      totales: await calcularTotalesCaja(caja),
    }))
  );

  return NextResponse.json({ pendientes });
}
