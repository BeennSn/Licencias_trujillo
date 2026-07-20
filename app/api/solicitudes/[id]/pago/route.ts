import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes, pagos } from "@/lib/db/schema";
import { esquemaPago, esquemaIniciarPagoMercadoPago } from "@/lib/validaciones";
import { ESTADOS_QUE_PERMITEN_PAGAR } from "@/lib/estadosExpediente";
import { cobrarDerechoDeTramite, crearPreferenciaDeCobro } from "@/lib/pagos/mercadopago";
import { completarPagoTramiteAprobado } from "@/lib/pagoAprobado";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";

// Paso D del wizard. Con Mercado Pago configurado (MERCADOPAGO_ACCESS_TOKEN),
// usa Checkout Pro: crea una preferencia y devuelve el link (init_point)
// para redirigir al negocio a la plataforma de Mercado Pago, donde elige
// tarjeta/Yape/PagoEfectivo. El pago se confirma después, cuando vuelve
// (ver .../pago/confirmar) — acá NUNCA se cobra ni se agenda la inspección.
//
// Sin credenciales configuradas, se mantiene el flujo simulado anterior
// (cobro directo con token falso) para no bloquear el desarrollo local.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuerpo = await request.json();

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

  if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
    const analisis = await esquemaIniciarPagoMercadoPago.safeParseAsync(cuerpo);
    if (!analisis.success) {
      return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
    }

    const urlBase = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const preferencia = await crearPreferenciaDeCobro({ expedienteId: id, email: analisis.data.email, urlBase });

    if (!preferencia.ok) {
      return NextResponse.json({ error: preferencia.motivo }, { status: 502 });
    }

    return NextResponse.json({ ok: true, initPoint: preferencia.initPoint });
  }

  // Modo simulado (sin credenciales reales de Mercado Pago).
  const analisis = await esquemaPago.safeParseAsync(cuerpo);
  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const { medioPago, tokenPago, email } = analisis.data;
  const resultado = await cobrarDerechoDeTramite(tokenPago, email, medioPago);

  if (!resultado.aprobado) {
    const [pago] = await db
      .insert(pagos)
      .values({ expedienteId: id, monto: MONTO_TRAMITE_SOLES.toFixed(2), medioPago, estado: "rechazado" })
      .returning();
    return NextResponse.json({ ok: false, motivo: resultado.motivo, pagoId: pago.id }, { status: 402 });
  }

  const completado = await completarPagoTramiteAprobado({
    expedienteId: id,
    medioPago,
    referenciaPago: resultado.referencia,
  });

  if (!completado.ok) {
    return NextResponse.json({ error: completado.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
