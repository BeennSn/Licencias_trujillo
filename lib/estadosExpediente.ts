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
// no se tocan por esta vía. SEGUNDA_INSPECCION_PROGRAMADA es la excepción:
// el profesor pidió que el negocio pueda corregir/volver a presentar los
// documentos que le faltaron entre la 1ra y la 2da inspección.
export const ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS: EstadoExpediente[] = [
  "BORRADOR",
  "DOCUMENTOS_COMPLETOS",
  "SEGUNDA_INSPECCION_PROGRAMADA",
];

// Estados en los que se puede pagar el derecho de trámite (paso D). Ojo:
// DOCUMENTOS_COMPLETOS también está en ESTADOS_QUE_PERMITEN_EDITAR_DOCUMENTOS
// — mientras el pago no arranca, tanto el paso de documentos como el de pago
// son accesibles al mismo tiempo (el negocio puede volver a corregir un
// documento antes de pagar).
export const ESTADOS_QUE_PERMITEN_PAGAR: EstadoExpediente[] = ["DOCUMENTOS_COMPLETOS", "PAGO_PENDIENTE"];

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
