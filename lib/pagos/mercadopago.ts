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
// El pago del paso D del wizard usa Checkout Pro (crearPreferenciaDeCobro
// más abajo): se redirige al negocio a la propia plataforma de Mercado
// Pago, que ya sabe procesar tarjeta, Yape y PagoEfectivo sin que este
// backend tenga que armar cada cobro a mano (eso es justo lo que fallaba
// antes: Yape/PagoEfectivo mandados directo a /v1/payments con solo
// payment_method_id nunca funcionaron con una cuenta real). El pago se
// confirma después, cuando Mercado Pago redirige de vuelta (ver
// app/api/solicitudes/[id]/pago/confirmar y lib/pagoAprobado.ts).
//
// cobrarDerechoDeTramite (cobro directo con token, sin redirección) se
// mantiene solo para el modo simulado (sin MERCADOPAGO_ACCESS_TOKEN) y para
// la renovación web (app/api/negocio/renovar), que todavía no se migró a
// Checkout Pro.
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

// Cobro directo con token, usado por la renovación web (que todavía no se
// migró a Checkout Pro, ver arriba) y por el modo simulado. El token de
// tarjeta en un uso real tendría que venir de un SDK de Mercado Pago que
// tokenice en el cliente (esta función nunca recibe el número de tarjeta
// en texto plano); Yape y PagoEfectivo van directo por payment_method_id.
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
      // Cobro real reducido mientras se prueba con credenciales de
      // producción (ver MONTO_TRAMITE_COBRO_REAL_SOLES en lib/constantes.ts)
      // — el negocio ve y se le registra el monto oficial S/180, pero acá
      // solo se mueven S/1.80 de verdad.
      transaction_amount: MONTO_TRAMITE_COBRO_REAL_SOLES,
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

export type ResultadoPreferencia =
  | { ok: true; initPoint: string }
  | { ok: false; motivo: string };

// Crea una "preferencia" de Checkout Pro: Mercado Pago devuelve un
// init_point (URL) al que se redirige al negocio para completar el pago en
// su propia plataforma, eligiendo ahí tarjeta, Yape o PagoEfectivo. Nunca
// se cobra en esta llamada — Mercado Pago avisa el resultado más tarde
// (redirección de vuelta + webhook), nunca antes.
//
// Se usa tanto para el pago inicial del wizard (app/api/solicitudes/[id]/pago)
// como para la renovación web (app/api/negocio/renovar); cada llamador arma
// su propia urlResultado porque cada uno vuelve a una página distinta.
export async function crearPreferenciaDeCobro(params: {
  expedienteId: string;
  email: string;
  urlResultado: string;
  urlNotificacion: string;
}): Promise<ResultadoPreferencia> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, motivo: "Mercado Pago no está configurado." };
  }

  const { expedienteId, email, urlResultado, urlNotificacion } = params;

  const respuesta = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      items: [
        {
          title: "Derecho de trámite - Licencia de funcionamiento MPT",
          quantity: 1,
          // Cobro real reducido mientras se prueba con credenciales de
          // producción (ver MONTO_TRAMITE_COBRO_REAL_SOLES en
          // lib/constantes.ts). OJO: a diferencia del resto del sitio (que
          // siempre muestra S/180), la propia página de Mercado Pago sí va
          // a mostrar el monto real (S/1.80) — es su checkout, no lo
          // podemos controlar, y mostrar cualquier otro monto ahí sería
          // directamente falso.
          unit_price: MONTO_TRAMITE_COBRO_REAL_SOLES,
          currency_id: "PEN",
        },
      ],
      payer: { email },
      back_urls: { success: urlResultado, failure: urlResultado, pending: urlResultado },
      auto_return: "approved",
      external_reference: expedienteId,
      notification_url: urlNotificacion,
    }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok || !datos.init_point) {
    return { ok: false, motivo: datos.message ?? "No se pudo iniciar el pago con Mercado Pago." };
  }

  return { ok: true, initPoint: datos.init_point };
}

// Aproxima nuestro MedioPago interno a partir de lo que Mercado Pago
// devuelve en un pago confirmado (usado al volver de Checkout Pro, ver
// .../pago/confirmar). Mercado Pago no siempre distingue Yape de otras
// billeteras digitales en payment_type_id, así que esto es best-effort:
// solo afecta cómo se etiqueta el pago en los reportes, no si se aprueba.
export function inferirMedioPagoDesdeMP(datosPago: { payment_type_id?: string }): MedioPago {
  const tipo = datosPago.payment_type_id ?? "";
  if (tipo === "credit_card" || tipo === "debit_card" || tipo === "prepaid_card") return "tarjeta";
  if (tipo === "ticket") return "pagoefectivo";
  return "yape";
}
