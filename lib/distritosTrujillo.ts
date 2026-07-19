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
