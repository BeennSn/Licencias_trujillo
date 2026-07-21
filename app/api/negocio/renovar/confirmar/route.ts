import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes } from "@/lib/db/schema";
import { completarRenovacionAprobada } from "@/lib/renovacion";
import { inferirMedioPagoDesdeMP } from "@/lib/pagos/mercadopago";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";

// Cuando el negocio vuelve de la plataforma de Mercado Pago (Checkout Pro,
// ver .../renovar), el frontend llama acá con el payment_id que viene en la
// URL. Por seguridad, NUNCA se confía en el status que venga en la URL:
// siempre se vuelve a consultar el pago con nuestro access token, y se
// verifica que el expediente de renovación (external_reference) pertenezca
// al negocio de la sesión actual.
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "negocio") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

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
  const expedienteId: string | undefined = datosPago.external_reference;

  if (!expedienteId) {
    return NextResponse.json({ error: "El pago no tiene un expediente asociado." }, { status: 400 });
  }

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);

  if (!expediente || expediente.negocioId !== sesion.user.negocioId) {
    return NextResponse.json({ error: "El pago no corresponde a tu cuenta." }, { status: 400 });
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

  const completado = await completarRenovacionAprobada({
    expedienteId,
    pagosRealizados: [
      { medioPago: inferirMedioPagoDesdeMP(datosPago), monto: MONTO_TRAMITE_SOLES, referenciaPago: String(datosPago.id) },
    ],
    canal: "web",
    emailNotificacion: sesion.user.email ?? "",
  });

  if (!completado.ok) {
    return NextResponse.json({ error: completado.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    pdfUrl: completado.pdfUrl,
    fechaVencimiento: completado.fechaVencimiento,
    comprobanteUrl: completado.comprobanteUrl,
  });
}
