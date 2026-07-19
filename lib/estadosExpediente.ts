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

// Estados en los que todavía se pueden subir/eliminar documentos (paso C).
// Una vez que el pago arrancó (PAGO_PENDIENTE en adelante) los documentos ya
// no se tocan por esta vía.
export const ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS: EstadoExpediente[] = ["BORRADOR", "DOCUMENTOS_COMPLETOS"];

// Estados en los que el pago (paso D) todavía no quedó aprobado. Se usa para
// impedir que se salten pasos por URL directa (ej. crear la cuenta del paso
// E sin haber pagado).
export const ESTADOS_SIN_PAGO_APROBADO: EstadoExpediente[] = ["BORRADOR", "DOCUMENTOS_COMPLETOS", "PAGO_PENDIENTE"];

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
