import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { negocios, licencias, expedientes } from "@/lib/db/schema";
import { iniciarExpedienteRenovacion } from "@/lib/renovacion";
import { exigirCajaAbierta } from "@/lib/caja";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";

// Primer paso de la renovación presencial: busca al negocio por RUC, valida
// que tenga una licencia elegible y crea el expediente de renovación
// (PAGO_PENDIENTE), sin cobrar todavía. Separado del cobro (ver .../confirmar)
// para que el cajero pueda, entre medio, reemplazar el plano si el negocio
// cambió algo en el local (ver .../[expedienteId]/documento).
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const caja = await exigirCajaAbierta(sesion.user.id);
  if (!caja) {
    return NextResponse.json({ error: "Debes abrir tu caja antes de registrar un trámite." }, { status: 409 });
  }

  const cuerpo = await request.json();
  const ruc = typeof cuerpo.ruc === "string" ? cuerpo.ruc.trim() : "";
  if (!/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: "El RUC debe tener 11 dígitos." }, { status: 400 });
  }

  const [negocio] = await db.select().from(negocios).where(eq(negocios.ruc, ruc)).limit(1);
  if (!negocio) {
    return NextResponse.json({ error: "No se encontró ningún negocio registrado con ese RUC." }, { status: 404 });
  }

  const [licenciaActual] = await db
    .select()
    .from(licencias)
    .where(eq(licencias.negocioId, negocio.id))
    .orderBy(desc(licencias.createdAt))
    .limit(1);

  if (!licenciaActual || licenciaActual.estado === "CLAUSURADA") {
    return NextResponse.json({ error: "Este negocio no tiene una licencia elegible para renovar." }, { status: 409 });
  }

  const [expedienteActual] = await db
    .select()
    .from(expedientes)
    .where(eq(expedientes.id, licenciaActual.expedienteId))
    .limit(1);

  const emailNotificacion = expedienteActual?.emailContacto;
  if (!emailNotificacion) {
    return NextResponse.json(
      { error: "Este negocio no tiene un correo de contacto registrado para notificarle la renovación." },
      { status: 409 }
    );
  }

  const inicio = await iniciarExpedienteRenovacion(negocio.id);
  if (!inicio.ok) {
    return NextResponse.json({ error: inicio.error }, { status: inicio.status });
  }

  return NextResponse.json({
    ok: true,
    expedienteId: inicio.expedienteId,
    razonSocial: negocio.razonSocial,
    monto: MONTO_TRAMITE_SOLES,
  });
}
