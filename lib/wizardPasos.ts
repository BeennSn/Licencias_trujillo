import type { EstadoExpediente } from "./estadosExpediente";

type ExpedienteResumen = {
  distrito: string | null;
  estado: EstadoExpediente;
};

// Dado el estado guardado del expediente, determina a qué paso del wizard
// corresponde estar ahora mismo. Cada página del wizard llama a esto al
// montar y redirige si no coincide con su propio paso, para que el negocio
// no pueda saltar pasos por URL directa (avanzar) ni volver a rehacer un
// paso ya completado (retroceder).
export function pasoActualDelWizard(expediente: ExpedienteResumen): string {
  if (!expediente.distrito) return "domicilio";
  if (expediente.estado === "BORRADOR" || expediente.estado === "DOCUMENTOS_COMPLETOS") return "documentos";
  if (expediente.estado === "PAGO_PENDIENTE") return "pago";
  return "cuenta";
}
