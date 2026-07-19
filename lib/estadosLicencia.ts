// Máquina de estados de la licencia ya emitida (distinta de la del expediente).
// Los valores deben coincidir con el enum estadoLicencia en lib/db/schema.ts.
export type EstadoLicencia = "VIGENTE" | "VENCIDA" | "RENOVADA" | "CLAUSURADA";

export const TRANSICIONES_VALIDAS_LICENCIA: Record<EstadoLicencia, EstadoLicencia[]> = {
  VIGENTE: ["VENCIDA", "RENOVADA", "CLAUSURADA"],
  VENCIDA: ["RENOVADA", "CLAUSURADA"],
  RENOVADA: ["CLAUSURADA"],
  CLAUSURADA: [],
};

export function puedeTransicionarLicencia(actual: EstadoLicencia, siguiente: EstadoLicencia): boolean {
  return TRANSICIONES_VALIDAS_LICENCIA[actual].includes(siguiente);
}

// "Por vencer" no se guarda en BD: se deriva comparando fechaVencimiento con hoy.
// Se usa para mostrar el botón de renovación con anticipación.
const DIAS_ANTICIPACION_RENOVACION = 30;

export function estaPorVencer(fechaVencimientoIso: string, hoyIso: string): boolean {
  const vencimiento = new Date(`${fechaVencimientoIso}T00:00:00.000Z`).getTime();
  const hoy = new Date(`${hoyIso}T00:00:00.000Z`).getTime();
  const diasRestantes = Math.round((vencimiento - hoy) / (24 * 60 * 60 * 1000));
  return diasRestantes <= DIAS_ANTICIPACION_RENOVACION;
}

export function estaVencida(fechaVencimientoIso: string, hoyIso: string): boolean {
  return fechaVencimientoIso < hoyIso;
}
