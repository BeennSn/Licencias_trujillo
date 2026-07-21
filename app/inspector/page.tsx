import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { inspecciones, expedientes, negocios } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AutoRefresh } from "@/components/inspector/AutoRefresh";
import { aFechaIso } from "@/lib/diasHabilesPeru";

// Panel del inspector: solo las visitas pendientes de HOY (incluye
// atrasadas que aún no se realizan, para no perderlas de vista). No se
// muestran inspecciones futuras ni ya realizadas — apenas el inspector
// registra una decisión, esa visita deja de tener estado "programada" y
// desaparece de esta lista sola (AutoRefresh refresca la página sin que el
// inspector tenga que recargar a mano).
export default async function PaginaInspector() {
  const sesion = await auth();
  const hoy = aFechaIso(new Date());

  const filas = await db
    .select({ inspeccion: inspecciones, expediente: expedientes, negocio: negocios })
    .from(inspecciones)
    .innerJoin(expedientes, eq(inspecciones.expedienteId, expedientes.id))
    .innerJoin(negocios, eq(expedientes.negocioId, negocios.id))
    .where(and(eq(inspecciones.inspectorId, sesion!.user.id), eq(inspecciones.estado, "programada")))
    .orderBy(asc(inspecciones.fechaProgramada), asc(inspecciones.turno));

  const deHoy = filas.filter((f) => f.inspeccion.fechaProgramada <= hoy);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <AutoRefresh />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis inspecciones de hoy</h1>
        <p className="text-gray-500 text-sm">Visitas técnicas pendientes, ordenadas por turno.</p>
      </div>

      <Card>
        {deHoy.length === 0 ? (
          <p className="text-gray-500 text-sm">No tienes inspecciones pendientes por hoy.</p>
        ) : (
          <ul className="divide-y">
            {deHoy.map(({ inspeccion, expediente, negocio }) => (
              <li key={inspeccion.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {inspeccion.turno ? `Turno ${inspeccion.turno}` : "Turno sin asignar"} · {negocio.razonSocial}
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
        )}
      </Card>
    </main>
  );
}
