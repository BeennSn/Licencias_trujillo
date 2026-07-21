import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes, inspecciones, comprobantesPago } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ETIQUETAS_ESTADO_EXPEDIENTE } from "@/lib/estadosExpediente";
import { StepIndicator } from "@/components/wizard/StepIndicator";

export default async function PasoConfirmacion({
  params,
}: {
  params: Promise<{ expedienteId: string }>;
}) {
  const { expedienteId } = await params;
  const sesion = await auth();
  const esCajero = sesion?.user?.rol === "cajero";

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);

  const [inspeccion] = await db
    .select()
    .from(inspecciones)
    .where(and(eq(inspecciones.expedienteId, expedienteId), eq(inspecciones.tipo, "primera")))
    .orderBy(desc(inspecciones.createdAt))
    .limit(1);

  const [comprobante] = await db
    .select()
    .from(comprobantesPago)
    .where(eq(comprobantesPago.expedienteId, expedienteId))
    .orderBy(desc(comprobantesPago.createdAt))
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
        <StepIndicator pasoActual={5} />
        <Card className="space-y-6 text-center">
          <div className="text-green-600 text-4xl">✓</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">¡Solicitud registrada!</h1>
            <p className="text-sm text-gray-500">
              Guarda tu número de expediente (o tu RUC): con eso vas a poder consultar el estado de tu trámite y,
              más adelante, descargar tu licencia. No necesitas crear ninguna cuenta.
            </p>
          </div>

          <div className="rounded-md border border-gray-200 p-4 text-left space-y-2 text-sm">
            <p><span className="font-medium">N° de expediente:</span> {expediente.numeroExpediente}</p>
            <p><span className="font-medium">Estado actual:</span> {ETIQUETAS_ESTADO_EXPEDIENTE[expediente.estado]}</p>
            {inspeccion && (
              <p>
                <span className="font-medium">Fecha de tu primera inspección técnica:</span>{" "}
                {inspeccion.fechaProgramada}
              </p>
            )}
          </div>

          <p className="text-sm text-gray-600">
            Un inspector municipal visitará tu local en la fecha indicada para verificar tu documentación.
            Te notificaremos por correo cualquier novedad.
          </p>

          {comprobante && (
            <a href={comprobante.pdfUrl} target="_blank" rel="noreferrer">
              <Button variante="secundario" className="w-full">
                Descargar comprobante de pago
              </Button>
            </a>
          )}

          <div className="flex flex-col gap-2">
            {esCajero ? (
              <Link href="/cajero" className="text-blue-700 hover:underline text-sm">
                Volver al panel principal
              </Link>
            ) : (
              <>
                <Link
                  href={`/consulta?numeroExpediente=${expediente.numeroExpediente ?? ""}`}
                  className="text-blue-700 hover:underline text-sm"
                >
                  Consultar el estado de mi trámite
                </Link>
                <Link href="/" className="text-gray-500 hover:underline text-sm">
                  Volver al inicio
                </Link>
              </>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
