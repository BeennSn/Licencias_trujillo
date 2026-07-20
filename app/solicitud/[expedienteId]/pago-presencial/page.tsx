"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";
import { pasoPorDefecto, puedeVerPago } from "@/lib/wizardPasos";

type ExpedienteResumen = {
  numeroExpediente: string;
  distrito: string | null;
  direccionLocal: string | null;
};

// Variante presencial del paso D del wizard (ver también .../pago): solo
// accesible para una sesión de cajero, cobra en efectivo en vez de pasarela.
export default function PasoPagoPresencial() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();
  const { data: sesion, status: estadoSesion } = useSession();

  const [expediente, setExpediente] = useState<ExpedienteResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);

  useEffect(() => {
    if (estadoSesion === "loading") return;

    if (sesion?.user?.rol !== "cajero") {
      router.replace(`/solicitud/${expedienteId}/pago`);
      return;
    }

    fetch(`/api/solicitudes/${expedienteId}`)
      .then((r) => r.json())
      .then((datos) => {
        if (!puedeVerPago(datos.expediente)) {
          router.replace(`/solicitud/${expedienteId}/${pasoPorDefecto(datos.expediente, "pago-presencial")}`);
          return;
        }
        setExpediente(datos.expediente);
        setVerificandoAcceso(false);
      });
  }, [expedienteId, router, estadoSesion, sesion]);

  async function confirmarPago() {
    setError(null);
    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/pago-presencial`, { method: "POST" });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo registrar el pago.");
      return;
    }

    router.push(`/solicitud/${expedienteId}/cuenta`);
  }

  if (verificandoAcceso || !expediente) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
        <p className="text-sm text-gray-500">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg">
        <StepIndicator pasoActual={4} />
        <Card className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pago presencial en efectivo</h1>
            <p className="text-sm text-gray-500">
              Cobra el derecho de trámite en efectivo y confirma para programar la inspección.
            </p>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-1 text-sm">
            <p><span className="font-medium">Expediente:</span> {expediente.numeroExpediente}</p>
            <p><span className="font-medium">Distrito:</span> {expediente.distrito}</p>
            <p><span className="font-medium">Dirección:</span> {expediente.direccionLocal}</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={confirmarPago} disabled={cargando} className="w-full">
            {cargando ? "Registrando pago..." : `Confirmar pago en efectivo S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}`}
          </Button>
        </Card>
      </div>
    </main>
  );
}
