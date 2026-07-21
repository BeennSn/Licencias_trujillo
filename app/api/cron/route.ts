import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { licencias, expedientes, negocios, inspecciones, usuarios } from "@/lib/db/schema";
import { estaVencida, estaPorVencer, puedeTransicionarLicencia } from "@/lib/estadosLicencia";
import {
  enviarCorreoRecordatorioRenovacion,
  enviarCorreoRecordatorioInspeccionHoy,
  enviarCorreoRecordatorioInspeccionHoyInspector,
  enviarCorreoLicenciaVencida,
} from "@/lib/email";
import { aFechaIso } from "@/lib/diasHabilesPeru";

// Cron diario (ver vercel.json, se ejecuta 1 vez al día): (1) pasa a
// VENCIDA cualquier licencia VIGENTE cuya fecha ya pasó, para que
// listados/filtros administrativos reflejen el estado real, y le avisa al
// negocio justo en ese momento (enviarCorreoLicenciaVencida, distinto del
// recordatorio previo al vencimiento); (2) envía el
// recordatorio de renovación a las que están por vencer (dentro de 30
// días) y todavía no lo recibieron; (3) envía el recordatorio "hoy tienes
// inspección" a negocio e inspector, para las inspecciones programadas
// justo para hoy (requisito explícito: a diferencia del correo que se
// manda al agendar —que puede ser semanas antes—, este es del mismo día).
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

        const [expediente] = await db
          .select()
          .from(expedientes)
          .where(eq(expedientes.id, licencia.expedienteId))
          .limit(1);
        const [negocio] = await db.select().from(negocios).where(eq(negocios.id, licencia.negocioId)).limit(1);

        if (expediente?.emailContacto) {
          await enviarCorreoLicenciaVencida(expediente.emailContacto, negocio?.razonSocial ?? "", licencia.numeroLicencia);
        }
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

  const inspeccionesDeHoy = await db
    .select()
    .from(inspecciones)
    .where(and(eq(inspecciones.estado, "programada"), eq(inspecciones.fechaProgramada, hoy), eq(inspecciones.recordatorioDiaEnviado, false)));

  let recordatoriosInspeccion = 0;

  for (const inspeccion of inspeccionesDeHoy) {
    const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, inspeccion.expedienteId)).limit(1);
    const turno = inspeccion.turno ?? null;

    if (expediente?.emailContacto) {
      await enviarCorreoRecordatorioInspeccionHoy(expediente.emailContacto, expediente.numeroExpediente ?? "", inspeccion.tipo);
    }

    const [inspector] = await db.select().from(usuarios).where(eq(usuarios.id, inspeccion.inspectorId)).limit(1);
    if (inspector && expediente) {
      const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expediente.negocioId)).limit(1);
      await enviarCorreoRecordatorioInspeccionHoyInspector(
        inspector.email,
        expediente.numeroExpediente ?? "",
        negocio?.razonSocial ?? "",
        expediente.distrito ?? "",
        expediente.direccionLocal ?? "",
        turno,
        inspeccion.tipo
      );
    }

    await db.update(inspecciones).set({ recordatorioDiaEnviado: true }).where(eq(inspecciones.id, inspeccion.id));
    recordatoriosInspeccion++;
  }

  return NextResponse.json({
    ok: true,
    revisadas: candidatas.length,
    vencidas,
    recordatorios,
    recordatoriosInspeccion,
  });
}
