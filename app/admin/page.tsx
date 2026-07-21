import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { expedientes, negocios } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { BadgeEstadoExpediente } from "@/components/ui/Badge";
import { ETIQUETAS_ESTADO_EXPEDIENTE } from "@/lib/estadosExpediente";

// Vista global de supervisión para el administrador: todos los expedientes
// del sistema, sin importar el inspector asignado. Mantenida simple (solo
// tabla + filtros básicos), no es el foco del MVP.
export default async function PaginaAdminExpedientes() {
  const filas = await db
    .select({ expediente: expedientes, negocio: negocios })
    .from(expedientes)
    .innerJoin(negocios, eq(expedientes.negocioId, negocios.id))
    .orderBy(desc(expedientes.createdAt));

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Expedientes</h1>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b text-gray-500">
              <th className="py-2 pr-4">N° Expediente</th>
              <th className="py-2 pr-4">Negocio</th>
              <th className="py-2 pr-4">Distrito</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ expediente, negocio }) => (
              <tr key={expediente.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link href={`/admin/expediente/${expediente.id}`} className="text-blue-700 hover:underline">
                    {expediente.numeroExpediente}
                  </Link>
                </td>
                <td className="py-2 pr-4">{negocio.razonSocial}</td>
                <td className="py-2 pr-4">{expediente.distrito}</td>
                <td className="py-2 pr-4">{expediente.tipo}</td>
                <td className="py-2 pr-4">
                  <BadgeEstadoExpediente estado={expediente.estado} etiqueta={ETIQUETAS_ESTADO_EXPEDIENTE[expediente.estado]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
