import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes, pagos } from "@/lib/db/schema";
import { esquemaPago } from "@/lib/validaciones";
import { ESTADOS_QUE_PERMITEN_PAGAR, puedeTransicionar } from "@/lib/estadosExpediente";
import { cobrarDerechoDeTramite } from "@/lib/pagos/mercadopago";
import { programarPrimeraInspeccion } from "@/lib/agenda";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";
import { aFechaIso } from "@/lib/diasHabilesPeru";

// Paso D del wizard: cobra el derecho de trámite (S/180) y, si se aprueba,
// programa automáticamente la primera inspección técnica lo antes posible.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuerpo = await request.json();
  const analisis = await esquemaPago.safeParseAsync(cuerpo);

  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  }

  if (!ESTADOS_QUE_PERMITEN_PAGAR.includes(expediente.estado)) {
    return NextResponse.json(
      { error: "Este expediente no está listo para recibir el pago todavía." },
      { status: 409 }
    );
  }

  if (expediente.estado === "DOCUMENTOS_COMPLETOS") {
    await db.update(expedientes).set({ estado: "PAGO_PENDIENTE" }).where(eq(expedientes.id, id));
  }

  const { medioPago, tokenPago, email } = analisis.data;
  const resultado = await cobrarDerechoDeTramite(tokenPago, email, medioPago);

  const [pago] = await db
    .insert(pagos)
    .values({
      expedienteId: id,
      monto: MONTO_TRAMITE_SOLES.toFixed(2),
      medioPago,
      estado: resultado.aprobado ? "aprobado" : "rechazado",
      referenciaPago: resultado.aprobado ? resultado.referencia : null,
    })
    .returning();

  if (!resultado.aprobado) {
    return NextResponse.json({ ok: false, motivo: resultado.motivo, pagoId: pago.id }, { status: 402 });
  }

  if (puedeTransicionar("PAGO_PENDIENTE", "PAGO_APROBADO")) {
    await db.update(expedientes).set({ estado: "PAGO_APROBADO" }).where(eq(expedientes.id, id));
  }

  const inspeccion = await programarPrimeraInspeccion(id, aFechaIso(new Date()));

  await db
    .update(expedientes)
    .set({ estado: "PRIMERA_INSPECCION_PROGRAMADA", updatedAt: new Date() })
    .where(eq(expedientes.id, id));

  return NextResponse.json({
    ok: true,
    pagoId: pago.id,
    fechaInspeccion: inspeccion.fechaProgramada,
  });
}
