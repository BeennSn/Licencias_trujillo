import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { cajas } from "@/lib/db/schema";
import { obtenerCajaVigente, calcularTotalesCaja } from "@/lib/caja";
import { MONTO_MINIMO_APERTURA_CAJA } from "@/lib/constantes";

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

// POST: abre una caja nueva, declarando el fondo con el que arranca
// (mínimo MONTO_MINIMO_APERTURA_CAJA). Obligatorio al iniciar sesión:
// ninguna otra ruta de cobro deja registrar un pago sin esto (ver
// lib/caja.ts::exigirCajaAbierta).
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const cajaVigente = await obtenerCajaVigente(sesion.user.id);
  if (cajaVigente) {
    return NextResponse.json({ error: "Ya tienes una caja abierta o con cierre pendiente." }, { status: 409 });
  }

  const cuerpo = await request.json().catch(() => ({}));
  const montoApertura = Number(cuerpo.montoApertura);

  if (!Number.isFinite(montoApertura) || montoApertura < MONTO_MINIMO_APERTURA_CAJA) {
    return NextResponse.json(
      { error: `El monto de apertura debe ser de al menos S/ ${MONTO_MINIMO_APERTURA_CAJA.toFixed(2)}.` },
      { status: 400 }
    );
  }

  const [caja] = await db
    .insert(cajas)
    .values({ cajeroId: sesion.user.id, montoApertura: montoApertura.toFixed(2) })
    .returning();
  return NextResponse.json({ ok: true, caja });
}
