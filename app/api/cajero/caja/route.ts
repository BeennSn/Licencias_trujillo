import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { cajas } from "@/lib/db/schema";
import { obtenerCajaVigente, calcularTotalesCaja } from "@/lib/caja";

// GET: estado actual de la caja del cajero logueado (o null si no tiene
// ninguna abierta/pendiente de cierre) más el arqueo de esa sesión.
export async function GET() {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const caja = await obtenerCajaVigente(sesion.user.id);
  if (!caja) {
    return NextResponse.json({ caja: null });
  }

  const totales = await calcularTotalesCaja(caja);
  return NextResponse.json({ caja, totales });
}

// POST: abre una caja nueva. Obligatorio al iniciar sesión: ninguna otra
// ruta de cobro deja registrar un pago sin esto (ver lib/caja.ts::exigirCajaAbierta).
export async function POST() {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const cajaVigente = await obtenerCajaVigente(sesion.user.id);
  if (cajaVigente) {
    return NextResponse.json({ error: "Ya tienes una caja abierta o con cierre pendiente." }, { status: 409 });
  }

  const [caja] = await db.insert(cajas).values({ cajeroId: sesion.user.id }).returning();
  return NextResponse.json({ ok: true, caja });
}
