// Utilidades genéricas de fechas (distintas de los días hábiles peruanos,
// que viven en lib/diasHabilesPeru.ts). Se usa, por ejemplo, para calcular
// la fecha de vencimiento de una licencia (emisión + 1 año).
export function sumarAnios(fechaIso: string, cantidadAnios: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  fecha.setUTCFullYear(fecha.getUTCFullYear() + cantidadAnios);
  return fecha.toISOString().slice(0, 10);
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2026-01-05" -> "5 de enero del 2026" (formato usado en el pie de firma
// de la licencia, ver lib/pdfLicencia.tsx).
export function formatearFechaLarga(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return `${dia} de ${MESES_ES[mes - 1]} del ${anio}`;
}
