import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes, negocios, documentos, pagos, inspecciones, licencias } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BadgeEstadoExpediente, Badge } from "@/components/ui/Badge";
import { ETIQUETAS_ESTADO_EXPEDIENTE } from "@/lib/estadosExpediente";
import { estaPorVencer, estaVencida } from "@/lib/estadosLicencia";
import { aFechaIso } from "@/lib/diasHabilesPeru";

export default async function PaginaNegocio() {
  const sesion = await auth();
  const negocioId = sesion!.user.negocioId!;

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  const historialExpedientes = await db
    .select()
    .from(expedientes)
    .where(eq(expedientes.negocioId, negocioId))
    .orderBy(desc(expedientes.createdAt));

  const expedienteActual = historialExpedientes[0];

  const [documentosActuales, pagosActuales, inspeccionesActuales, licenciasDelNegocio] = expedienteActual
    ? await Promise.all([
        db.select().from(documentos).where(eq(documentos.expedienteId, expedienteActual.id)),
        db.select().from(pagos).where(eq(pagos.expedienteId, expedienteActual.id)),
        db.select().from(inspecciones).where(eq(inspecciones.expedienteId, expedienteActual.id)),
        db.select().from(licencias).where(eq(licencias.negocioId, negocioId)).orderBy(desc(licencias.createdAt)),
      ])
    : [[], [], [], []];

  const licenciaVigente = licenciasDelNegocio.find((l) => l.estado === "VIGENTE" || l.estado === "RENOVADA");
  const hoy = aFechaIso(new Date());
  const puedeRenovar =
    licenciaVigente &&
    (estaPorVencer(licenciaVigente.fechaVencimiento, hoy) || estaVencida(licenciaVigente.fechaVencimiento, hoy));

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{negocio?.razonSocial}</h1>
        <p className="text-sm text-gray-500">RUC {negocio?.ruc}</p>
      </div>

      {licenciaVigente && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Licencia de funcionamiento</h2>
            <Badge tono={licenciaVigente.estado === "VIGENTE" || licenciaVigente.estado === "RENOVADA" ? "verde" : "rojo"}>
              {licenciaVigente.estado}
            </Badge>
          </div>
          <p className="text-sm"><span className="font-medium">N°:</span> {licenciaVigente.numeroLicencia}</p>
          <p className="text-sm"><span className="font-medium">Vigente hasta:</span> {licenciaVigente.fechaVencimiento}</p>
          <div className="flex gap-3 pt-2">
            {licenciaVigente.pdfUrl && (
              <a href={licenciaVigente.pdfUrl} target="_blank" rel="noreferrer">
                <Button variante="secundario">Descargar PDF</Button>
              </a>
            )}
            <Link href="/negocio/reportar-cambio">
              <Button variante="secundario">Reportar cambio de infraestructura</Button>
            </Link>
            {puedeRenovar && (
              <Link href="/negocio/renovar">
                <Button>Renovar licencia</Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {expedienteActual && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Expediente {expedienteActual.numeroExpediente}
              {expedienteActual.tipo === "renovacion" && " (renovación)"}
            </h2>
            <BadgeEstadoExpediente
              estado={expedienteActual.estado}
              etiqueta={ETIQUETAS_ESTADO_EXPEDIENTE[expedienteActual.estado]}
            />
          </div>

          <div className="text-sm space-y-1">
            <p><span className="font-medium">Distrito:</span> {expedienteActual.distrito}</p>
            <p><span className="font-medium">Dirección:</span> {expedienteActual.direccionLocal}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Documentos</h3>
            <ul className="text-sm space-y-1">
              {documentosActuales.map((doc) => (
                <li key={doc.id}>
                  <a href={doc.urlArchivo} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                    {doc.nombre}
                    {doc.tipo === "plano_local" && <span className="text-xs text-gray-500"> (Plano del local)</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Pagos</h3>
            <ul className="text-sm space-y-1">
              {pagosActuales.map((pago) => (
                <li key={pago.id}>
                  S/ {pago.monto} · {pago.medioPago} ·{" "}
                  <Badge tono={pago.estado === "aprobado" ? "verde" : pago.estado === "rechazado" ? "rojo" : "amarillo"}>
                    {pago.estado}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Inspecciones</h3>
            <ul className="text-sm space-y-2">
              {inspeccionesActuales.map((insp) => (
                <li key={insp.id} className="border rounded p-2">
                  <p>
                    {insp.tipo === "primera" ? "1ra visita" : "2da visita"} · {insp.fechaProgramada}
                    {insp.horaProgramada ? ` ${insp.horaProgramada}` : ""} ·{" "}
                    <Badge tono={insp.estado === "conforme" ? "verde" : insp.estado === "observada" ? "rojo" : "azul"}>
                      {insp.estado}
                    </Badge>
                  </p>
                  {insp.observaciones && <p className="text-gray-600 mt-1">Comentario: {insp.observaciones}</p>}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card className="space-y-2">
        <h2 className="font-semibold text-gray-800">Historial de expedientes</h2>
        <ul className="text-sm divide-y">
          {historialExpedientes.map((exp) => (
            <li key={exp.id} className="py-2 flex justify-between items-center">
              <span>{exp.numeroExpediente} {exp.tipo === "renovacion" && "(renovación)"}</span>
              <BadgeEstadoExpediente estado={exp.estado} etiqueta={ETIQUETAS_ESTADO_EXPEDIENTE[exp.estado]} />
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
