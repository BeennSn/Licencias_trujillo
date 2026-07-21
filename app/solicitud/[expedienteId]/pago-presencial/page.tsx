"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { CamposCobroPresencial } from "@/components/cajero/CamposCobroPresencial";
import { useCobroPresencial } from "@/lib/hooks/useCobroPresencial";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";
import { pasoPorDefecto, puedeVerPago } from "@/lib/wizardPasos";

type ExpedienteResumen = {
  numeroExpediente: string;
  distrito: string | null;
  direccionLocal: string | null;
};

// Variante presencial del paso D del wizard (ver también .../pago): solo
// accesible para una sesión de cajero con caja abierta, cobra en ventanilla
// en vez de pasarela.
export default function PasoPagoPresencial() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();
  const { data: sesion, status: estadoSesion } = useSession();

  const [expediente, setExpediente] = useState<ExpedienteResumen | null>(null);
  const [cajaAbierta, setCajaAbierta] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const cobro = useCobroPresencial(MONTO_TRAMITE_SOLES);

  useEffect(() => {
    if (estadoSesion === "loading") return;

    if (sesion?.user?.rol !== "cajero") {
      router.replace(`/solicitud/${expedienteId}/pago`);
      return;
    }

    Promise.all([
      fetch(`/api/solicitudes/${expedienteId}`).then((r) => r.json()),
      fetch("/api/cajero/caja").then((r) => r.json()),
    ]).then(([datosExpediente, datosCaja]) => {
      if (!puedeVerPago(datosExpediente.expediente)) {
        router.replace(`/solicitud/${expedienteId}/${pasoPorDefecto(datosExpediente.expediente, "pago-presencial")}`);
        return;
      }
      setExpediente(datosExpediente.expediente);
      setCajaAbierta(datosCaja.caja?.estado === "abierta");
      setVerificandoAcceso(false);
    });
  }, [expedienteId, router, estadoSesion, sesion]);

  async function confirmarPago() {
    setError(null);

    const errorValidacion = cobro.validarParaEnviar();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/pago-presencial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medioPago: cobro.medioPago,
        numeroOperacion: cobro.numeroOperacion,
        montoEfectivo: cobro.medioPago === "mixto" ? Number(cobro.montoEfectivo) || 0 : undefined,
        montoYape: cobro.medioPago === "mixto" ? Number(cobro.montoYape) || 0 : undefined,
      }),
    });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo registrar el pago.");
      return;
    }

    router.push(`/solicitud/${expedienteId}/confirmacion`);
  }

  if (verificandoAcceso || !expediente) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
        <p className="text-sm text-gray-500">Cargando...</p>
      </main>
    );
  }

  if (!cajaAbierta) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
        <Card className="w-full max-w-md space-y-3 text-center">
          <p className="text-sm text-gray-700">Necesitas abrir tu caja antes de registrar un cobro.</p>
          <Link href="/cajero">
            <Button className="w-full">Ir a mi caja</Button>
          </Link>
        </Card>
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

          <CamposCobroPresencial cobro={cobro} montoTotal={MONTO_TRAMITE_SOLES} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={confirmarPago} disabled={cargando} className="w-full">
            {cargando ? "Registrando pago..." : `Confirmar pago S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}`}
          </Button>
        </Card>
      </div>
    </main>
  );
}
