// Feriados nacionales del Perú, por año, en formato ISO (YYYY-MM-DD).
//
// IMPORTANTE: Jueves Santo y Viernes Santo son feriados móviles (dependen de
// la fecha de Semana Santa) y deben actualizarse a mano cada enero para el
// año siguiente. El resto son fechas fijas. Esta lista es intencionalmente
// una constante editable y no un cálculo automático, para mantener el
// código simple y auditable por cualquiera del equipo.
export const FERIADOS_PERU: Record<number, string[]> = {
  2025: [
    "2025-01-01", // Año Nuevo
    "2025-04-17", // Jueves Santo
    "2025-04-18", // Viernes Santo
    "2025-05-01", // Día del Trabajo
    "2025-06-29", // San Pedro y San Pablo
    "2025-07-28", // Fiestas Patrias
    "2025-07-29", // Fiestas Patrias
    "2025-08-30", // Santa Rosa de Lima
    "2025-10-08", // Combate de Angamos
    "2025-11-01", // Todos los Santos
    "2025-12-08", // Inmaculada Concepción
    "2025-12-25", // Navidad
  ],
  2026: [
    "2026-01-01", // Año Nuevo
    "2026-04-02", // Jueves Santo
    "2026-04-03", // Viernes Santo
    "2026-05-01", // Día del Trabajo
    "2026-06-29", // San Pedro y San Pablo
    "2026-07-28", // Fiestas Patrias
    "2026-07-29", // Fiestas Patrias
    "2026-08-30", // Santa Rosa de Lima
    "2026-10-08", // Combate de Angamos
    "2026-11-01", // Todos los Santos
    "2026-12-08", // Inmaculada Concepción
    "2026-12-25", // Navidad
  ],
  2027: [
    "2027-01-01", // Año Nuevo
    "2027-03-25", // Jueves Santo
    "2027-03-26", // Viernes Santo
    "2027-05-01", // Día del Trabajo
    "2027-06-29", // San Pedro y San Pablo
    "2027-07-28", // Fiestas Patrias
    "2027-07-29", // Fiestas Patrias
    "2027-08-30", // Santa Rosa de Lima
    "2027-10-08", // Combate de Angamos
    "2027-11-01", // Todos los Santos
    "2027-12-08", // Inmaculada Concepción
    "2027-12-25", // Navidad
  ],
};

export function esFeriado(fechaIso: string): boolean {
  const anio = Number(fechaIso.slice(0, 4));
  const feriadosDelAnio = FERIADOS_PERU[anio] ?? [];
  return feriadosDelAnio.includes(fechaIso);
}
