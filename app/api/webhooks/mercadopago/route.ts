import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pagos } from "@/lib/db/schema";

// Respaldo asíncrono: el cobro ya se confirma de forma síncrona en
// /api/solicitudes/[id]/pago y /api/negocio/renovar, pero Mercado Pago
// también notifica el resultado final por webhook (relevante sobre todo
// para Yape/PagoEfectivo, que pueden quedar "pending" hasta que el cliente
// confirma). Este endpoint es idempotente: si el pago ya estaba aprobado,
// no hace nada.
//
// Mercado Pago solo dice "cambió el pago X"; por seguridad NUNCA se confía
// en el estado que venga en el body, siempre se vuelve a consultar la API
// con el access token del servidor. Ver:
// https://www.mercadopago.com.pe/developers/es/docs/checkout-api/additional-content/notifications/webhooks
function firmaValida(request: Request, dataId: string): boolean {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto) return true; // sin secreto configurado, no se valida (solo para desarrollo)

  const firmaHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!firmaHeader || !requestId) return false;

  const partes = Object.fromEntries(
    firmaHeader.split(",").map((parte) => parte.trim().split("=", 2) as [string, string])
  );
  const { ts, v1: firmaRecibida } = partes;
  if (!ts || !firmaRecibida) return false;

  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const firmaCalculada = createHmac("sha256", secreto).update(manifiesto).digest("hex");

  return firmaCalculada === firmaRecibida;
}

export async function POST(request: Request) {
  const cuerpoTexto = await request.text();
  const evento = cuerpoTexto ? JSON.parse(cuerpoTexto) : {};

  const { searchParams } = new URL(request.url);
  const dataId: string | undefined = evento?.data?.id ?? searchParams.get("data.id") ?? undefined;

  if (!dataId) {
    return NextResponse.json({ ok: true }); // notificación sin id útil, se ignora
  }

  if (!firmaValida(request, dataId)) {
    return NextResponse.json({ error: "Firma de webhook inválida." }, { status: 401 });
  }

  const [pago] = await db.select().from(pagos).where(eq(pagos.referenciaPago, dataId)).limit(1);
  if (!pago || pago.estado === "aprobado") {
    return NextResponse.json({ ok: true });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ ok: true }); // sin credenciales reales, no hay nada que confirmar
  }

  const respuesta = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const datosPago = await respuesta.json();

  await db
    .update(pagos)
    .set({ estado: datosPago.status === "approved" ? "aprobado" : "rechazado" })
    .where(eq(pagos.id, pago.id));

  return NextResponse.json({ ok: true });
}
