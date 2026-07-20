"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { MONTO_TRAMITE_SOLES, MONTO_TRAMITE_COBRO_REAL_SOLES } from "@/lib/constantes";

type MedioPagoPresencial = "efectivo" | "tarjeta" | "yape";

type ResultadoRenovacion = { razonSocial: string; pdfUrl: string | null; fechaVencimiento: string };

export default function PaginaCajeroRenovar() {
  const [ruc, setRuc] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPagoPresencial>("efectivo");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRenovacion | null>(null);

  async function confirmarRenovacion(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (medioPago !== "efectivo" && !numeroOperacion.trim()) {
      setError("Ingresa el número de operación para dejar constancia del cobro.");
      return;
    }

    setCargando(true);

    const respuesta = await fetch("/api/cajero/renovar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruc, medioPago, numeroOperacion: numeroOperacion.trim() || undefined }),
    });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo registrar la renovación.");
      return;
    }

    setResultado(datos);
  }

  if (resultado) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        <Card className="space-y-3 text-center">
          <div className="text-green-600 text-4xl">✓</div>
          <h1 className="text-xl font-bold text-gray-900">Licencia renovada</h1>
          <p className="text-sm text-gray-600">{resultado.razonSocial}</p>
          <p className="text-sm"><span className="font-medium">Vigente hasta:</span> {resultado.fechaVencimiento}</p>
          {resultado.pdfUrl && (
            <a href={resultado.pdfUrl} target="_blank" rel="noreferrer">
              <Button variante="secundario" className="w-full">Descargar PDF</Button>
            </a>
          )}
          <Button
            onClick={() => {
              setResultado(null);
              setRuc("");
              setMedioPago("efectivo");
              setNumeroOperacion("");
            }}
            className="w-full"
          >
            Registrar otra renovación
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Renovar licencia</h1>
        <p className="text-gray-500 text-sm">
          Busca al negocio por RUC y cobra en ventanilla el derecho de trámite (S/ {MONTO_TRAMITE_SOLES.toFixed(2)}).
        </p>
      </div>

      <Card>
        <form onSubmit={confirmarRenovacion} className="space-y-4">
          <Input
            label="RUC del negocio"
            required
            inputMode="numeric"
            maxLength={11}
            value={ruc}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />

          <Select
            label="Método de pago"
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value as MedioPagoPresencial)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta (POS)</option>
            <option value="yape">Yape / Plin (QR)</option>
          </Select>

          {medioPago === "yape" && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-1 text-sm text-gray-600">
              <p>
                Genera el cobro por <strong>S/ {MONTO_TRAMITE_COBRO_REAL_SOLES.toFixed(2)}</strong> (modo prueba) en
                la app de Izipay y muestra el QR al cliente para que pague con Yape o Plin.
              </p>
              <p className="text-xs text-gray-400">
                Confirma el pago en tu app antes de registrar el cobro acá abajo.
              </p>
            </div>
          )}

          {medioPago !== "efectivo" && (
            <Input
              label="Número de operación"
              placeholder={medioPago === "yape" ? "Ej. 000123456" : "Ej. últimos 4 dígitos de la tarjeta"}
              value={numeroOperacion}
              onChange={(e) => setNumeroOperacion(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={cargando || ruc.length !== 11} className="w-full">
            {cargando ? "Registrando..." : `Confirmar pago S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}`}
          </Button>
        </form>
      </Card>
    </main>
  );
}
