// Envía la notificación de inspección programada/reprogramada al negocio y,
// opcionalmente, al inspector asignado. Se usa en los tres puntos donde se
// agenda una inspección: pago web, pago presencial y la segunda inspección
// automática tras observaciones en la primera visita. En este último caso
// el profesor pidió explícitamente que la reprogramación se notifique solo
// al negocio (el inspector se entera por su panel del día llegada la
// fecha), por eso notificarInspector es un parámetro y no un valor fijo.
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { usuarios, inspecciones, expedientes, negocios } from "./db/schema";
import { enviarCorreoInspeccionProgramada, enviarCorreoInspeccionProgramadaInspector } from "./email";

export async function notificarInspeccionProgramada(params: {
  inspeccion: typeof inspecciones.$inferSelect;
  expediente: typeof expedientes.$inferSelect;
  notificarInspector?: boolean;
}) {
  const { inspeccion, expediente, notificarInspector = true } = params;
  const horaTexto = inspeccion.horaProgramada ?? "";

  if (expediente.emailContacto) {
    await enviarCorreoInspeccionProgramada(
      expediente.emailContacto,
      expediente.numeroExpediente ?? "",
      inspeccion.fechaProgramada,
      horaTexto,
      inspeccion.tipo
    );
  }

  if (!notificarInspector) return;

  const [inspector] = await db.select().from(usuarios).where(eq(usuarios.id, inspeccion.inspectorId)).limit(1);
  if (!inspector) return;

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expediente.negocioId)).limit(1);

  await enviarCorreoInspeccionProgramadaInspector(
    inspector.email,
    expediente.numeroExpediente ?? "",
    negocio?.razonSocial ?? "",
    expediente.distrito ?? "",
    expediente.direccionLocal ?? "",
    inspeccion.fechaProgramada,
    horaTexto,
    inspeccion.tipo
  );
}
