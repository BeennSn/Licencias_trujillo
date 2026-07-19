"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";

function generarTokenDePrueba(medioPago: string) {
  return `token_test_${medioPago}_${Date.now()}`;
}

export default function PaginaRenovar() {
  const [mismoLocal, setMismoLocal] = useState<"si" | "no" | null>(null);
  const [medioPago, setMedioPago] = useState<"tarjeta" | "yape" | "pagoefectivo">("tarjeta");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function renovar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch("/api/negocio/renovar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mismoLocal: true,
        medioPago,
        email,
        tokenPago: generarTokenDePrueba(medioPago),
      }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo procesar la renovación.");
      return;
    }

    setPdfUrl(datos.pdfUrl);
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <Card className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Renovar licencia</h1>
          <p className="text-sm text-gray-500">
            La renovación es automática con solo el pago del derecho de trámite, siempre que sea el mismo local.
          </p>
        </div>

        {pdfUrl ? (
          <div className="space-y-3 text-sm">
            <p className="text-green-700 font-medium">Licencia renovada correctamente.</p>
            <a href={pdfUrl} target="_blank" rel="noreferrer">
              <Button className="w-full">Descargar nueva licencia (PDF)</Button>
            </a>
          </div>
        ) : mismoLocal === null ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-800">¿Vas a operar en el mismo local?</p>
            <div className="flex gap-3">
              <Button onClick={() => setMismoLocal("si")} className="flex-1">Sí, mismo local</Button>
              <Button variante="secundario" onClick={() => setMismoLocal("no")} className="flex-1">
                No, es otro local
              </Button>
            </div>
          </div>
        ) : mismoLocal === "no" ? (
          <div className="space-y-3 text-sm">
            <p className="text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-3">
              Si cambiaste de local, no aplica la renovación automática: debes iniciar un trámite nuevo completo
              (con nueva inspección y nuevo pago del derecho de trámite).
            </p>
            <Link href="/solicitud/nuevo">
              <Button className="w-full">Iniciar trámite nuevo</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={renovar} className="space-y-4">
            <Select label="Medio de pago" value={medioPago} onChange={(e) => setMedioPago(e.target.value as "tarjeta" | "yape" | "pagoefectivo")}>
              <option value="tarjeta">Tarjeta de crédito/débito</option>
              <option value="yape">Yape</option>
              <option value="pagoefectivo">PagoEfectivo</option>
            </Select>
            <Input
              label="Correo para el comprobante"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? "Procesando..." : `Pagar S/ ${MONTO_TRAMITE_SOLES.toFixed(2)} y renovar`}
            </Button>
          </form>
        )}

        <Link href="/negocio" className="text-sm text-gray-500 hover:underline block text-center">
          Volver a mi negocio
        </Link>
      </Card>
    </main>
  );
}
