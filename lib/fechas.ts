// Utilidades genéricas de fechas (distintas de los días hábiles peruanos,
// que viven en lib/diasHabilesPeru.ts). Se usa, por ejemplo, para calcular
// la fecha de vencimiento de una licencia (emisión + 1 año).
export function sumarAnios(fechaIso: string, cantidadAnios: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  fecha.setUTCFullYear(fecha.getUTCFullYear() + cantidadAnios);
  return fecha.toISOString().slice(0, 10);
}
