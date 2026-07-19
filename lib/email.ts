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

export async function enviarCorreoInspeccionProgramada(
  destinatario: string,
  numeroExpediente: string,
  fechaIso: string,
  tipo: "primera" | "segunda"
) {
  const etiquetaTipo = tipo === "primera" ? "primera" : "segunda";
  await enviarCorreo(
    destinatario,
    `Inspección técnica programada - Expediente ${numeroExpediente}`,
    `<p>Se programó la ${etiquetaTipo} inspección técnica de tu local para el <strong>${fechaIso}</strong>.</p>
     <p>Puedes ver el detalle de tu expediente ingresando a tu cuenta.</p>`
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
