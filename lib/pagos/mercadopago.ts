// Cobro del derecho de trámite (S/180) vía Mercado Pago.
//
// ADVERTENCIA PARA EL EQUIPO: Mercado Pago usa el MISMO endpoint para
// credenciales de prueba (empiezan con "TEST-") y de producción (empiezan
// con "APP_USR-"). Si ponen su access token de PRODUCCIÓN en
// MERCADOPAGO_ACCESS_TOKEN, cualquier pago que se procese será un cobro
// REAL. Para desarrollo y para la demo de la expo, usen un usuario de
// prueba (Mercado Pago > Tus integraciones > la app > "Cuentas de prueba")
// y solo cambien al access token de producción cuando de verdad quieran
// cobrar. Ver: https://www.mercadopago.com.pe/developers/es/docs/checkout-api/additional-content/your-integrations/test/accounts
//
// Si no hay MERCADOPAGO_ACCESS_TOKEN configurada, se SIMULA la aprobación
// localmente para no bloquear el resto del flujo durante el desarrollo.
import { MONTO_TRAMITE_SOLES } from "../constantes";

export type MedioPago = "tarjeta" | "yape" | "pagoefectivo";

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
  medioPago: MedioPago
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
      transaction_amount: MONTO_TRAMITE_SOLES,
      description: "Derecho de trámite - Licencia de funcionamiento MPT",
      installments: 1,
      // Con tarjeta, el "token" es el token de tarjeta tokenizado en el
      // cliente; con Yape/PagoEfectivo se indica el medio directamente.
      ...(esTarjeta ? { token: tokenPago } : { payment_method_id: medioPago }),
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
