import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pagos, expedientes, negocios, usuarios } from "@/lib/db/schema";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Historial completo de pagos (web y presencial), para trazabilidad: quién
// cobró (si fue en caja), por qué medio, cuánto y a qué expediente
// corresponde. Sin filtro por defecto — es el registro completo.
export default async function PaginaAdminPagos() {
  const filas = await db
    .select({ pago: pagos, expediente: expedientes, negocio: negocios, cajero: usuarios })
    .from(pagos)
    .innerJoin(expedientes, eq(pagos.expedienteId, expedientes.id))
    .innerJoin(negocios, eq(expedientes.negocioId, negocios.id))
    .leftJoin(usuarios, eq(pagos.registradoPorId, usuarios.id))
    .orderBy(desc(pagos.createdAt));

  const totalAprobado = filas
    .filter(({ pago }) => pago.estado === "aprobado")
    .reduce((suma, { pago }) => suma + Number(pago.monto), 0);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <p className="text-sm text-gray-500">Total aprobado: S/ {totalAprobado.toFixed(2)} ({filas.length} pagos)</p>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b text-gray-500">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Expediente</th>
              <th className="py-2 pr-4">Negocio</th>
              <th className="py-2 pr-4">Monto</th>
              <th className="py-2 pr-4">Medio</th>
              <th className="py-2 pr-4">Canal</th>
              <th className="py-2 pr-4">Registrado por</th>
              <th className="py-2 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ pago, expediente, negocio, cajero }) => (
              <tr key={pago.id} className="border-b last:border-0">
                <td className="py-2 pr-4 whitespace-nowrap">{new Date(pago.createdAt).toLocaleString("es-PE")}</td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/expediente/${expediente.id}`} className="text-blue-700 hover:underline">
                    {expediente.numeroExpediente}
                  </Link>
                </td>
                <td className="py-2 pr-4">{negocio.razonSocial}</td>
                <td className="py-2 pr-4 whitespace-nowrap">S/ {Number(pago.monto).toFixed(2)}</td>
                <td className="py-2 pr-4">{pago.medioPago}</td>
                <td className="py-2 pr-4">{pago.canal}</td>
                <td className="py-2 pr-4">{cajero?.nombre ?? cajero?.email ?? "—"}</td>
                <td className="py-2 pr-4">
                  <Badge tono={pago.estado === "aprobado" ? "verde" : pago.estado === "rechazado" ? "rojo" : "amarillo"}>
                    {pago.estado}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
