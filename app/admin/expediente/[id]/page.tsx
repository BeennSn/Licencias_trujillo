import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes, negocios, documentos, pagos, inspecciones, licencias, usuarios } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { Badge, BadgeEstadoExpediente } from "@/components/ui/Badge";
import { ETIQUETAS_ESTADO_EXPEDIENTE } from "@/lib/estadosExpediente";

// Trazabilidad completa de un solo expediente: documentos, pagos e
// inspecciones en un solo lugar, con quién hizo cada cosa (cajero,
// inspector). Vista de solo lectura para el admin.
export default async function DetalleExpedienteAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, id)).limit(1);
  if (!expediente) {
    return <main className="p-8 text-red-600">Expediente no encontrado.</main>;
  }

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expediente.negocioId)).limit(1);
  const documentosDelExpediente = await db.select().from(documentos).where(eq(documentos.expedienteId, id));
  const licenciasDelExpediente = await db
    .select()
    .from(licencias)
    .where(eq(licencias.expedienteId, id))
    .orderBy(desc(licencias.createdAt));

  const pagosDelExpediente = await db
    .select({ pago: pagos, cajero: usuarios })
    .from(pagos)
    .leftJoin(usuarios, eq(pagos.registradoPorId, usuarios.id))
    .where(eq(pagos.expedienteId, id))
    .orderBy(desc(pagos.createdAt));

  const inspeccionesDelExpediente = await db
    .select({ inspeccion: inspecciones, inspector: usuarios })
    .from(inspecciones)
    .innerJoin(usuarios, eq(inspecciones.inspectorId, usuarios.id))
    .where(eq(inspecciones.expedienteId, id))
    .orderBy(desc(inspecciones.fechaProgramada));

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <Link href="/admin" className="text-sm text-blue-700 hover:underline">
        ← Volver a expedientes
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{negocio?.razonSocial}</h1>
          <p className="text-sm text-gray-500">
            RUC {negocio?.ruc} · Expediente {expediente.numeroExpediente} ({expediente.tipo})
          </p>
        </div>
        <BadgeEstadoExpediente estado={expediente.estado} etiqueta={ETIQUETAS_ESTADO_EXPEDIENTE[expediente.estado]} />
      </div>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold text-gray-800">Datos del local</h2>
        <p><span className="font-medium">Distrito:</span> {expediente.distrito ?? "—"}</p>
        <p><span className="font-medium">Dirección:</span> {expediente.direccionLocal ?? "—"}</p>
        <p><span className="font-medium">Giro:</span> {expediente.giroActividad ?? "—"}</p>
        <p><span className="font-medium">Correo de contacto:</span> {expediente.emailContacto ?? "—"}</p>
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold text-gray-800">Plano del local</h2>
        {documentosDelExpediente.length === 0 && <p className="text-gray-500">Sin plano subido.</p>}
        {documentosDelExpediente.map((doc) => (
          <a key={doc.id} href={doc.urlArchivo} target="_blank" rel="noreferrer" className="block text-blue-700 hover:underline">
            Ver plano ({new Date(doc.createdAt).toLocaleString("es-PE")})
          </a>
        ))}
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold text-gray-800">Pagos</h2>
        {pagosDelExpediente.length === 0 && <p className="text-gray-500">Sin pagos registrados.</p>}
        <ul className="space-y-2">
          {pagosDelExpediente.map(({ pago, cajero }) => (
            <li key={pago.id} className="border rounded p-2 flex items-center justify-between">
              <span>
                S/ {Number(pago.monto).toFixed(2)} · {pago.medioPago} · {pago.canal}
                {cajero && <span className="text-xs text-gray-500"> · {cajero.nombre ?? cajero.email}</span>}
                <span className="text-xs text-gray-400"> · {new Date(pago.createdAt).toLocaleString("es-PE")}</span>
              </span>
              <Badge tono={pago.estado === "aprobado" ? "verde" : pago.estado === "rechazado" ? "rojo" : "amarillo"}>
                {pago.estado}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold text-gray-800">Inspecciones</h2>
        {inspeccionesDelExpediente.length === 0 && <p className="text-gray-500">Sin inspecciones programadas.</p>}
        <ul className="space-y-2">
          {inspeccionesDelExpediente.map(({ inspeccion, inspector }) => (
            <li key={inspeccion.id} className="border rounded p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span>
                  {inspeccion.tipo === "primera" ? "1ra visita" : "2da visita"} · {inspeccion.fechaProgramada}
                  {inspeccion.turno ? ` · Turno ${inspeccion.turno}` : ""}
                </span>
                <Badge tono={inspeccion.estado === "conforme" ? "verde" : inspeccion.estado === "observada" ? "rojo" : "azul"}>
                  {inspeccion.estado}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">Inspector: {inspector.nombre ?? inspector.email}</p>
              {inspeccion.observaciones && <p className="text-xs text-gray-600">{inspeccion.observaciones}</p>}
              {inspeccion.requiereCambioDocumento && <Badge tono="amarillo">Requiere cambio de plano</Badge>}
            </li>
          ))}
        </ul>
      </Card>

      {licenciasDelExpediente.length > 0 && (
        <Card className="space-y-2 text-sm">
          <h2 className="font-semibold text-gray-800">Licencias emitidas</h2>
          <ul className="space-y-2">
            {licenciasDelExpediente.map((licencia) => (
              <li key={licencia.id} className="border rounded p-2 flex items-center justify-between">
                <span>
                  {licencia.numeroLicencia} · vigente hasta {licencia.fechaVencimiento}
                </span>
                <div className="flex items-center gap-2">
                  <Badge tono={licencia.estado === "VIGENTE" || licencia.estado === "RENOVADA" ? "verde" : licencia.estado === "VENCIDA" ? "amarillo" : "rojo"}>
                    {licencia.estado}
                  </Badge>
                  {licencia.pdfUrl && (
                    <a href={licencia.pdfUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline text-xs">
                      PDF
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
