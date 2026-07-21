import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes } from "@/lib/db/schema";
import { completarRenovacionAprobada, type PagoRealizado } from "@/lib/renovacion";
import { exigirCajaAbierta } from "@/lib/caja";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";

const MEDIOS_PAGO_PRESENCIAL = ["efectivo", "yape", "mixto"] as const;
type MedioPagoPresencial = (typeof MEDIOS_PAGO_PRESENCIAL)[number];

// Segundo paso de la renovación presencial: cobra (efectivo, Yape o mixto
// efectivo+Yape) y emite la licencia. Se llama después de .../iniciar (y,
// opcionalmente, de reemplazar el plano en .../[expedienteId]/documento).
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const caja = await exigirCajaAbierta(sesion.user.id);
  if (!caja) {
    return NextResponse.json({ error: "Debes abrir tu caja antes de registrar un cobro." }, { status: 409 });
  }

  const cuerpo = await request.json().catch(() => ({}));
  const expedienteId = typeof cuerpo.expedienteId === "string" ? cuerpo.expedienteId : "";
  if (!expedienteId) {
    return NextResponse.json({ error: "Falta el expediente de renovación." }, { status: 400 });
  }

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);
  if (!expediente || expediente.tipo !== "renovacion") {
    return NextResponse.json({ error: "Expediente de renovación no encontrado." }, { status: 404 });
  }

  const medioPago: MedioPagoPresencial = MEDIOS_PAGO_PRESENCIAL.includes(cuerpo.medioPago)
    ? cuerpo.medioPago
    : "efectivo";
  const numeroOperacion: string | undefined =
    typeof cuerpo.numeroOperacion === "string" && cuerpo.numeroOperacion.trim()
      ? cuerpo.numeroOperacion.trim()
      : undefined;

  const referencia = numeroOperacion ?? `caja_${sesion.user.id}_${Date.now()}`;
  let pagosRealizados: PagoRealizado[];

  if (medioPago === "mixto") {
    const montoEfectivo = Number(cuerpo.montoEfectivo);
    const montoYape = Number(cuerpo.montoYape);
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

    pagosRealizados = [];
    if (montoEfectivo > 0) {
      pagosRealizados.push({ medioPago: "efectivo", monto: montoEfectivo, referenciaPago: `${referencia}_efectivo` });
    }
    if (montoYape > 0) {
      pagosRealizados.push({ medioPago: "yape", monto: montoYape, referenciaPago: `${referencia}_yape` });
    }
  } else {
    if (medioPago === "yape" && !numeroOperacion) {
      return NextResponse.json({ error: "Falta el número de operación del pago." }, { status: 400 });
    }
    pagosRealizados = [{ medioPago, monto: MONTO_TRAMITE_SOLES, referenciaPago: referencia }];
  }

  const emailNotificacion = expediente.emailContacto;
  if (!emailNotificacion) {
    return NextResponse.json(
      { error: "Este negocio no tiene un correo de contacto registrado para notificarle la renovación." },
      { status: 409 }
    );
  }

  const completado = await completarRenovacionAprobada({
    expedienteId,
    pagosRealizados,
    canal: "presencial",
    registradoPorId: sesion.user.id,
    emailNotificacion,
  });

  if (!completado.ok) {
    return NextResponse.json({ error: completado.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pdfUrl: completado.pdfUrl, fechaVencimiento: completado.fechaVencimiento });
}
