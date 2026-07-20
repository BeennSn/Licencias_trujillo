import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { licencias, expedientes, negocios } from "@/lib/db/schema";
import { estaVencida, estaPorVencer, puedeTransicionarLicencia } from "@/lib/estadosLicencia";
import { enviarCorreoRecordatorioRenovacion } from "@/lib/email";
import { aFechaIso } from "@/lib/diasHabilesPeru";

// Cron diario (ver vercel.json, se ejecuta 1 vez al día): (1) pasa a
// VENCIDA cualquier licencia VIGENTE cuya fecha ya pasó, para que
// listados/filtros administrativos reflejen el estado real; (2) envía el
// recordatorio de renovación a las que están por vencer (dentro de 30
// días) y todavía no lo recibieron.
//
// OJO: la marca de agua "VENCIDA" del PDF NO depende de este cron — se
// calcula en vivo en app/api/licencias/[id]/pdf comparando la fecha
// directamente, así que nunca queda desactualizada aunque este cron no
// haya corrido todavía ese día. Este cron solo mantiene el campo
// licencias.estado consistente y dispara el recordatorio.
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const autorizacion = request.headers.get("authorization");
  if (!secreto || autorizacion !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const hoy = aFechaIso(new Date());
  const candidatas = await db.select().from(licencias).where(eq(licencias.estado, "VIGENTE"));

  let vencidas = 0;
  let recordatorios = 0;

  for (const licencia of candidatas) {
    if (estaVencida(licencia.fechaVencimiento, hoy)) {
      if (puedeTransicionarLicencia(licencia.estado, "VENCIDA")) {
        await db.update(licencias).set({ estado: "VENCIDA" }).where(eq(licencias.id, licencia.id));
        vencidas++;
      }
      continue;
    }

    if (!licencia.recordatorioRenovacionEnviado && estaPorVencer(licencia.fechaVencimiento, hoy)) {
      const [expediente] = await db
        .select()
        .from(expedientes)
        .where(eq(expedientes.id, licencia.expedienteId))
        .limit(1);
      const [negocio] = await db.select().from(negocios).where(eq(negocios.id, licencia.negocioId)).limit(1);

      if (expediente?.emailContacto) {
        await enviarCorreoRecordatorioRenovacion(expediente.emailContacto, negocio?.razonSocial ?? "", licencia.fechaVencimiento);
      }

      await db.update(licencias).set({ recordatorioRenovacionEnviado: true }).where(eq(licencias.id, licencia.id));
      recordatorios++;
    }
  }

  return NextResponse.json({ ok: true, revisadas: candidatas.length, vencidas, recordatorios });
}
