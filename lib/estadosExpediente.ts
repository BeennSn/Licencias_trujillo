// Máquina de estados del expediente (la "solicitud" de licencia).
//
// Los valores deben coincidir exactamente con el enum estadoExpediente en
// lib/db/schema.ts. Ningún endpoint debe hacer un UPDATE de estado sin pasar
// antes por puedeTransicionar(), así el flujo completo queda auditable desde
// un solo archivo.
export type EstadoExpediente =
  | "BORRADOR"
  | "DOCUMENTOS_COMPLETOS"
  | "PAGO_PENDIENTE"
  | "PAGO_APROBADO"
  | "PRIMERA_INSPECCION_PROGRAMADA"
  | "SEGUNDA_INSPECCION_PROGRAMADA"
  | "APROBADA"
  | "RECHAZADA";

export const TRANSICIONES_VALIDAS: Record<EstadoExpediente, EstadoExpediente[]> = {
  BORRADOR: ["DOCUMENTOS_COMPLETOS"],
  DOCUMENTOS_COMPLETOS: ["PAGO_PENDIENTE"],
  PAGO_PENDIENTE: ["PAGO_APROBADO", "PAGO_PENDIENTE"], // reintento tras pago rechazado
  PAGO_APROBADO: ["PRIMERA_INSPECCION_PROGRAMADA"],
  PRIMERA_INSPECCION_PROGRAMADA: ["APROBADA", "SEGUNDA_INSPECCION_PROGRAMADA"],
  SEGUNDA_INSPECCION_PROGRAMADA: ["APROBADA", "RECHAZADA"],
  APROBADA: [],
  RECHAZADA: [], // estado terminal: para reintentar se crea un expediente nuevo
};

export function puedeTransicionar(actual: EstadoExpediente, siguiente: EstadoExpediente): boolean {
  return TRANSICIONES_VALIDAS[actual].includes(siguiente);
}

export const ETIQUETAS_ESTADO_EXPEDIENTE: Record<EstadoExpediente, string> = {
  BORRADOR: "Borrador",
  DOCUMENTOS_COMPLETOS: "Documentos completos",
  PAGO_PENDIENTE: "Pago pendiente",
  PAGO_APROBADO: "Pago aprobado",
  PRIMERA_INSPECCION_PROGRAMADA: "Primera inspección programada",
  SEGUNDA_INSPECCION_PROGRAMADA: "Segunda inspección programada",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};
