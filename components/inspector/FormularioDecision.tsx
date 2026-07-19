"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function FormularioDecision({ expedienteId, tipoInspeccion }: { expedienteId: string; tipoInspeccion: "primera" | "segunda" }) {
  const router = useRouter();
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviarDecision(decision: "conforme" | "observada") {
    if (decision === "observada" && observaciones.trim().length < 5) {
      setError("Describe la observación encontrada antes de registrar el resultado.");
      return;
    }

    setError(null);
    setCargando(true);

    const respuesta = await fetch(`/api/inspector/expediente/${expedienteId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, observaciones }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo registrar la decisión.");
      return;
    }

    if (datos.resultado === "aprobado") {
      setMensaje("Expediente aprobado. La licencia ya está disponible para el negocio.");
    } else if (datos.resultado === "segunda_inspeccion_programada") {
      setMensaje(`Se programó la segunda inspección para el ${datos.fechaSegundaInspeccion}.`);
    } else {
      setMensaje("El expediente quedó rechazado definitivamente.");
    }

    setTimeout(() => router.push("/inspector"), 2500);
  }

  if (mensaje) {
    return (
      <Card className="bg-green-50 border-green-200">
        <p className="text-green-800 font-medium">{mensaje}</p>
        <p className="text-sm text-green-700">Volviendo a tu lista de inspecciones...</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-gray-900">Registrar resultado de la visita</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-800">Observaciones (obligatorio si no está conforme)</span>
        <textarea
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={() => enviarDecision("conforme")} disabled={cargando} className="flex-1">
          Conforme
        </Button>
        <Button
          variante="peligro"
          onClick={() => enviarDecision("observada")}
          disabled={cargando}
          className="flex-1"
        >
          {tipoInspeccion === "primera" ? "Observada (programar 2da visita)" : "Observada (rechazar)"}
        </Button>
      </div>
    </Card>
  );
}
