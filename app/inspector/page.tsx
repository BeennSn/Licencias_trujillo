import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { inspecciones, expedientes, negocios } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { aFechaIso } from "@/lib/diasHabilesPeru";

type FilaInspeccion = {
  inspeccion: typeof inspecciones.$inferSelect;
  expediente: typeof expedientes.$inferSelect;
  negocio: typeof negocios.$inferSelect;
};

function ListaInspecciones({ filas, hoy }: { filas: FilaInspeccion[]; hoy: string }) {
  return (
    <ul className="divide-y">
      {filas.map(({ inspeccion, expediente, negocio }) => (
        <li key={inspeccion.id} className="py-3 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">
              {inspeccion.horaProgramada ?? "Hora sin especificar"} · {negocio.razonSocial}
              {inspeccion.fechaProgramada < hoy && (
                <span className="ml-2 text-xs font-semibold text-red-600">Atrasada</span>
              )}
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
  );
}

// Panel del inspector: separa las visitas de hoy (incluye atrasadas, para no
// perderlas de vista) de las próximas, agrupadas por fecha.
export default async function PaginaInspector() {
  const sesion = await auth();
  const hoy = aFechaIso(new Date());

  const filas = await db
    .select({ inspeccion: inspecciones, expediente: expedientes, negocio: negocios })
    .from(inspecciones)
    .innerJoin(expedientes, eq(inspecciones.expedienteId, expedientes.id))
    .innerJoin(negocios, eq(expedientes.negocioId, negocios.id))
    .where(and(eq(inspecciones.inspectorId, sesion!.user.id), eq(inspecciones.estado, "programada")))
    .orderBy(asc(inspecciones.fechaProgramada), asc(inspecciones.horaProgramada));

  const deHoy = filas.filter((f) => f.inspeccion.fechaProgramada <= hoy);
  const futuras = filas.filter((f) => f.inspeccion.fechaProgramada > hoy);

  const futurasPorFecha = new Map<string, FilaInspeccion[]>();
  for (const fila of futuras) {
    const lista = futurasPorFecha.get(fila.inspeccion.fechaProgramada) ?? [];
    lista.push(fila);
    futurasPorFecha.set(fila.inspeccion.fechaProgramada, lista);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis inspecciones pendientes</h1>
        <p className="text-gray-500 text-sm">Visitas técnicas programadas, ordenadas por hora.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Hoy</h2>
        <Card>
          {deHoy.length === 0 ? (
            <p className="text-gray-500 text-sm">No tienes inspecciones para hoy.</p>
          ) : (
            <ListaInspecciones filas={deHoy} hoy={hoy} />
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Próximas</h2>
        {futuras.length === 0 && (
          <Card>
            <p className="text-gray-500 text-sm">No tienes inspecciones futuras programadas.</p>
          </Card>
        )}
        {[...futurasPorFecha.entries()].map(([fecha, inspeccionesDelDia]) => (
          <Card key={fecha} className="space-y-3">
            <h3 className="font-semibold text-gray-800">{fecha}</h3>
            <ListaInspecciones filas={inspeccionesDelDia} hoy={hoy} />
          </Card>
        ))}
      </section>
    </main>
  );
}
