import { NextResponse } from "next/server";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { negocios, expedientes } from "@/lib/db/schema";
import { esquemaRuc } from "@/lib/validaciones";
import { generarNumeroExpediente } from "@/lib/numeracion";

// Paso A del wizard: crea (o reutiliza) el negocio por RUC y abre un
// expediente nuevo en estado BORRADOR. Si el negocio ya tiene un expediente
// en trámite (no terminal), se reutiliza ese en vez de crear uno duplicado.
export async function POST(request: Request) {
  const cuerpo = await request.json();
  const analisis = esquemaRuc.safeParse(cuerpo);

  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const { ruc } = analisis.data;
  const razonSocial: string | undefined = cuerpo.razonSocial;
  const estadoSunat: string | undefined = cuerpo.estadoSunat;
  const condicionHabido: string | undefined = cuerpo.condicionHabido;

  if (!razonSocial) {
    return NextResponse.json({ error: "Falta la razón social del negocio." }, { status: 400 });
  }

  let [negocio] = await db.select().from(negocios).where(eq(negocios.ruc, ruc)).limit(1);

  if (!negocio) {
    [negocio] = await db
      .insert(negocios)
      .values({ ruc, razonSocial, estadoSunat, condicionHabido })
      .returning();
  }

  const [expedienteEnTramite] = await db
    .select()
    .from(expedientes)
    .where(
      and(
        eq(expedientes.negocioId, negocio.id),
        notInArray(expedientes.estado, ["APROBADA", "RECHAZADA"])
      )
    )
    .limit(1);

  if (expedienteEnTramite) {
    return NextResponse.json({
      expedienteId: expedienteEnTramite.id,
      numeroExpediente: expedienteEnTramite.numeroExpediente,
      reanudado: true,
    });
  }

  const numeroExpediente = await generarNumeroExpediente();

  const [expediente] = await db
    .insert(expedientes)
    .values({
      numeroExpediente,
      negocioId: negocio.id,
      tipo: "nueva",
      estado: "BORRADOR",
    })
    .returning();

  return NextResponse.json({
    expedienteId: expediente.id,
    numeroExpediente: expediente.numeroExpediente,
    reanudado: false,
  });
}
