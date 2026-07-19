"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function PaginaReportarCambio() {
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch("/api/negocio/reportar-cambio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo registrar el reporte.");
      return;
    }

    setEnviado(true);
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <Card className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reportar cambio de infraestructura</h1>
          <p className="text-sm text-gray-500">
            Todo cambio en la infraestructura de tu local debe reportarse. No hacerlo puede derivar en la
            clausura de tu licencia.
          </p>
        </div>

        {enviado ? (
          <p className="text-sm text-green-700">
            Reporte registrado. Será revisado por la municipalidad.
          </p>
        ) : (
          <form onSubmit={manejarEnvio} className="space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-800">Describe el cambio realizado</span>
              <textarea
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? "Enviando..." : "Enviar reporte"}
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
