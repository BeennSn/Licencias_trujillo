// Máquina de estados de la sesión de caja de un cajero (ver lib/db/schema.ts::cajas).
//
// Los valores deben coincidir exactamente con el enum estadoCaja en
// lib/db/schema.ts. Igual que con el expediente, ningún endpoint debe hacer
// un UPDATE de estado sin pasar antes por puedeTransicionarCaja().
export type EstadoCaja = "abierta" | "cierre_solicitado" | "cerrada";

export const TRANSICIONES_VALIDAS_CAJA: Record<EstadoCaja, EstadoCaja[]> = {
  abierta: ["cierre_solicitado"],
  cierre_solicitado: ["cerrada", "abierta"], // "abierta" = el admin rechaza el cierre
  cerrada: [], // estado terminal: para volver a operar, el cajero abre una caja nueva
};

export function puedeTransicionarCaja(actual: EstadoCaja, siguiente: EstadoCaja): boolean {
  return TRANSICIONES_VALIDAS_CAJA[actual].includes(siguiente);
}

export const ETIQUETAS_ESTADO_CAJA: Record<EstadoCaja, string> = {
  abierta: "Abierta",
  cierre_solicitado: "Cierre pendiente de aprobación",
  cerrada: "Cerrada",
};
