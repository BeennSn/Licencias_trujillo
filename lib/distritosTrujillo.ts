// Alcance geográfico del sistema: solo los distritos de la Provincia de Trujillo.
// El formulario de domicilio fiscal/local debe restringirse a esta lista.
export const DISTRITOS_TRUJILLO = [
  "Trujillo",
  "El Porvenir",
  "La Esperanza",
  "Florencia de Mora",
  "Huanchaco",
  "Laredo",
  "Moche",
  "Poroto",
  "Salaverry",
  "Simbal",
  "Víctor Larco Herrera",
] as const;

export type Distrito = (typeof DISTRITOS_TRUJILLO)[number];

export function esDistritoValido(valor: string): valor is Distrito {
  return (DISTRITOS_TRUJILLO as readonly string[]).includes(valor);
}

function normalizar(texto: string): string {
  // ̀-ͯ son los diacríticos (tildes) que normalize("NFD") separa
  // de su letra base; quitarlos deja comparar "Víctor" y "VICTOR" como iguales.
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

// SUNAT devuelve el nombre del distrito sin tildes y en mayúsculas (ej.
// "VICTOR LARCO HERRERA"), que no calza exactamente con nuestra lista
// canónica (ej. "Víctor Larco Herrera"). Esto compara ignorando tildes y
// mayúsculas para poder pre-seleccionar el distrito correcto del dropdown
// a partir de un dato de SUNAT.
export function encontrarDistritoTrujillo(nombreSunat: string): Distrito | undefined {
  const objetivo = normalizar(nombreSunat);
  return DISTRITOS_TRUJILLO.find((distrito) => normalizar(distrito) === objetivo);
}
