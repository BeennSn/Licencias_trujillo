// Constantes de negocio del sistema de licencias. Cambiar acá impacta todo
// el sistema (por ejemplo, si la municipalidad actualiza el TUPA y sube el
// monto del derecho de trámite).
export const MONTO_TRAMITE_SOLES = 180;

// OJO: mientras se prueba la integración real de Mercado Pago con
// credenciales de PRODUCCIÓN (ver lib/pagos/mercadopago.ts), el negocio ve
// y se le registra en BD el monto oficial (MONTO_TRAMITE_SOLES = S/180),
// pero el cobro que de verdad se envía a la pasarela es de solo S/1.80,
// para no mover dinero real mientras se valida el flujo. Antes de operar en
// serio, borrar esta constante y usar MONTO_TRAMITE_SOLES directamente en
// cobrarDerechoDeTramite().
export const MONTO_TRAMITE_COBRO_REAL_SOLES = 1.8;

// QR de Yape/Plin con monto fijo para cobro presencial en caja (ver
// app/solicitud/[expedienteId]/pago-presencial y app/cajero/renovar). Se
// genera desde la propia app personal de Yape o Plin (botón "Cobrar",
// ingresando el monto), no requiere cuenta empresarial ni API — pero por
// eso mismo el monto queda fijo en la imagen: si cambia
// MONTO_TRAMITE_COBRO_REAL_SOLES, hay que generar y reemplazar el archivo
// de nuevo. Colocar la imagen en public/qr-yape-plin.png (mismo patrón que
// el logo de la municipalidad en public/logo-mpt.png).
export const QR_YAPE_PLIN_IMAGEN = "/qr-yape-plin.png";

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

// Texto fijo impreso en toda licencia emitida por el sistema (ver
// lib/pdfLicencia.tsx), igual que ya se hace con la cita a la Ley N° 28976.
// Si la municipalidad cambia de Sub Gerente o emite una nueva resolución/
// ordenanza que reemplace a estas, se actualiza en un solo lugar.
export const RESOLUCION_GERENCIAL_LICENCIA = "N° 1261-213-MPT-GDEL";
export const ORDENANZA_MUNICIPAL_LICENCIA = "Nro. 014-2018-MPT";
export const FIRMANTE_LICENCIA_NOMBRE = "Abog. Jackeline Bustamante Fernández";
export const FIRMANTE_LICENCIA_CARGO = "Sub Gerente";
