// Helpers de la sesión de caja de un cajero (ver lib/db/schema.ts::cajas y
// lib/estadosCaja.ts). Centralizados acá porque los usan tanto las rutas del
// cajero (abrir/solicitar cierre) como las del admin (listar/aprobar) y las
// rutas de cobro (pago-presencial, cajero/renovar), que necesitan exigir que
// haya una caja abierta antes de registrar cualquier pago.
import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import { db } from "./db/client";
import { cajas, pagos } from "./db/schema";

// La caja "vigente" de un cajero: la última fila que no está cerrada
// (abierta o con cierre solicitado). Solo puede haber una a la vez por
// cajero — abrirCaja() lo exige antes de crear una fila nueva.
export async function obtenerCajaVigente(cajeroId: string) {
  const [caja] = await db
    .select()
    .from(cajas)
    .where(and(eq(cajas.cajeroId, cajeroId), or(eq(cajas.estado, "abierta"), eq(cajas.estado, "cierre_solicitado"))))
    .orderBy(desc(cajas.abiertaEn))
    .limit(1);

  return caja ?? null;
}

// Usado por las rutas de cobro (pago-presencial, cajero/renovar): sin caja
// abierta (estado exactamente "abierta", no "cierre_solicitado"), el cajero
// no puede registrar ningún pago.
export async function exigirCajaAbierta(cajeroId: string) {
  const caja = await obtenerCajaVigente(cajeroId);
  if (!caja || caja.estado !== "abierta") return null;
  return caja;
}

// Arqueo: total cobrado por medio de pago durante la sesión de caja (desde
// que abrió hasta ahora, o hasta que cerró si ya cerró). Se calcula al vuelo
// sobre "pagos" en vez de guardarse en "cajas" para no tener dos fuentes de
// verdad del mismo dato.
export async function calcularTotalesCaja(caja: typeof cajas.$inferSelect) {
  const filtroFecha = caja.cerradaEn
    ? and(gte(pagos.createdAt, caja.abiertaEn), lte(pagos.createdAt, caja.cerradaEn))
    : gte(pagos.createdAt, caja.abiertaEn);

  const pagosDeLaSesion = await db
    .select()
    .from(pagos)
    .where(and(eq(pagos.registradoPorId, caja.cajeroId), eq(pagos.estado, "aprobado"), filtroFecha));

  const totalesPorMedio: Record<string, number> = {};
  let total = 0;
  for (const pago of pagosDeLaSesion) {
    const monto = Number(pago.monto);
    totalesPorMedio[pago.medioPago] = (totalesPorMedio[pago.medioPago] ?? 0) + monto;
    total += monto;
  }

  return { total, totalesPorMedio, cantidadPagos: pagosDeLaSesion.length };
}
