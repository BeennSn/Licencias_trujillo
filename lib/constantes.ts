// Constantes de negocio del sistema de licencias. Cambiar acá impacta todo
// el sistema (por ejemplo, si la municipalidad actualiza el TUPA y sube el
// monto del derecho de trámite).
export const MONTO_TRAMITE_SOLES = 180;

export const DIAS_HABILES_SEGUNDA_INSPECCION = 30;

export const VIGENCIA_LICENCIA_ANIOS = 1;

// Cuántas inspecciones como máximo se programan por día hábil (entre todos
// los inspectores activos). Mantiene simple la agenda para el MVP: no hay
// horarios por inspector, solo un cupo diario global.
export const CUPO_INSPECCIONES_POR_DIA = 4;

// Documentos del expediente (ej. plano del local): solo PDF/imagen, y con
// un tamaño máximo para no llenar el almacenamiento con archivos basura.
export const TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const TAMANO_MAXIMO_DOCUMENTO_BYTES = 10 * 1024 * 1024; // 10 MB
