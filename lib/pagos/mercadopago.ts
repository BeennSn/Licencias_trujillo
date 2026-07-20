// Cobro del derecho de trámite (S/180) vía Mercado Pago.
//
// ADVERTENCIA PARA EL EQUIPO: Mercado Pago usa el MISMO endpoint para
// credenciales de prueba (empiezan con "TEST-") y de producción (empiezan
// con "APP_USR-"). El access token configurado ahora mismo es de
// PRODUCCIÓN: cualquier pago que se procese es un cobro REAL a una tarjeta/
// cuenta real (mitigado mientras se prueba: ver MONTO_TRAMITE_COBRO_REAL_SOLES
// más abajo, que reduce el monto real a S/1.80 aunque el negocio vea S/180).
// Ver: https://www.mercadopago.com.pe/developers/es/docs/checkout-api/additional-content/your-integrations/test/accounts
//
// El medio "tarjeta" usa el Card Payment Brick real de Mercado Pago
// (app/solicitud/[expedienteId]/pago/page.tsx, @mercadopago/sdk-react), que
// tokeniza la tarjeta en el navegador y entrega paymentMethodId/issuerId
// junto al token — necesarios para que este cobro sea válido. Yape/
// PagoEfectivo no usan token de tarjeta, van directo por payment_method_id
// (tampoco se probaron aún con una cuenta de producción real).
//
// Si no hay MERCADOPAGO_ACCESS_TOKEN configurada, se SIMULA la aprobación
// localmente para no bloquear el resto del flujo durante el desarrollo.
import { MONTO_TRAMITE_COBRO_REAL_SOLES } from "../constantes";

// "efectivo" nunca llega a cobrarDerechoDeTramite: es un pago presencial en
// caja que el cajero confirma directo, sin pasar por la pasarela (ver
// app/api/solicitudes/[id]/pago-presencial y app/api/cajero/renovar). Solo
// está en este tipo para que pagos.medioPago tenga un único tipo compartido.
export type MedioPago = "tarjeta" | "yape" | "pagoefectivo" | "efectivo";

export type ResultadoCobro =
  | { aprobado: true; referencia: string }
  | { aprobado: false; motivo: string };

// Para tarjeta, el frontend genera un token con el SDK de Mercado Pago
// (Card Payment Brick / MP.js) y Mercado Pago infiere el medio de pago a
// partir de ese token. Yape y PagoEfectivo en Perú no usan token de
// tarjeta: se envían directo como payment_method_id. A diferencia de una
// tarjeta (aprobación inmediata), Mercado Pago puede devolver estos como
// "pending" hasta que el cliente confirma en su app/agente; este MVP los
// trata como "no aprobado todavía" (ver comentario en la ruta de pago).
export async function cobrarDerechoDeTramite(
  tokenPago: string,
  email: string,
  medioPago: MedioPago,
  // Solo aplican a "tarjeta": los entrega el Card Payment Brick junto al
  // token. Mercado Pago los exige para procesar el cobro (identifican la
  // marca de la tarjeta y el banco emisor).
  datosTarjeta?: { paymentMethodId?: string; issuerId?: string }
): Promise<ResultadoCobro> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    // Modo simulado: un token que empiece con "token_test_fail" simula un
    // rechazo, para poder probar ese camino sin una cuenta real de Mercado Pago.
    if (tokenPago.startsWith("token_test_fail")) {
      return { aprobado: false, motivo: "Pago simulado rechazado (token de prueba de fallo)." };
    }
    return { aprobado: true, referencia: `simulado_${Date.now()}` };
  }

  const esTarjeta = medioPago === "tarjeta";

  const respuesta = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      // Cobro real reducido mientras se prueba con credenciales de
      // producción (ver MONTO_TRAMITE_COBRO_REAL_SOLES en lib/constantes.ts)
      // — el negocio ve y se le registra el monto oficial S/180, pero acá
      // solo se mueven S/1.80 de verdad.
      transaction_amount: MONTO_TRAMITE_COBRO_REAL_SOLES,
      description: "Derecho de trámite - Licencia de funcionamiento MPT",
      installments: 1,
      // Con tarjeta, el "token" es el token de tarjeta tokenizado en el
      // cliente (Card Payment Brick), junto con la marca (payment_method_id,
      // ej. "visa") y el banco emisor (issuer_id) que entrega el mismo
      // Brick; con Yape/PagoEfectivo se indica el medio directamente.
      ...(esTarjeta
        ? { token: tokenPago, payment_method_id: datosTarjeta?.paymentMethodId, issuer_id: datosTarjeta?.issuerId }
        : { payment_method_id: medioPago }),
      payer: { email },
    }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    return { aprobado: false, motivo: datos.message ?? "El pago fue rechazado por la pasarela." };
  }

  if (datos.status !== "approved") {
    return {
      aprobado: false,
      motivo:
        datos.status === "pending" || datos.status === "in_process"
          ? "El pago quedó pendiente de confirmación (frecuente en Yape/PagoEfectivo). Vuelve a intentar una vez confirmado."
          : (datos.status_detail ?? "El pago fue rechazado por la pasarela."),
    };
  }

  return { aprobado: true, referencia: String(datos.id) };
}
