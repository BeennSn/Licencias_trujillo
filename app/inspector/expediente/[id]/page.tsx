import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes, negocios, documentos, pagos, inspecciones } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { BadgeEstadoExpediente, Badge } from "@/components/ui/Badge";
import { ETIQUETAS_ESTADO_EXPEDIENTE } from "@/lib/estadosExpediente";
import { FormularioDecision } from "@/components/inspector/FormularioDecision";

export default async function DetalleExpedienteInspector({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await auth();

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return <main className="p-8 text-red-600">Expediente no encontrado.</main>;
  }

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expediente.negocioId)).limit(1);
  const documentosDelExpediente = await db.select().from(documentos).where(eq(documentos.expedienteId, id));
  const pagosDelExpediente = await db.select().from(pagos).where(eq(pagos.expedienteId, id));

  const [inspeccionAsignada] = await db
    .select()
    .from(inspecciones)
    .where(
      and(
        eq(inspecciones.expedienteId, id),
        eq(inspecciones.inspectorId, sesion!.user.id),
        eq(inspecciones.estado, "programada")
      )
    )
    .orderBy(desc(inspecciones.createdAt))
    .limit(1);

  const pagoAprobado = pagosDelExpediente.some((p) => p.estado === "aprobado");

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <Link href="/inspector" className="text-sm text-blue-700 hover:underline">
        ← Volver a mis inspecciones
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{negocio?.razonSocial}</h1>
          <p className="text-sm text-gray-500">Expediente {expediente.numeroExpediente}</p>
        </div>
        <BadgeEstadoExpediente estado={expediente.estado} etiqueta={ETIQUETAS_ESTADO_EXPEDIENTE[expediente.estado]} />
      </div>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold text-gray-800 mb-1">Datos del negocio</h2>
        <p><span className="font-medium">RUC:</span> {negocio?.ruc}</p>
        <p><span className="font-medium">Giro:</span> {expediente.giroActividad}</p>
        <p><span className="font-medium">Distrito:</span> {expediente.distrito}</p>
        <p><span className="font-medium">Dirección del local:</span> {expediente.direccionLocal}</p>
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold text-gray-800 mb-1">Pago del derecho de trámite</h2>
        {pagoAprobado ? (
          <Badge tono="verde">Pago aprobado</Badge>
        ) : (
          <Badge tono="rojo">Sin pago aprobado</Badge>
        )}
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold text-gray-800 mb-1">Documentos</h2>
        {documentosDelExpediente.length === 0 && <p className="text-gray-500">Sin documentos subidos.</p>}
        <ul className="space-y-1">
          {documentosDelExpediente.map((doc) => (
            <li key={doc.id} className="flex justify-between border rounded px-3 py-2">
              <a href={doc.urlArchivo} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                {doc.nombre}
                {doc.tipo === "plano_local" && <span className="text-xs text-gray-500"> (Plano del local)</span>}
              </a>
              <span className="text-xs text-gray-500">Vigente hasta {doc.fechaVigencia}</span>
            </li>
          ))}
        </ul>
      </Card>

      {inspeccionAsignada ? (
        <FormularioDecision expedienteId={id} tipoInspeccion={inspeccionAsignada.tipo} />
      ) : (
        <Card>
          <p className="text-sm text-gray-500">
            No tienes una inspección pendiente asignada a ti para este expediente.
          </p>
        </Card>
      )}
    </main>
  );
}
