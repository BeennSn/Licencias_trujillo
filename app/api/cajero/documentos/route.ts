import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { negocios, expedientes, inspecciones, documentos } from "@/lib/db/schema";

// Busca, por RUC, si el negocio tiene un expediente en SEGUNDA_INSPECCION_PROGRAMADA
// cuya primera visita fue observada pidiendo explícitamente cambio de plano
// (inspecciones.requiereCambioDocumento). Si no se cumple exactamente eso,
// no se habilita nada — el cajero no puede tocar el plano "porque sí".
export async function GET(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const ruc = searchParams.get("ruc") ?? "";
  if (!/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: "El RUC debe tener 11 dígitos." }, { status: 400 });
  }

  const [negocio] = await db.select().from(negocios).where(eq(negocios.ruc, ruc)).limit(1);
  if (!negocio) {
    return NextResponse.json({ error: "No se encontró ningún negocio registrado con ese RUC." }, { status: 404 });
  }

  const [expediente] = await db
    .select()
    .from(expedientes)
    .where(and(eq(expedientes.negocioId, negocio.id), eq(expedientes.estado, "SEGUNDA_INSPECCION_PROGRAMADA")))
    .orderBy(desc(expedientes.createdAt))
    .limit(1);

  if (!expediente) {
    return NextResponse.json({ elegible: false, motivo: "Este negocio no tiene un trámite esperando la segunda inspección." });
  }

  const [primeraInspeccion] = await db
    .select()
    .from(inspecciones)
    .where(and(eq(inspecciones.expedienteId, expediente.id), eq(inspecciones.tipo, "primera")))
    .orderBy(desc(inspecciones.createdAt))
    .limit(1);

  if (!primeraInspeccion?.requiereCambioDocumento) {
    return NextResponse.json({
      elegible: false,
      motivo: "El inspector no pidió cambio de plano para este negocio.",
    });
  }

  const [documentoActual] = await db.select().from(documentos).where(eq(documentos.expedienteId, expediente.id)).limit(1);

  return NextResponse.json({
    elegible: true,
    expedienteId: expediente.id,
    razonSocial: negocio.razonSocial,
    observaciones: primeraInspeccion.observaciones,
    documentoActual: documentoActual?.urlArchivo ?? null,
  });
}
