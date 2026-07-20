"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";

type ResultadoRenovacion = { razonSocial: string; pdfUrl: string | null; fechaVencimiento: string };

export default function PaginaCajeroRenovar() {
  const [ruc, setRuc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRenovacion | null>(null);

  async function confirmarRenovacion(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch("/api/cajero/renovar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruc }),
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
          Busca al negocio por RUC y cobra en efectivo el derecho de trámite (S/ {MONTO_TRAMITE_SOLES.toFixed(2)}).
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={cargando || ruc.length !== 11} className="w-full">
            {cargando ? "Registrando..." : `Confirmar pago en efectivo S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}`}
          </Button>
        </form>
      </Card>
    </main>
  );
}
