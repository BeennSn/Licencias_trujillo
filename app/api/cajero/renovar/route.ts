import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { negocios, licencias, expedientes } from "@/lib/db/schema";
import { ejecutarRenovacion } from "@/lib/renovacion";

// Renovación presencial: el cajero busca el negocio por RUC y cobra en
// efectivo en caja (sin pasarela). Misma regla de negocio y misma emisión
// de licencia que la renovación web (ver lib/renovacion.ts): automática con
// solo el pago, sin inspección, siempre que sea el mismo local — por eso no
// se pide "mismo local" acá tampoco, ya que en caja el negocio se presenta
// físicamente a renovar su local existente.
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
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

  const resultado = await ejecutarRenovacion({
    negocioId: negocio.id,
    medioPago: "efectivo",
    canal: "presencial",
    registradoPorId: sesion.user.id,
    emailNotificacion,
    resolverPago: async () => ({ aprobado: true, referencia: `caja_${sesion.user.id}_${Date.now()}` }),
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, pagoId: resultado.pagoId }, { status: resultado.status });
  }

  return NextResponse.json({
    ok: true,
    razonSocial: negocio.razonSocial,
    pdfUrl: resultado.pdfUrl,
    fechaVencimiento: resultado.fechaVencimiento,
  });
}
