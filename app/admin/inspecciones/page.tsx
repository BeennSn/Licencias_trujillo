import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inspecciones, expedientes, negocios, usuarios } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Historial completo de inspecciones (primera y segunda), para trazabilidad:
// qué inspector visitó, cuándo, con qué resultado y si dejó pedido un
// cambio de plano (ver inspecciones.requiereCambioDocumento).
export default async function PaginaAdminInspecciones() {
  const filas = await db
    .select({ inspeccion: inspecciones, expediente: expedientes, negocio: negocios, inspector: usuarios })
    .from(inspecciones)
    .innerJoin(expedientes, eq(inspecciones.expedienteId, expedientes.id))
    .innerJoin(negocios, eq(expedientes.negocioId, negocios.id))
    .innerJoin(usuarios, eq(inspecciones.inspectorId, usuarios.id))
    .orderBy(desc(inspecciones.fechaProgramada), desc(inspecciones.createdAt));

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Inspecciones</h1>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b text-gray-500">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Turno</th>
              <th className="py-2 pr-4">Expediente</th>
              <th className="py-2 pr-4">Negocio</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">Inspector</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ inspeccion, expediente, negocio, inspector }) => (
              <tr key={inspeccion.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{inspeccion.fechaProgramada}</td>
                <td className="py-2 pr-4">{inspeccion.turno ?? "—"}</td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/expediente/${expediente.id}`} className="text-blue-700 hover:underline">
                    {expediente.numeroExpediente}
                  </Link>
                </td>
                <td className="py-2 pr-4">{negocio.razonSocial}</td>
                <td className="py-2 pr-4">{inspeccion.tipo === "primera" ? "1ra" : "2da"}</td>
                <td className="py-2 pr-4">{inspector.nombre ?? inspector.email}</td>
                <td className="py-2 pr-4">
                  <Badge tono={inspeccion.estado === "conforme" ? "verde" : inspeccion.estado === "observada" ? "rojo" : "azul"}>
                    {inspeccion.estado}
                  </Badge>
                </td>
                <td className="py-2 pr-4 max-w-xs">
                  {inspeccion.observaciones && <p className="text-gray-600">{inspeccion.observaciones}</p>}
                  {inspeccion.requiereCambioDocumento && <Badge tono="amarillo">Requiere cambio de plano</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
