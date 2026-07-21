"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Pendiente = {
  caja: { id: string; abiertaEn: string; cierreSolicitadoEn: string | null };
  cajero: { id: string; nombre: string | null; email: string };
  totales: { total: number; totalesPorMedio: Record<string, number>; cantidadPagos: number };
};

export default function PaginaAdminCaja() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  async function cargarPendientes() {
    const datos = await fetch("/api/admin/caja").then((r) => r.json());
    setPendientes(datos.pendientes ?? []);
    setCargando(false);
  }

  useEffect(() => {
    let cancelado = false;
    fetch("/api/admin/caja")
      .then((r) => r.json())
      .then((datos) => {
        if (cancelado) return;
        setPendientes(datos.pendientes ?? []);
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function resolver(id: string, accion: "aprobar" | "rechazar") {
    setProcesandoId(id);
    await fetch(`/api/admin/caja/${id}/${accion}`, { method: "POST" });
    setProcesandoId(null);
    await cargarPendientes();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Cierres de caja pendientes</h1>

      <Card className="space-y-3">
        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
        {!cargando && pendientes.length === 0 && (
          <p className="text-sm text-gray-500">No hay solicitudes de cierre pendientes.</p>
        )}
        <ul className="divide-y text-sm">
          {pendientes.map(({ caja, cajero, totales }) => (
            <li key={caja.id} className="py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{cajero.nombre ?? cajero.email}</span>
                <Badge tono="amarillo">Cierre pendiente</Badge>
              </div>
              <p className="text-xs text-gray-500">
                Abierta desde {new Date(caja.abiertaEn).toLocaleString("es-PE")}
              </p>
              <p className="text-gray-700">
                Total cobrado: S/ {totales.total.toFixed(2)} ({totales.cantidadPagos} pagos)
              </p>
              {Object.entries(totales.totalesPorMedio).map(([medio, monto]) => (
                <p key={medio} className="text-xs text-gray-500">
                  {medio}: S/ {monto.toFixed(2)}
                </p>
              ))}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => resolver(caja.id, "aprobar")}
                  disabled={procesandoId === caja.id}
                  className="flex-1"
                >
                  Aprobar cierre
                </Button>
                <Button
                  onClick={() => resolver(caja.id, "rechazar")}
                  disabled={procesandoId === caja.id}
                  variante="secundario"
                  className="flex-1"
                >
                  Rechazar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
