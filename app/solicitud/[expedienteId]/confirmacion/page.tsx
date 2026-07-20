import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes, inspecciones } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { ETIQUETAS_ESTADO_EXPEDIENTE } from "@/lib/estadosExpediente";
import { StepIndicator } from "@/components/wizard/StepIndicator";

export default async function PasoConfirmacion({
  params,
}: {
  params: Promise<{ expedienteId: string }>;
}) {
  const { expedienteId } = await params;

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);

  const [inspeccion] = await db
    .select()
    .from(inspecciones)
    .where(and(eq(inspecciones.expedienteId, expedienteId), eq(inspecciones.tipo, "primera")))
    .orderBy(desc(inspecciones.createdAt))
    .limit(1);

  if (!expediente) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <p className="text-red-600">Expediente no encontrado.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg">
        <StepIndicator pasoActual={6} />
        <Card className="space-y-6 text-center">
          <div className="text-green-600 text-4xl">✓</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">¡Solicitud registrada!</h1>
            <p className="text-sm text-gray-500">
              Guarda tu número de expediente, lo necesitarás para consultar el estado de tu trámite.
            </p>
          </div>

          <div className="rounded-md border border-gray-200 p-4 text-left space-y-2 text-sm">
            <p><span className="font-medium">N° de expediente:</span> {expediente.numeroExpediente}</p>
            <p><span className="font-medium">Estado actual:</span> {ETIQUETAS_ESTADO_EXPEDIENTE[expediente.estado]}</p>
            {inspeccion && (
              <p>
                <span className="font-medium">Fecha de tu primera inspección técnica:</span>{" "}
                {inspeccion.fechaProgramada}
                {inspeccion.horaProgramada ? ` a las ${inspeccion.horaProgramada}` : ""}
              </p>
            )}
          </div>

          <p className="text-sm text-gray-600">
            Un inspector municipal visitará tu local en la fecha indicada para verificar tu documentación.
            Te notificaremos por correo cualquier novedad.
          </p>

          <div className="flex flex-col gap-2">
            <Link
              href={`/consulta?numeroExpediente=${expediente.numeroExpediente ?? ""}`}
              className="text-blue-700 hover:underline text-sm"
            >
              Consultar el estado de mi trámite
            </Link>
            <Link href="/login" className="text-blue-700 hover:underline text-sm">
              Ingresar a mi cuenta
            </Link>
            <Link href="/" className="text-gray-500 hover:underline text-sm">
              Volver al inicio
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
