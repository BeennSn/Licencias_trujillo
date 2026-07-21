import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cobrarDerechoDeTramite, crearPreferenciaDeCobro } from "@/lib/pagos/mercadopago";
import { esquemaRenovacion, esquemaIniciarPagoMercadoPago } from "@/lib/validaciones";
import { ejecutarRenovacion, iniciarExpedienteRenovacion } from "@/lib/renovacion";

// Renovación anual: regla de negocio explícita del cliente -> es AUTOMÁTICA
// con solo el pago, PERO únicamente si es el MISMO local. Por eso este
// expediente de tipo "renovacion" nunca pasa por documentos ni inspección
// (ver lib/renovacion.ts).
//
// Con Mercado Pago configurado usa Checkout Pro, igual que el pago inicial
// del wizard: se crea el expediente de renovación (PAGO_PENDIENTE) y se
// redirige al negocio a la plataforma de Mercado Pago; el pago se confirma
// después en .../renovar/confirmar, cuando vuelve. Sin credenciales
// (modo simulado), se mantiene el cobro directo síncrono de siempre.
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "negocio") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const cuerpo = await request.json();

  if (!cuerpo.mismoLocal) {
    return NextResponse.json(
      {
        error:
          "La renovación automática solo aplica si es el mismo local. Para un local distinto debes iniciar un trámite nuevo completo.",
      },
      { status: 400 }
    );
  }

  const negocioId = sesion.user.negocioId!;

  if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
    const analisis = await esquemaIniciarPagoMercadoPago.safeParseAsync(cuerpo);
    if (!analisis.success) {
      return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
    }

    const inicio = await iniciarExpedienteRenovacion(negocioId);
    if (!inicio.ok) {
      return NextResponse.json({ error: inicio.error }, { status: inicio.status });
    }

    const urlBase = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const preferencia = await crearPreferenciaDeCobro({
      expedienteId: inicio.expedienteId,
      email: analisis.data.email,
      urlResultado: `${urlBase}/negocio/renovar/resultado`,
      urlNotificacion: `${urlBase}/api/webhooks/mercadopago`,
    });

    if (!preferencia.ok) {
      return NextResponse.json({ error: preferencia.motivo }, { status: 502 });
    }

    return NextResponse.json({ ok: true, initPoint: preferencia.initPoint });
  }

  // Modo simulado (sin credenciales reales de Mercado Pago).
  const analisis = await esquemaRenovacion.safeParseAsync(cuerpo);
  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const { medioPago, tokenPago, email } = analisis.data;

  const resultado = await ejecutarRenovacion({
    negocioId,
    medioPago,
    canal: "web",
    emailNotificacion: email,
    resolverPago: () => cobrarDerechoDeTramite(tokenPago, email, medioPago),
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, pagoId: resultado.pagoId }, { status: resultado.status });
  }

  return NextResponse.json({
    ok: true,
    pdfUrl: resultado.pdfUrl,
    fechaVencimiento: resultado.fechaVencimiento,
    comprobanteUrl: resultado.comprobanteUrl,
  });
}
