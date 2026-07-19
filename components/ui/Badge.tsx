type Tono = "gris" | "azul" | "verde" | "rojo" | "amarillo";

const clasesPorTono: Record<Tono, string> = {
  gris: "bg-gray-100 text-gray-700",
  azul: "bg-blue-100 text-blue-700",
  verde: "bg-green-100 text-green-700",
  rojo: "bg-red-100 text-red-700",
  amarillo: "bg-yellow-100 text-yellow-800",
};

export function Badge({ children, tono = "gris" }: { children: React.ReactNode; tono?: Tono }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${clasesPorTono[tono]}`}>
      {children}
    </span>
  );
}

// Mapea cada estado de expediente al tono visual correspondiente, para que
// el color sea consistente en toda la app (landing, negocio, inspector, admin).
import type { EstadoExpediente } from "@/lib/estadosExpediente";

const TONO_POR_ESTADO_EXPEDIENTE: Record<EstadoExpediente, Tono> = {
  BORRADOR: "gris",
  DOCUMENTOS_COMPLETOS: "azul",
  PAGO_PENDIENTE: "amarillo",
  PAGO_APROBADO: "azul",
  PRIMERA_INSPECCION_PROGRAMADA: "azul",
  SEGUNDA_INSPECCION_PROGRAMADA: "amarillo",
  APROBADA: "verde",
  RECHAZADA: "rojo",
};

export function BadgeEstadoExpediente({ estado, etiqueta }: { estado: EstadoExpediente; etiqueta: string }) {
  return <Badge tono={TONO_POR_ESTADO_EXPEDIENTE[estado]}>{etiqueta}</Badge>;
}
