"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { MONTO_TRAMITE_SOLES, MONTO_TRAMITE_COBRO_REAL_SOLES, QR_YAPE_PLIN_IMAGEN } from "@/lib/constantes";
import { pasoPorDefecto, puedeVerPago } from "@/lib/wizardPasos";

type MedioPagoPresencial = "efectivo" | "tarjeta" | "yape";

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
  const [medioPago, setMedioPago] = useState<MedioPagoPresencial>("efectivo");
  const [numeroOperacion, setNumeroOperacion] = useState("");

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

    if (medioPago !== "efectivo" && !numeroOperacion.trim()) {
      setError("Ingresa el número de operación para dejar constancia del cobro.");
      return;
    }

    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/pago-presencial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medioPago, numeroOperacion: numeroOperacion.trim() || undefined }),
    });
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
            <h1 className="text-xl font-bold text-gray-900">Pago presencial</h1>
            <p className="text-sm text-gray-500">
              Cobra el derecho de trámite en ventanilla y confirma para programar la inspección.
            </p>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-1 text-sm">
            <p><span className="font-medium">Expediente:</span> {expediente.numeroExpediente}</p>
            <p><span className="font-medium">Distrito:</span> {expediente.distrito}</p>
            <p><span className="font-medium">Dirección:</span> {expediente.direccionLocal}</p>
          </div>

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
            <div className="rounded-md border border-gray-200 p-4 space-y-3 text-center">
              <Image
                src={QR_YAPE_PLIN_IMAGEN}
                alt="QR Yape/Plin con monto fijo"
                width={220}
                height={220}
                className="mx-auto"
              />
              <p className="text-sm text-gray-600">
                Monto fijo del QR: <strong>S/ {MONTO_TRAMITE_COBRO_REAL_SOLES.toFixed(2)}</strong> (modo prueba)
              </p>
              <p className="text-xs text-gray-400">
                Verifica en tu app que el pago llegó antes de confirmar.
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

          <Button onClick={confirmarPago} disabled={cargando} className="w-full">
            {cargando ? "Registrando pago..." : `Confirmar pago S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}`}
          </Button>
        </Card>
      </div>
    </main>
  );
}
