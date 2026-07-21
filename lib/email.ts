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
const AZUL_MPT = "#1b3d6d";

type Adjunto = { filename: string; content: Buffer; contentType: string };

// Envuelve el contenido de cada correo en un mismo membrete/pie de página
// (mismo azul institucional que el PDF de la licencia, ver
// lib/pdfLicencia.tsx), para que todos los correos del sistema se vean
// consistentes en vez de texto plano suelto.
function plantillaCorreo(cuerpoHtml: string): string {
  return `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
    <div style="background: ${AZUL_MPT}; padding: 18px 24px; border-radius: 6px 6px 0 0;">
      <div style="color: #ffffff; font-size: 16px; font-weight: bold;">Municipalidad Provincial de Trujillo</div>
      <div style="color: #cfe0f5; font-size: 12px;">Sistema de Licencias de Funcionamiento</div>
    </div>
    <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; font-size: 14px; line-height: 1.5;">
      ${cuerpoHtml}
    </div>
    <div style="padding: 14px 24px; font-size: 11px; color: #6b7280;">
      Este es un mensaje automático del sistema de Licencias de Funcionamiento de la Municipalidad Provincial de
      Trujillo. Por favor no respondas a este correo.
    </div>
  </div>`;
}

async function enviarCorreo(destinatario: string, asunto: string, cuerpoHtml: string, adjuntos?: Adjunto[]) {
  const html = plantillaCorreo(cuerpoHtml);
  if (!transportador) {
    console.log(
      `[email simulado] Para: ${destinatario} | Asunto: ${asunto}${adjuntos?.length ? ` | Adjuntos: ${adjuntos.map((a) => a.filename).join(", ")}` : ""}\n${html}`
    );
    return;
  }
  await transportador.sendMail({ from: FROM, to: destinatario, subject: asunto, html, attachments: adjuntos });
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

// turno puede venir null (inspecciones antiguas sin turno asignado, ver
// lib/db/schema.ts::inspecciones.turno) — en ese caso se omite del correo.
// El turno es información operativa del inspector (a qué hora del día le
// toca) y no le corresponde al negocio: solo se muestra en los correos
// dirigidos al inspector (enviarCorreo*Inspector), nunca en los del negocio.
function textoFechaTurnoInspector(fechaIso: string, turno: number | null): string {
  return turno ? `<strong>${fechaIso}</strong> (turno ${turno})` : `<strong>${fechaIso}</strong>`;
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
     <p>Puedes consultar el detalle de tu expediente con tu RUC o N° de expediente en la sección de consulta del sistema.</p>`
  );
}

// Igual que enviarCorreoInspeccionProgramada, pero dirigido al inspector
// asignado (requisito: cada vez que se programa/reprograma una inspección,
// tanto el negocio como el inspector deben recibir un correo con fecha,
// turno y datos de la visita).
export async function enviarCorreoInspeccionProgramadaInspector(
  destinatario: string,
  numeroExpediente: string,
  razonSocial: string,
  distrito: string,
  direccionLocal: string,
  fechaIso: string,
  turno: number | null,
  tipo: "primera" | "segunda"
) {
  const etiquetaTipo = tipo === "primera" ? "primera" : "segunda";
  await enviarCorreo(
    destinatario,
    `Inspección asignada - Expediente ${numeroExpediente}`,
    `<p>Se te asignó la ${etiquetaTipo} inspección técnica de <strong>${razonSocial}</strong> para el ${textoFechaTurnoInspector(fechaIso, turno)}.</p>
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
  tipo: "primera" | "segunda"
) {
  const etiquetaTipo = tipo === "primera" ? "primera" : "segunda";
  await enviarCorreo(
    destinatario,
    `Hoy tienes inspección técnica - Expediente ${numeroExpediente}`,
    `<p>Hoy es la fecha de tu ${etiquetaTipo} inspección técnica.</p>
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
  turno: number | null,
  tipo: "primera" | "segunda"
) {
  const etiquetaTipo = tipo === "primera" ? "primera" : "segunda";
  await enviarCorreo(
    destinatario,
    `Hoy tienes una inspección pendiente - Expediente ${numeroExpediente}`,
    `<p>Hoy debes cumplir con la ${etiquetaTipo} inspección técnica de <strong>${razonSocial}</strong>${turno ? ` (turno <strong>${turno}</strong>)` : ""}.</p>
     <p><strong>Dirección:</strong> ${direccionLocal}, ${distrito}</p>
     <p><strong>Expediente:</strong> ${numeroExpediente}</p>
     <p>Revisa el detalle en tu panel de inspecciones.</p>`
  );
}

// Aviso de que la licencia YA venció (distinto del recordatorio previo al
// vencimiento). Se envía justo cuando el cron transiciona la licencia de
// VIGENTE a VENCIDA (ver app/api/cron), no antes.
export async function enviarCorreoLicenciaVencida(destinatario: string, razonSocial: string, numeroLicencia: string) {
  await enviarCorreo(
    destinatario,
    `Tu licencia de funcionamiento venció - N° ${numeroLicencia}`,
    `<p>La licencia de funcionamiento de <strong>${razonSocial}</strong> (N° ${numeroLicencia}) ya venció.</p>
     <p>Acércate a la municipalidad para iniciar el trámite de renovación.</p>`
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
     <p>Acércate a la municipalidad antes de esa fecha para iniciar el trámite de renovación y evitar que tu licencia quede marcada como vencida.</p>`
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
    ? `<p>Tu inspección técnica fue conforme. Ya puedes descargar tu licencia de funcionamiento en formato PDF consultando tu RUC o N° de expediente en el sistema.</p>`
    : `<p>Tu inspección técnica tuvo observaciones:</p><p>${observaciones ?? ""}</p>
       <p>Se programará automáticamente una nueva visita si corresponde. Revisa el detalle consultando tu RUC o N° de expediente en el sistema.</p>`;
  await enviarCorreo(destinatario, asunto, cuerpo);
}

// Comprobante de pago (ver lib/comprobante.ts): se manda con el PDF
// adjunto directamente, no solo un enlace, para que quede en la bandeja del
// negocio sin depender de que el sistema siga disponible después.
export async function enviarCorreoComprobantePago(
  destinatario: string,
  datos: {
    numeroComprobante: string;
    numeroExpediente: string;
    razonSocial: string;
    montoTotal: number;
    pdfBuffer: Buffer;
  }
) {
  await enviarCorreo(
    destinatario,
    `Comprobante de pago N° ${datos.numeroComprobante} - Expediente ${datos.numeroExpediente}`,
    `<p>Adjuntamos el comprobante de tu pago de <strong>S/ ${datos.montoTotal.toFixed(2)}</strong> correspondiente al
     expediente <strong>${datos.numeroExpediente}</strong> de <strong>${datos.razonSocial}</strong>.</p>
     <p>Guarda este comprobante como constancia de tu pago.</p>`,
    [{ filename: `comprobante-${datos.numeroComprobante}.pdf`, content: datos.pdfBuffer, contentType: "application/pdf" }]
  );
}
