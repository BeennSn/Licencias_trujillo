import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes, pagos } from "@/lib/db/schema";
import { ESTADOS_QUE_PERMITEN_PAGAR, puedeTransicionar } from "@/lib/estadosExpediente";
import { programarPrimeraInspeccion } from "@/lib/agenda";
import { notificarInspeccionProgramada } from "@/lib/notificacionesInspeccion";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";
import { aFechaIso } from "@/lib/diasHabilesPeru";

// Variante presencial del paso D del wizard (ver también .../pago): un
// cajero cobra el derecho de trámite en efectivo en ventanilla y confirma
// el pago directo, sin pasarela. El resto es idéntico al pago web: agenda
// la primera inspección lo antes posible.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;

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

  const [pago] = await db
    .insert(pagos)
    .values({
      expedienteId: id,
      monto: MONTO_TRAMITE_SOLES.toFixed(2),
      medioPago: "efectivo",
      estado: "aprobado",
      referenciaPago: `caja_${sesion.user.id}_${Date.now()}`,
      canal: "presencial",
      registradoPorId: sesion.user.id,
    })
    .returning();

  if (puedeTransicionar("PAGO_PENDIENTE", "PAGO_APROBADO")) {
    await db.update(expedientes).set({ estado: "PAGO_APROBADO" }).where(eq(expedientes.id, id));
  }

  const inspeccion = await programarPrimeraInspeccion(id, aFechaIso(new Date()));

  await db
    .update(expedientes)
    .set({ estado: "PRIMERA_INSPECCION_PROGRAMADA", updatedAt: new Date() })
    .where(eq(expedientes.id, id));

  await notificarInspeccionProgramada({ inspeccion, expediente });

  return NextResponse.json({
    ok: true,
    pagoId: pago.id,
    fechaInspeccion: inspeccion.fechaProgramada,
  });
}
