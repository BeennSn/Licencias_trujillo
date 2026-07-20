import {
  ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS,
  ESTADOS_QUE_PERMITEN_PAGAR,
  ESTADOS_SIN_PAGO_APROBADO,
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

export function puedeVerCuenta(expediente: ExpedienteResumen): boolean {
  return Boolean(expediente.distrito) && !ESTADOS_SIN_PAGO_APROBADO.includes(expediente.estado);
}

// Paso al que mandar al negocio cuando la página que pidió no le corresponde
// todavía (avanzar sin terminar el paso anterior) o ya quedó atrás
// (retroceder a un paso ya completado). Se usa solo como destino de
// redirección, no como fuente de verdad de "qué página es válida ahora".
//
// `pasoPago` permite que una sesión de cajero (pago presencial en efectivo,
// ver app/solicitud/[expedienteId]/pago-presencial) redirija a su propio
// paso de pago en vez del paso web con la pasarela de Mercado Pago.
export function pasoPorDefecto(expediente: ExpedienteResumen, pasoPago: string = "pago"): string {
  if (!expediente.distrito) return "domicilio";
  if (puedeVerDocumentos(expediente)) return "documentos";
  if (puedeVerPago(expediente)) return pasoPago;
  return "cuenta";
}
