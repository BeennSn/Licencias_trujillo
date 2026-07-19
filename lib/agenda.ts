// Auto-programación de inspecciones técnicas.
//
// - La PRIMERA inspección se programa "lo antes posible": se busca el
//   primer día hábil con cupo disponible desde la fecha del pago aprobado.
// - La SEGUNDA inspección tiene una fecha legal fija (exactamente 30 días
//   hábiles peruanos después de la primera visita), así que NO respeta el
//   cupo diario: la fecha no se puede correr por falta de disponibilidad.
import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { inspecciones, usuarios } from "./db/schema";
import { proximoDiaHabil, aFechaIso, fechaIsoAFecha, sumarDiasHabiles } from "./diasHabilesPeru";
import { CUPO_INSPECCIONES_POR_DIA, DIAS_HABILES_SEGUNDA_INSPECCION, HORAS_INSPECCION } from "./constantes";

// Asigna una hora según la posición en la cola de ese día hábil (0 = primera
// hora del día). Se repite cíclicamente si la cola supera la cantidad de
// horas disponibles (puede pasar en la segunda inspección, que no respeta cupo).
function horaSegunPosicion(posicionEnElDia: number): string {
  return HORAS_INSPECCION[posicionEnElDia % HORAS_INSPECCION.length];
}

const MAXIMO_DIAS_A_INTENTAR = 365;

async function obtenerInspectoresActivos() {
  const inspectoresActivos = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.rol, "inspector"), eq(usuarios.activo, true)));

  if (inspectoresActivos.length === 0) {
    throw new Error("No hay inspectores activos registrados en el sistema.");
  }

  return inspectoresActivos;
}

// Entre los inspectores activos, elige el que tenga menos inspecciones ya
// programadas en esa fecha (reparto simple de carga entre inspectores).
async function elegirInspectorMenosCargado(fechaIso: string, inspectoresActivos: { id: string }[]) {
  const inspeccionesDelDia = await db
    .select()
    .from(inspecciones)
    .where(eq(inspecciones.fechaProgramada, fechaIso));

  const conteoPorInspector = new Map<string, number>(
    inspectoresActivos.map((inspector) => [inspector.id, 0])
  );
  for (const inspeccion of inspeccionesDelDia) {
    conteoPorInspector.set(inspeccion.inspectorId, (conteoPorInspector.get(inspeccion.inspectorId) ?? 0) + 1);
  }

  const [inspectorElegidoId] = [...conteoPorInspector.entries()].sort((a, b) => a[1] - b[1])[0];
  return { inspectorElegidoId, cantidadDeInspeccionesEseDia: inspeccionesDelDia.length };
}

// Primera inspección: busca, a partir de fechaMinimaIso, el primer día
// hábil que todavía tenga cupo (CUPO_INSPECCIONES_POR_DIA).
export async function programarPrimeraInspeccion(expedienteId: string, fechaMinimaIso: string) {
  const inspectoresActivos = await obtenerInspectoresActivos();
  let fechaCandidata = proximoDiaHabil(fechaMinimaIso);

  for (let intento = 0; intento < MAXIMO_DIAS_A_INTENTAR; intento++) {
    const { inspectorElegidoId, cantidadDeInspeccionesEseDia } = await elegirInspectorMenosCargado(
      fechaCandidata,
      inspectoresActivos
    );

    if (cantidadDeInspeccionesEseDia < CUPO_INSPECCIONES_POR_DIA) {
      const [inspeccionCreada] = await db
        .insert(inspecciones)
        .values({
          expedienteId,
          tipo: "primera",
          fechaProgramada: fechaCandidata,
          horaProgramada: horaSegunPosicion(cantidadDeInspeccionesEseDia),
          inspectorId: inspectorElegidoId,
          estado: "programada",
        })
        .returning();

      return inspeccionCreada;
    }

    const siguienteDia = aFechaIso(
      new Date(fechaIsoAFecha(fechaCandidata).getTime() + 24 * 60 * 60 * 1000)
    );
    fechaCandidata = proximoDiaHabil(siguienteDia);
  }

  throw new Error("No se encontró cupo disponible para programar la primera inspección.");
}

// Segunda inspección: fecha legal fija (+30 días hábiles peruanos desde la
// fecha en que se realizó la primera visita). No se corre por falta de cupo.
export async function programarSegundaInspeccion(expedienteId: string, fechaPrimeraInspeccionIso: string) {
  const inspectoresActivos = await obtenerInspectoresActivos();
  const fechaExacta = sumarDiasHabiles(fechaPrimeraInspeccionIso, DIAS_HABILES_SEGUNDA_INSPECCION);
  const { inspectorElegidoId, cantidadDeInspeccionesEseDia } = await elegirInspectorMenosCargado(
    fechaExacta,
    inspectoresActivos
  );

  const [inspeccionCreada] = await db
    .insert(inspecciones)
    .values({
      expedienteId,
      tipo: "segunda",
      fechaProgramada: fechaExacta,
      horaProgramada: horaSegunPosicion(cantidadDeInspeccionesEseDia),
      inspectorId: inspectorElegidoId,
      estado: "programada",
    })
    .returning();

  return inspeccionCreada;
}
