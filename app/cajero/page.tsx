"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ETIQUETAS_ESTADO_CAJA } from "@/lib/estadosCaja";

type Totales = { total: number; totalesPorMedio: Record<string, number>; cantidadPagos: number };
type Caja = { id: string; estado: "abierta" | "cierre_solicitado" | "cerrada"; abiertaEn: string } | null;

export default function PaginaCajero() {
  const [caja, setCaja] = useState<Caja>(null);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarEstado() {
    const respuesta = await fetch("/api/cajero/caja");
    const datos = await respuesta.json();
    setCaja(datos.caja ?? null);
    setTotales(datos.totales ?? null);
    setCargando(false);
  }

  useEffect(() => {
    let cancelado = false;
    fetch("/api/cajero/caja")
      .then((r) => r.json())
      .then((datos) => {
        if (cancelado) return;
        setCaja(datos.caja ?? null);
        setTotales(datos.totales ?? null);
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function abrirCaja() {
    setError(null);
    setProcesando(true);
    const respuesta = await fetch("/api/cajero/caja", { method: "POST" });
    const datos = await respuesta.json();
    setProcesando(false);
    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo abrir la caja.");
      return;
    }
    await cargarEstado();
  }

  async function solicitarCierre() {
    setError(null);
    setProcesando(true);
    const respuesta = await fetch("/api/cajero/caja/solicitar-cierre", { method: "POST" });
    const datos = await respuesta.json();
    setProcesando(false);
    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo solicitar el cierre.");
      return;
    }
    await cargarEstado();
  }

  if (cargando) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        <p className="text-sm text-gray-500">Cargando...</p>
      </main>
    );
  }

  // Sin caja abierta (nunca abrió una, o la última quedó cerrada): tiene que
  // abrir una nueva antes de poder hacer cualquier trámite u cobro.
  if (!caja || caja.estado !== "abierta") {
    return (
      <main className="max-w-lg mx-auto px-4 py-10 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atención presencial</h1>
          <p className="text-gray-500 text-sm">Debes abrir tu caja para empezar a atender.</p>
        </div>

        <Card className="space-y-4 text-center">
          {caja?.estado === "cierre_solicitado" ? (
            <>
              <Badge tono="amarillo">Cierre pendiente de aprobación</Badge>
              <p className="text-sm text-gray-600">
                Ya solicitaste el cierre de tu caja. Espera a que el administrador lo apruebe (o lo rechace, si
                fue un error) antes de seguir cobrando.
              </p>
              {totales && (
                <p className="text-xs text-gray-500">
                  Total de esta sesión: S/ {totales.total.toFixed(2)} ({totales.cantidadPagos} pagos)
                </p>
              )}
              <Button onClick={cargarEstado} variante="secundario" className="w-full">
                Actualizar
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">No tienes una caja abierta en este momento.</p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button onClick={abrirCaja} disabled={procesando} className="w-full">
                {procesando ? "Abriendo..." : "Abrir caja"}
              </Button>
            </>
          )}
        </Card>
      </main>
    );
  }

  // Caja abierta: puede operar con normalidad.
  return (
    <main className="max-w-lg mx-auto px-4 py-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atención presencial</h1>
          <p className="text-gray-500 text-sm">Registra trámites de negocios que se acercan a la ventanilla.</p>
        </div>
        <Badge tono="verde">{ETIQUETAS_ESTADO_CAJA[caja.estado]}</Badge>
      </div>

      <Link href="/solicitud/nuevo">
        <Card className="hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
          <h2 className="font-semibold text-gray-900">Nueva solicitud</h2>
          <p className="text-sm text-gray-500">
            Registra el RUC, domicilio, documentos y pago de un trámite nuevo.
          </p>
        </Card>
      </Link>

      <Link href="/cajero/renovar">
        <Card className="hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
          <h2 className="font-semibold text-gray-900">Renovar licencia</h2>
          <p className="text-sm text-gray-500">Busca al negocio por RUC y cobra la renovación de su licencia.</p>
        </Card>
      </Link>

      <Link href="/cajero/documentos">
        <Card className="hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
          <h2 className="font-semibold text-gray-900">Cambiar plano observado</h2>
          <p className="text-sm text-gray-500">
            Reemplaza el plano de un negocio cuyo inspector pidió corregirlo antes de la segunda visita.
          </p>
        </Card>
      </Link>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-800">Cierre de caja</h2>
        {totales && (
          <div className="text-sm text-gray-600 space-y-1">
            <p>Total cobrado en esta sesión: S/ {totales.total.toFixed(2)}</p>
            {Object.entries(totales.totalesPorMedio).map(([medio, monto]) => (
              <p key={medio} className="text-xs text-gray-500">
                {medio}: S/ {monto.toFixed(2)}
              </p>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={solicitarCierre} disabled={procesando} variante="secundario" className="w-full">
          {procesando ? "Enviando..." : "Solicitar cierre de caja"}
        </Button>
      </Card>
    </main>
  );
}
