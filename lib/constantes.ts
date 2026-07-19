// Constantes de negocio del sistema de licencias. Cambiar acá impacta todo
// el sistema (por ejemplo, si la municipalidad actualiza el TUPA y sube el
// monto del derecho de trámite).
export const MONTO_TRAMITE_SOLES = 180;

export const DIAS_HABILES_SEGUNDA_INSPECCION = 30;

export const VIGENCIA_LICENCIA_ANIOS = 1;

// Cuántas inspecciones como máximo se programan por día hábil (entre todos
// los inspectores activos).
export const CUPO_INSPECCIONES_POR_DIA = 4;

// Horario de visita asignado según el orden de llegada del día (posición 0
// en la cola de ese día hábil recibe la primera hora, etc.). Debe tener al
// menos CUPO_INSPECCIONES_POR_DIA elementos; si la cola se llena (la segunda
// inspección no respeta el cupo diario), las horas se reparten cíclicamente.
export const HORAS_INSPECCION = ["09:00", "11:00", "13:00", "15:00"];

// Documentos del expediente (ej. plano del local): solo PDF/imagen, y con
// un tamaño máximo para no llenar el almacenamiento con archivos basura.
export const TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const TAMANO_MAXIMO_DOCUMENTO_BYTES = 10 * 1024 * 1024; // 10 MB
