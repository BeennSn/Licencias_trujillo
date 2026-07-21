import {
  ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS,
  ESTADOS_QUE_PERMITEN_PAGAR,
  type EstadoExpediente,
} from "./estadosExpediente";

type ExpedienteResumen = {
  distrito: string | null;
  estado: EstadoExpediente;
};

// OJO: DOCUMENTOS_COMPLETOS habilita a la vez el paso "documentos" (el
// negocio puede corregir un documento antes de pagar) y el paso "pago". Por
// eso cada página del wizard valida su propio acceso con estas funciones en
// vez de compararse contra un único "paso actual" — un solo valor no puede
// representar que dos páginas sean válidas al mismo tiempo.

export function puedeVerDocumentos(expediente: ExpedienteResumen): boolean {
  return Boolean(expediente.distrito) && ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS.includes(expediente.estado);
}

export function puedeVerPago(expediente: ExpedienteResumen): boolean {
  return Boolean(expediente.distrito) && ESTADOS_QUE_PERMITEN_PAGAR.includes(expediente.estado);
}

// Paso al que mandar al negocio cuando la página que pidió no le corresponde
// todavía (avanzar sin terminar el paso anterior) o ya quedó atrás
// (retroceder a un paso ya completado). Se usa solo como destino de
// redirección, no como fuente de verdad de "qué página es válida ahora".
//
// `pasoPago` permite que una sesión de cajero (pago presencial en efectivo,
// ver app/solicitud/[expedienteId]/pago-presencial) redirija a su propio
// paso de pago en vez del paso web con la pasarela de Mercado Pago.
//
// No existe un paso de "crear cuenta": el trámite ya no requiere login, así
// que una vez pagado (sin nada más que editar) el destino final es siempre
// la pantalla de confirmación, donde se explica que el estado y la licencia
// se consultan por RUC/N° de expediente (ver app/consulta).
export function pasoPorDefecto(expediente: ExpedienteResumen, pasoPago: string = "pago"): string {
  if (!expediente.distrito) return "domicilio";
  if (puedeVerDocumentos(expediente)) return "documentos";
  if (puedeVerPago(expediente)) return pasoPago;
  return "confirmacion";
}
