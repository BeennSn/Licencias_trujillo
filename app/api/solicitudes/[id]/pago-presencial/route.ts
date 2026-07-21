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
import { exigirCajaAbierta } from "@/lib/caja";

const MEDIOS_PAGO_PRESENCIAL = ["efectivo", "tarjeta", "yape", "mixto"] as const;
type MedioPagoPresencial = (typeof MEDIOS_PAGO_PRESENCIAL)[number];

// Variante presencial del paso D del wizard (ver también .../pago): un
// cajero cobra el derecho de trámite en ventanilla (efectivo, tarjeta, Yape/
// Plin con QR de monto fijo, o una combinación efectivo+Yape) y confirma el
// pago directo, sin pasarela. El resto es idéntico al pago web: agenda la
// primera inspección lo antes posible.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const caja = await exigirCajaAbierta(sesion.user.id);
  if (!caja) {
    return NextResponse.json({ error: "Debes abrir tu caja antes de registrar un cobro." }, { status: 409 });
  }

  const cuerpo = await request.json().catch(() => ({}));
  const medioPago: MedioPagoPresencial = MEDIOS_PAGO_PRESENCIAL.includes(cuerpo.medioPago)
    ? cuerpo.medioPago
    : "efectivo";
  const numeroOperacion: string | undefined =
    typeof cuerpo.numeroOperacion === "string" && cuerpo.numeroOperacion.trim()
      ? cuerpo.numeroOperacion.trim()
      : undefined;

  if (medioPago === "yape" && !numeroOperacion) {
    return NextResponse.json({ error: "Falta el número de operación del pago." }, { status: 400 });
  }

  let montoEfectivo = 0;
  let montoYape = 0;
  if (medioPago === "mixto") {
    montoEfectivo = Number(cuerpo.montoEfectivo);
    montoYape = Number(cuerpo.montoYape);
    if (!Number.isFinite(montoEfectivo) || !Number.isFinite(montoYape) || montoEfectivo < 0 || montoYape < 0) {
      return NextResponse.json({ error: "Ingresa montos válidos para efectivo y Yape." }, { status: 400 });
    }
    if (Math.round((montoEfectivo + montoYape) * 100) !== Math.round(MONTO_TRAMITE_SOLES * 100)) {
      return NextResponse.json(
        { error: `La suma de efectivo y Yape debe ser exactamente S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}.` },
        { status: 400 }
      );
    }
    if (montoYape > 0 && !numeroOperacion) {
      return NextResponse.json({ error: "Falta el número de operación del pago por Yape." }, { status: 400 });
    }
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

  const referencia = numeroOperacion ?? `caja_${sesion.user.id}_${Date.now()}`;

  if (medioPago === "mixto") {
    const filas = [];
    if (montoEfectivo > 0) {
      filas.push({
        expedienteId: id,
        monto: montoEfectivo.toFixed(2),
        medioPago: "efectivo" as const,
        estado: "aprobado" as const,
        referenciaPago: `${referencia}_efectivo`,
        canal: "presencial" as const,
        registradoPorId: sesion.user.id,
      });
    }
    if (montoYape > 0) {
      filas.push({
        expedienteId: id,
        monto: montoYape.toFixed(2),
        medioPago: "yape" as const,
        estado: "aprobado" as const,
        referenciaPago: `${referencia}_yape`,
        canal: "presencial" as const,
        registradoPorId: sesion.user.id,
      });
    }
    await db.insert(pagos).values(filas);
  } else {
    await db.insert(pagos).values({
      expedienteId: id,
      monto: MONTO_TRAMITE_SOLES.toFixed(2),
      medioPago,
      estado: "aprobado",
      referenciaPago: referencia,
      canal: "presencial",
      registradoPorId: sesion.user.id,
    });
  }

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
    fechaInspeccion: inspeccion.fechaProgramada,
  });
}
