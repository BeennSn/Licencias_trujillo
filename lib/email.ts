// Envío de correos por SMTP (Gmail: smtp.gmail.com, con una contraseña de
// aplicación, no la contraseña normal de la cuenta). Plantillas simples en
// texto/HTML plano, suficientes para el MVP (sin diseño elaborado). Si
// SMTP_HOST no está configurado, se registra en consola en vez de fallar,
// para no romper el flujo completo durante desarrollo local sin
// credenciales.
import nodemailer from "nodemailer";

const transportador = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const FROM = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "notificaciones@licencias-trujillo.pe";

async function enviarCorreo(destinatario: string, asunto: string, cuerpoHtml: string) {
  if (!transportador) {
    console.log(`[email simulado] Para: ${destinatario} | Asunto: ${asunto}\n${cuerpoHtml}`);
    return;
  }
  await transportador.sendMail({ from: FROM, to: destinatario, subject: asunto, html: cuerpoHtml });
}

export async function enviarCorreoRecuperacion(destinatario: string, enlace: string) {
  await enviarCorreo(
    destinatario,
    "Recupera tu contraseña - Licencias de Funcionamiento Trujillo",
    `<p>Recibimos una solicitud para restablecer tu contraseña.</p>
     <p><a href="${enlace}">Haz clic aquí para crear una nueva contraseña</a> (el enlace expira en 1 hora).</p>
     <p>Si no fuiste tú, ignora este correo.</p>`
  );
}

// horaTexto puede venir vacío (inspecciones antiguas sin hora asignada, ver
// lib/db/schema.ts::inspecciones.horaProgramada) — en ese caso se omite del
// correo en vez de mostrar "a las".
function textoFechaHora(fechaIso: string, horaTexto: string): string {
  return horaTexto ? `<strong>${fechaIso}</strong> a las <strong>${horaTexto}</strong>` : `<strong>${fechaIso}</strong>`;
}

export async function enviarCorreoInspeccionProgramada(
  destinatario: string,
  numeroExpediente: string,
  fechaIso: string,
  horaTexto: string,
  tipo: "primera" | "segunda"
) {
  const etiquetaTipo = tipo === "primera" ? "primera" : "segunda";
  await enviarCorreo(
    destinatario,
    `Inspección técnica programada - Expediente ${numeroExpediente}`,
    `<p>Se programó la ${etiquetaTipo} inspección técnica de tu local para el ${textoFechaHora(fechaIso, horaTexto)}.</p>
     <p>Puedes ver el detalle de tu expediente ingresando a tu cuenta.</p>`
  );
}

// Igual que enviarCorreoInspeccionProgramada, pero dirigido al inspector
// asignado (requisito: cada vez que se programa/reprograma una inspección,
// tanto el negocio como el inspector deben recibir un correo con fecha,
// hora y datos de la visita).
export async function enviarCorreoInspeccionProgramadaInspector(
  destinatario: string,
  numeroExpediente: string,
  razonSocial: string,
  distrito: string,
  direccionLocal: string,
  fechaIso: string,
  horaTexto: string,
  tipo: "primera" | "segunda"
) {
  const etiquetaTipo = tipo === "primera" ? "primera" : "segunda";
  await enviarCorreo(
    destinatario,
    `Inspección asignada - Expediente ${numeroExpediente}`,
    `<p>Se te asignó la ${etiquetaTipo} inspección técnica de <strong>${razonSocial}</strong> para el ${textoFechaHora(fechaIso, horaTexto)}.</p>
     <p><strong>Dirección:</strong> ${direccionLocal}, ${distrito}</p>
     <p><strong>Expediente:</strong> ${numeroExpediente}</p>
     <p>Revisa el detalle en tu panel de inspecciones.</p>`
  );
}

// Recordatorio del MISMO DÍA de la inspección ("hoy tienes inspección"),
// distinto de enviarCorreoInspeccionProgramada (que avisa al momento de
// agendar, que puede ser semanas antes). Ver app/api/cron.
export async function enviarCorreoRecordatorioInspeccionHoy(
  destinatario: string,
  numeroExpediente: string,
  horaTexto: string,
  tipo: "primera" | "segunda"
) {
  const etiquetaTipo = tipo === "primera" ? "primera" : "segunda";
  await enviarCorreo(
    destinatario,
    `Hoy tienes inspección técnica - Expediente ${numeroExpediente}`,
    `<p>Hoy es la fecha de tu ${etiquetaTipo} inspección técnica${horaTexto ? ` (a las <strong>${horaTexto}</strong>)` : ""}.</p>
     <p>Un inspector municipal visitará tu local para verificar tu documentación.</p>`
  );
}

// Igual que enviarCorreoRecordatorioInspeccionHoy, pero para el inspector
// asignado.
export async function enviarCorreoRecordatorioInspeccionHoyInspector(
  destinatario: string,
  numeroExpediente: string,
  razonSocial: string,
  distrito: string,
  direccionLocal: string,
  horaTexto: string,
  tipo: "primera" | "segunda"
) {
  const etiquetaTipo = tipo === "primera" ? "primera" : "segunda";
  await enviarCorreo(
    destinatario,
    `Hoy tienes una inspección pendiente - Expediente ${numeroExpediente}`,
    `<p>Hoy debes cumplir con la ${etiquetaTipo} inspección técnica de <strong>${razonSocial}</strong>${horaTexto ? ` (a las <strong>${horaTexto}</strong>)` : ""}.</p>
     <p><strong>Dirección:</strong> ${direccionLocal}, ${distrito}</p>
     <p><strong>Expediente:</strong> ${numeroExpediente}</p>
     <p>Revisa el detalle en tu panel de inspecciones.</p>`
  );
}

// Recordatorio de renovación (ver app/api/cron): se envía una sola vez por
// licencia, dentro de la ventana de estaPorVencer (30 días antes de vencer).
export async function enviarCorreoRecordatorioRenovacion(
  destinatario: string,
  razonSocial: string,
  fechaVencimiento: string
) {
  await enviarCorreo(
    destinatario,
    "Tu licencia de funcionamiento vence pronto",
    `<p>La licencia de funcionamiento de <strong>${razonSocial}</strong> vence el <strong>${fechaVencimiento}</strong>.</p>
     <p>Inicia el trámite de renovación desde tu cuenta antes de esa fecha para evitar que tu licencia quede marcada como vencida.</p>`
  );
}

export async function enviarCorreoDecisionInspeccion(
  destinatario: string,
  numeroExpediente: string,
  aprobado: boolean,
  observaciones?: string
) {
  const asunto = aprobado
    ? `Licencia aprobada - Expediente ${numeroExpediente}`
    : `Observaciones en tu inspección - Expediente ${numeroExpediente}`;
  const cuerpo = aprobado
    ? `<p>Tu inspección técnica fue conforme. Ya puedes descargar tu licencia de funcionamiento en formato PDF desde tu cuenta.</p>`
    : `<p>Tu inspección técnica tuvo observaciones:</p><p>${observaciones ?? ""}</p>
       <p>Se programará automáticamente una nueva visita si corresponde. Revisa el detalle en tu cuenta.</p>`;
  await enviarCorreo(destinatario, asunto, cuerpo);
}
