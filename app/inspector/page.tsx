import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { inspecciones, expedientes, negocios } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Lista de inspecciones pendientes del inspector, agrupadas por fecha
// (funciona como un calendario simple: cada fecha es un "día de agenda").
export default async function PaginaInspector() {
  const sesion = await auth();

  const filas = await db
    .select({ inspeccion: inspecciones, expediente: expedientes, negocio: negocios })
    .from(inspecciones)
    .innerJoin(expedientes, eq(inspecciones.expedienteId, expedientes.id))
    .innerJoin(negocios, eq(expedientes.negocioId, negocios.id))
    .where(and(eq(inspecciones.inspectorId, sesion!.user.id), eq(inspecciones.estado, "programada")))
    .orderBy(asc(inspecciones.fechaProgramada), asc(inspecciones.horaProgramada));

  const porFecha = new Map<string, typeof filas>();
  for (const fila of filas) {
    const lista = porFecha.get(fila.inspeccion.fechaProgramada) ?? [];
    lista.push(fila);
    porFecha.set(fila.inspeccion.fechaProgramada, lista);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis inspecciones pendientes</h1>
        <p className="text-gray-500 text-sm">Visitas técnicas programadas, ordenadas por fecha.</p>
      </div>

      {filas.length === 0 && (
        <Card>
          <p className="text-gray-500 text-sm">No tienes inspecciones pendientes por el momento.</p>
        </Card>
      )}

      {[...porFecha.entries()].map(([fecha, inspeccionesDelDia]) => (
        <Card key={fecha} className="space-y-3">
          <h2 className="font-semibold text-gray-800">{fecha}</h2>
          <ul className="divide-y">
            {inspeccionesDelDia.map(({ inspeccion, expediente, negocio }) => (
              <li key={inspeccion.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {inspeccion.horaProgramada ?? "Hora sin especificar"} · {negocio.razonSocial}
                  </p>
                  <p className="text-xs text-gray-500">
                    Expediente {expediente.numeroExpediente} · {expediente.distrito}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tono={inspeccion.tipo === "primera" ? "azul" : "amarillo"}>
                    {inspeccion.tipo === "primera" ? "1ra visita" : "2da visita"}
                  </Badge>
                  <Link
                    href={`/inspector/expediente/${expediente.id}`}
                    className="text-blue-700 text-sm font-medium hover:underline"
                  >
                    Ver expediente
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </main>
  );
}
