import { NextResponse } from "next/server";
import { completarPagoTramiteAprobado } from "@/lib/pagoAprobado";
import { inferirMedioPagoDesdeMP } from "@/lib/pagos/mercadopago";

// Cuando el negocio vuelve de la plataforma de Mercado Pago (Checkout Pro,
// ver .../pago), el frontend llama acá con el payment_id que viene en la
// URL. Por seguridad, NUNCA se confía en el status que venga en la URL:
// siempre se vuelve a consultar el pago con nuestro access token.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { paymentId } = await request.json();

  if (!paymentId) {
    return NextResponse.json({ error: "Falta el identificador del pago." }, { status: 400 });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Mercado Pago no está configurado." }, { status: 500 });
  }

  const respuesta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!respuesta.ok) {
    return NextResponse.json({ error: "No se pudo verificar el pago con Mercado Pago." }, { status: 502 });
  }

  const datosPago = await respuesta.json();

  if (datosPago.external_reference !== id) {
    return NextResponse.json({ error: "El pago no corresponde a este expediente." }, { status: 400 });
  }

  if (datosPago.status !== "approved") {
    return NextResponse.json({
      ok: false,
      estado: datosPago.status,
      motivo:
        datosPago.status === "pending" || datosPago.status === "in_process"
          ? "Tu pago quedó pendiente de confirmación. Te avisaremos por correo apenas se confirme."
          : "El pago no fue aprobado.",
    });
  }

  const completado = await completarPagoTramiteAprobado({
    expedienteId: id,
    medioPago: inferirMedioPagoDesdeMP(datosPago),
    referenciaPago: String(datosPago.id),
  });

  if (!completado.ok) {
    return NextResponse.json({ error: completado.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comprobanteUrl: completado.comprobanteUrl });
}
