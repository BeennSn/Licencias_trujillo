// Envía la notificación de inspección programada/reprogramada tanto al
// negocio como al inspector asignado (requisito: cada vez que se agenda o
// reagenda una visita, ambos deben enterarse por correo con fecha, hora y
// datos de la visita). Se usa en los tres puntos donde se agenda una
// inspección: pago web, pago presencial y la segunda inspección automática
// tras observaciones en la primera visita.
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { usuarios, inspecciones, expedientes, negocios } from "./db/schema";
import { enviarCorreoInspeccionProgramada, enviarCorreoInspeccionProgramadaInspector } from "./email";

export async function notificarInspeccionProgramada(params: {
  inspeccion: typeof inspecciones.$inferSelect;
  expediente: typeof expedientes.$inferSelect;
}) {
  const { inspeccion, expediente } = params;
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
