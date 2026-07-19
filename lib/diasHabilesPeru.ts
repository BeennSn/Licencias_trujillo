// Cálculo de días hábiles peruanos: excluye sábados, domingos y feriados
// nacionales (ver lib/feriadosPeru.ts). Se usa tanto para programar la
// primera inspección ("lo antes posible") como para calcular la fecha
// exacta de la segunda inspección (+30 días hábiles desde la primera).
//
// Todas las fechas se manejan en UTC (sin hora) para evitar corrimientos
// de un día por husos horarios al desplegar en servidores fuera de Perú.
import { esFeriado } from "./feriadosPeru";

export function aFechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function fechaIsoAFecha(fechaIso: string): Date {
  return new Date(`${fechaIso}T00:00:00.000Z`);
}

function esFinDeSemana(fecha: Date): boolean {
  const diaSemana = fecha.getUTCDay(); // 0 = domingo, 6 = sábado
  return diaSemana === 0 || diaSemana === 6;
}

export function esDiaHabil(fecha: Date): boolean {
  return !esFinDeSemana(fecha) && !esFeriado(aFechaIso(fecha));
}

// Avanza `cantidadDias` días hábiles a partir de fechaInicio (sin incluir
// fechaInicio en el conteo) y devuelve la fecha resultante en formato ISO.
export function sumarDiasHabiles(fechaInicioIso: string, cantidadDias: number): string {
  let fecha = fechaIsoAFecha(fechaInicioIso);
  let contador = 0;

  while (contador < cantidadDias) {
    fecha = new Date(fecha.getTime() + 24 * 60 * 60 * 1000);
    if (esDiaHabil(fecha)) {
      contador += 1;
    }
  }

  return aFechaIso(fecha);
}

// Busca el próximo día hábil a partir de (e incluyendo) fechaInicio.
// Se usa para no programar inspecciones en fin de semana/feriado.
export function proximoDiaHabil(fechaInicioIso: string): string {
  let fecha = fechaIsoAFecha(fechaInicioIso);
  while (!esDiaHabil(fecha)) {
    fecha = new Date(fecha.getTime() + 24 * 60 * 60 * 1000);
  }
  return aFechaIso(fecha);
}
