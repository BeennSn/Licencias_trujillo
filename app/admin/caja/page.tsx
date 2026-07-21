"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ETIQUETAS_ESTADO_CAJA, type EstadoCaja } from "@/lib/estadosCaja";

type Sesion = {
  caja: {
    id: string;
    estado: EstadoCaja;
    montoApertura: string;
    abiertaEn: string;
    cierreSolicitadoEn: string | null;
    cerradaEn: string | null;
  };
  cajero: { id: string; nombre: string | null; email: string };
  aprobadaPor: { nombre: string | null; email: string } | null;
  totales: { total: number; totalesPorMedio: Record<string, number>; cantidadPagos: number };
};

function tonoEstadoCaja(estado: EstadoCaja) {
  if (estado === "abierta") return "verde" as const;
  if (estado === "cierre_solicitado") return "amarillo" as const;
  return "gris" as const;
}

export default function PaginaAdminCaja() {
  const [pendientes, setPendientes] = useState<Sesion[]>([]);
  const [historial, setHistorial] = useState<Sesion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  async function cargarTodo() {
    const datos = await fetch("/api/admin/caja").then((r) => r.json());
    setPendientes(datos.pendientes ?? []);
    setHistorial(datos.historial ?? []);
    setCargando(false);
  }

  useEffect(() => {
    let cancelado = false;
    fetch("/api/admin/caja")
      .then((r) => r.json())
      .then((datos) => {
        if (cancelado) return;
        setPendientes(datos.pendientes ?? []);
        setHistorial(datos.historial ?? []);
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
    await cargarTodo();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Caja</h1>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-800">Cierres pendientes de aprobación</h2>
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
                Abierta desde {new Date(caja.abiertaEn).toLocaleString("es-PE")} · apertura S/ {Number(caja.montoApertura).toFixed(2)}
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

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-800">Historial de sesiones de caja</h2>
        {!cargando && historial.length === 0 && <p className="text-sm text-gray-500">Sin sesiones registradas.</p>}
        <ul className="divide-y text-sm">
          {historial.map(({ caja, cajero, aprobadaPor, totales }) => (
            <li key={caja.id} className="py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{cajero.nombre ?? cajero.email}</span>
                <Badge tono={tonoEstadoCaja(caja.estado)}>{ETIQUETAS_ESTADO_CAJA[caja.estado]}</Badge>
              </div>
              <p className="text-xs text-gray-500">
                Abierta: {new Date(caja.abiertaEn).toLocaleString("es-PE")} · apertura S/ {Number(caja.montoApertura).toFixed(2)}
              </p>
              {caja.cerradaEn && (
                <p className="text-xs text-gray-500">
                  Cerrada: {new Date(caja.cerradaEn).toLocaleString("es-PE")}
                  {aprobadaPor && ` · aprobada por ${aprobadaPor.nombre ?? aprobadaPor.email}`}
                </p>
              )}
              <p className="text-gray-700">
                Total cobrado: S/ {totales.total.toFixed(2)} ({totales.cantidadPagos} pagos)
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
