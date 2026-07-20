// Envío de correos con Resend. Plantillas simples en texto/HTML plano,
// suficientes para el MVP (sin diseño elaborado). Si RESEND_API_KEY no está
// configurada, se registra en consola en vez de fallar, para no romper el
// flujo completo durante desarrollo local sin credenciales.
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? "notificaciones@licencias-trujillo.pe";

async function enviarCorreo(destinatario: string, asunto: string, cuerpoHtml: string) {
  if (!resend) {
    console.log(`[email simulado] Para: ${destinatario} | Asunto: ${asunto}\n${cuerpoHtml}`);
    return;
  }
  await resend.emails.send({ from: FROM, to: destinatario, subject: asunto, html: cuerpoHtml });
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
