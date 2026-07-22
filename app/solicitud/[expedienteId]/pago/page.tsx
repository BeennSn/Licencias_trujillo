"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";
import { pasoPorDefecto, puedeVerPago } from "@/lib/wizardPasos";

const mercadoPagoConfigurado = Boolean(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);

// Solo se usa en modo simulado (ver más abajo), cuando todavía no hay
// credenciales reales de Mercado Pago configuradas.
function generarTokenDePrueba(medioPago: string, simularRechazo: boolean) {
  const prefijo = simularRechazo ? "token_test_fail" : `token_test_${medioPago}`;
  return `${prefijo}_${Date.now()}`;
}

export default function PasoPago() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();
  const { data: sesion, status: estadoSesion } = useSession();

  const [medioPago, setMedioPago] = useState<"tarjeta" | "yape" | "pagoefectivo">("tarjeta");
  const [email, setEmail] = useState("");
  const [simularRechazo, setSimularRechazo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);

  useEffect(() => {
    if (estadoSesion === "loading") return;

    // Un cajero cobra en ventanilla (efectivo/Yape/mixto), nunca por
    // Mercado Pago: si llega acá (sesión cargó después del primer render,
    // link directo, etc.) se le manda a su propio paso de pago.
    if (sesion?.user?.rol === "cajero") {
      router.replace(`/solicitud/${expedienteId}/pago-presencial`);
      return;
    }

    fetch(`/api/solicitudes/${expedienteId}`)
      .then((r) => r.json())
      .then((datos) => {
        // Evita pagar sin documentos completos, o volver a pagar cuando el
        // trámite ya pasó a la etapa de creación de cuenta.
        if (!puedeVerPago(datos.expediente)) {
          router.replace(`/solicitud/${expedienteId}/${pasoPorDefecto(datos.expediente)}`);
          return;
        }
        setVerificandoAcceso(false);
      });
  }, [expedienteId, router, estadoSesion, sesion]);

  // Con Mercado Pago configurado: crea la preferencia y redirige a su
  // plataforma (Checkout Pro), donde el negocio elige tarjeta/Yape/
  // PagoEfectivo. El resultado se confirma después en .../pago/resultado.
  async function irAMercadoPago(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.initPoint) {
      setCargando(false);
      setError(datos.error ?? "No se pudo iniciar el pago.");
      return;
    }

    window.location.href = datos.initPoint;
  }

  async function pagarSimulado(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const tokenPago = generarTokenDePrueba(medioPago, simularRechazo);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medioPago, tokenPago, email }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.motivo ?? datos.error ?? "El pago no pudo procesarse.");
      return;
    }

    router.push(`/solicitud/${expedienteId}/confirmacion`);
  }

  if (verificandoAcceso) {
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
          <Link href="/" className="text-xs text-gray-500 hover:underline">
            ← Volver al inicio
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Derecho de trámite</h1>
            <p className="text-sm text-gray-500">
              Pago único de <strong>S/ {MONTO_TRAMITE_SOLES.toFixed(2)}</strong> para programar tu inspección técnica.
            </p>
            {!mercadoPagoConfigurado && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                Modo de pruebas: esta pasarela está simulada mientras se configura Mercado Pago.
                Ningún cobro real se realiza.
              </p>
            )}
          </div>

          {mercadoPagoConfigurado ? (
            <form onSubmit={irAMercadoPago} className="space-y-4">
              <Input
                label="Correo para el comprobante de pago"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" disabled={cargando} className="w-full">
                {cargando ? "Redirigiendo..." : "Pagar con Mercado Pago"}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Se abrirá la plataforma de Mercado Pago para elegir tarjeta, Yape o PagoEfectivo.
              </p>
            </form>
          ) : (
            <form onSubmit={pagarSimulado} className="space-y-4">
              <Select
                label="Medio de pago"
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value as "tarjeta" | "yape" | "pagoefectivo")}
              >
                <option value="tarjeta">Tarjeta de crédito/débito</option>
                <option value="yape">Yape</option>
                <option value="pagoefectivo">PagoEfectivo</option>
              </Select>

              <Input
                label="Correo para el comprobante de pago"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={simularRechazo}
                  onChange={(e) => setSimularRechazo(e.target.checked)}
                />
                Simular pago rechazado (solo para pruebas)
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" disabled={cargando} className="w-full">
                {cargando ? "Procesando pago..." : `Pagar S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}`}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
