"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { MONTO_TRAMITE_SOLES, MONTO_TRAMITE_COBRO_REAL_SOLES } from "@/lib/constantes";
import { pasoPorDefecto, puedeVerPago } from "@/lib/wizardPasos";

type MedioPagoPresencial = "efectivo" | "tarjeta" | "yape" | "mixto";

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
  const [medioPago, setMedioPago] = useState<MedioPagoPresencial>("efectivo");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoYape, setMontoYape] = useState("");

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

  const sumaMixto = (Number(montoEfectivo) || 0) + (Number(montoYape) || 0);

  async function confirmarPago() {
    setError(null);

    if (medioPago === "yape" && !numeroOperacion.trim()) {
      setError("Ingresa el número de operación para dejar constancia del cobro.");
      return;
    }

    if (medioPago === "mixto") {
      if (Math.round(sumaMixto * 100) !== Math.round(MONTO_TRAMITE_SOLES * 100)) {
        setError(`La suma de efectivo y Yape debe ser exactamente S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}.`);
        return;
      }
      if (Number(montoYape) > 0 && !numeroOperacion.trim()) {
        setError("Ingresa el número de operación del pago por Yape.");
        return;
      }
    }

    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/pago-presencial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medioPago,
        numeroOperacion: numeroOperacion.trim() || undefined,
        montoEfectivo: medioPago === "mixto" ? Number(montoEfectivo) || 0 : undefined,
        montoYape: medioPago === "mixto" ? Number(montoYape) || 0 : undefined,
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

          <Select
            label="Método de pago"
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value as MedioPagoPresencial)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta (POS)</option>
            <option value="yape">Yape / Plin (QR)</option>
            <option value="mixto">Mixto (efectivo + Yape)</option>
          </Select>

          {(medioPago === "yape" || medioPago === "mixto") && (
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

          {medioPago === "mixto" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Efectivo (S/)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoEfectivo}
                  onChange={(e) => setMontoEfectivo(e.target.value)}
                />
                <Input
                  label="Yape (S/)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoYape}
                  onChange={(e) => setMontoYape(e.target.value)}
                />
              </div>
              <p className={`text-xs ${Math.round(sumaMixto * 100) === Math.round(MONTO_TRAMITE_SOLES * 100) ? "text-green-700" : "text-gray-500"}`}>
                Suma: S/ {sumaMixto.toFixed(2)} de S/ {MONTO_TRAMITE_SOLES.toFixed(2)}
              </p>
            </div>
          )}

          {(medioPago === "yape" || (medioPago === "mixto" && Number(montoYape) > 0)) && (
            <Input
              label="Número de operación (Yape)"
              placeholder="Ej. 000123456"
              value={numeroOperacion}
              onChange={(e) => setNumeroOperacion(e.target.value)}
            />
          )}

          {medioPago === "tarjeta" && (
            <Input
              label="Número de operación"
              placeholder="Ej. últimos 4 dígitos de la tarjeta"
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
