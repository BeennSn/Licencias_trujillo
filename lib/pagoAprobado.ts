// Efectos de un pago aprobado del derecho de trámite (paso D del wizard,
// canal web vía Checkout Pro): registra el pago, agenda la primera
// inspección y notifica. Se usa desde app/api/solicitudes/[id]/pago/confirmar
// (cuando el negocio vuelve de Mercado Pago) y puede volver a llamarse
// desde el webhook sin duplicar nada, porque es idempotente por
// referenciaPago (el id de pago de Mercado Pago es único).
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { expedientes, pagos } from "./db/schema";
import { puedeTransicionar } from "./estadosExpediente";
import { programarPrimeraInspeccion } from "./agenda";
import { notificarInspeccionProgramada } from "./notificacionesInspeccion";
import { MONTO_TRAMITE_SOLES } from "./constantes";
import { aFechaIso } from "./diasHabilesPeru";
import type { MedioPago } from "./pagos/mercadopago";

export type ResultadoCompletarPago = { ok: true } | { ok: false; error: string };

export async function completarPagoTramiteAprobado(params: {
  expedienteId: string;
  medioPago: MedioPago;
  referenciaPago: string;
}): Promise<ResultadoCompletarPago> {
  const { expedienteId, medioPago, referenciaPago } = params;

  const [yaRegistrado] = await db.select().from(pagos).where(eq(pagos.referenciaPago, referenciaPago)).limit(1);
  if (yaRegistrado) {
    return { ok: true }; // ya se procesó este pago antes (redirección + webhook llegaron ambos)
  }

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);
  if (!expediente) {
    return { ok: false, error: "Expediente no encontrado." };
  }

  await db.insert(pagos).values({
    expedienteId,
    monto: MONTO_TRAMITE_SOLES.toFixed(2),
    medioPago,
    estado: "aprobado",
    referenciaPago,
    canal: "web",
  });

  // El expediente ya podría estar más adelante que PAGO_PENDIENTE si esta
  // función se llama dos veces por dos vías distintas (poco probable dado
  // el chequeo de arriba, pero de todas formas no se reagenda una segunda
  // inspección por error).
  if (expediente.estado !== "PAGO_PENDIENTE") {
    return { ok: true };
  }

  if (puedeTransicionar(expediente.estado, "PAGO_APROBADO")) {
    await db.update(expedientes).set({ estado: "PAGO_APROBADO" }).where(eq(expedientes.id, expedienteId));
  }

  const inspeccion = await programarPrimeraInspeccion(expedienteId, aFechaIso(new Date()));

  await db
    .update(expedientes)
    .set({ estado: "PRIMERA_INSPECCION_PROGRAMADA", updatedAt: new Date() })
    .where(eq(expedientes.id, expedienteId));

  await notificarInspeccionProgramada({ inspeccion, expediente });

  return { ok: true };
}
