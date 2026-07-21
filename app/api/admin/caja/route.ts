import { NextResponse } from "next/server";
import { desc, eq, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { cajas, usuarios } from "@/lib/db/schema";
import { calcularTotalesCaja } from "@/lib/caja";

async function exigirAdmin() {
  const sesion = await auth();
  return sesion?.user?.rol === "admin" ? sesion : null;
}

async function conTotales(filas: { caja: typeof cajas.$inferSelect; cajero: typeof usuarios.$inferSelect }[]) {
  return Promise.all(
    filas.map(async ({ caja, cajero }) => {
      let aprobadaPor: { nombre: string | null; email: string } | null = null;
      if (caja.cierreAprobadoPorId) {
        const [admin] = await db.select().from(usuarios).where(eq(usuarios.id, caja.cierreAprobadoPorId)).limit(1);
        if (admin) aprobadaPor = { nombre: admin.nombre, email: admin.email };
      }
      return {
        caja,
        cajero: { id: cajero.id, nombre: cajero.nombre, email: cajero.email },
        aprobadaPor,
        totales: await calcularTotalesCaja(caja),
      };
    })
  );
}

// Lista las solicitudes de cierre pendientes (para aprobar/rechazar) y,
// aparte, el historial completo de sesiones de caja (abiertas, cerradas,
// con o sin solicitud de cierre en curso) para trazabilidad: quién abrió,
// quién cerró/aprobó y cuánto se cobró en cada sesión.
export async function GET() {
  const sesion = await exigirAdmin();
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const filasPendientes = await db
    .select({ caja: cajas, cajero: usuarios })
    .from(cajas)
    .innerJoin(usuarios, eq(cajas.cajeroId, usuarios.id))
    .where(eq(cajas.estado, "cierre_solicitado"))
    .orderBy(desc(cajas.cierreSolicitadoEn));

  const filasHistorial = await db
    .select({ caja: cajas, cajero: usuarios })
    .from(cajas)
    .innerJoin(usuarios, eq(cajas.cajeroId, usuarios.id))
    .where(ne(cajas.estado, "cierre_solicitado"))
    .orderBy(desc(cajas.abiertaEn));

  const [pendientes, historial] = await Promise.all([conTotales(filasPendientes), conTotales(filasHistorial)]);

  return NextResponse.json({ pendientes, historial });
}
