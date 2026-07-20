"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { MONTO_TRAMITE_SOLES } from "@/lib/constantes";
import { pasoPorDefecto, puedeVerPago } from "@/lib/wizardPasos";

const CLAVE_PUBLICA_MP = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

// Yape y PagoEfectivo no usan token de tarjeta (se envían directo por
// payment_method_id, ver lib/pagos/mercadopago.ts) y tarjeta cuando Mercado
// Pago todavía no está configurado (desarrollo/demo) siguen simulados con
// un token falso, para no bloquear el resto del flujo sin credenciales.
function generarTokenDePrueba(medioPago: string, simularRechazo: boolean) {
  const prefijo = simularRechazo ? "token_test_fail" : `token_test_${medioPago}`;
  return `${prefijo}_${Date.now()}`;
}

export default function PasoPago() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();

  const [medioPago, setMedioPago] = useState<"tarjeta" | "yape" | "pagoefectivo">("tarjeta");
  const [email, setEmail] = useState("");
  const [simularRechazo, setSimularRechazo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);

  const mercadoPagoConfigurado = Boolean(CLAVE_PUBLICA_MP);
  // Con tarjeta y Mercado Pago configurado, el Card Payment Brick reemplaza
  // el formulario simple: tokeniza la tarjeta de verdad en el navegador
  // (nunca toca nuestro backend), algo que un formulario propio no puede
  // hacer sin perder el cumplimiento PCI DSS.
  const usarBrickDeTarjeta = mercadoPagoConfigurado && medioPago === "tarjeta";

  useEffect(() => {
    if (CLAVE_PUBLICA_MP) initMercadoPago(CLAVE_PUBLICA_MP, { locale: "es-PE" });
  }, []);

  useEffect(() => {
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
  }, [expedienteId, router]);

  async function confirmarPago(cuerpo: {
    tokenPago: string;
    email: string;
    paymentMethodId?: string;
    issuerId?: string;
  }) {
    setError(null);
    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medioPago, ...cuerpo }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      const mensaje = datos.motivo ?? datos.error ?? "El pago no pudo procesarse.";
      setError(mensaje);
      throw new Error(mensaje);
    }

    router.push(`/solicitud/${expedienteId}/cuenta`);
  }

  async function pagarSimulado(evento: React.FormEvent) {
    evento.preventDefault();
    const tokenPago = generarTokenDePrueba(medioPago, simularRechazo);
    await confirmarPago({ tokenPago, email }).catch(() => {});
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

          <Select
            label="Medio de pago"
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value as "tarjeta" | "yape" | "pagoefectivo")}
          >
            <option value="tarjeta">Tarjeta de crédito/débito</option>
            <option value="yape">Yape</option>
            <option value="pagoefectivo">PagoEfectivo</option>
          </Select>

          {usarBrickDeTarjeta ? (
            <div className="space-y-3">
              <CardPayment
                initialization={{ amount: MONTO_TRAMITE_SOLES, payer: { email: email || undefined } }}
                customization={{ paymentMethods: { minInstallments: 1, maxInstallments: 1 } }}
                onSubmit={async (formData) => {
                  await confirmarPago({
                    tokenPago: formData.token,
                    email: formData.payer.email ?? email,
                    paymentMethodId: formData.payment_method_id,
                    issuerId: formData.issuer_id,
                  });
                }}
                onError={(err) => setError(err.message || "Ocurrió un error con el formulario de pago.")}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          ) : (
            <form onSubmit={pagarSimulado} className="space-y-4">
              <Input
                label="Correo para el comprobante de pago"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {!mercadoPagoConfigurado && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={simularRechazo}
                    onChange={(e) => setSimularRechazo(e.target.checked)}
                  />
                  Simular pago rechazado (solo para pruebas)
                </label>
              )}

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
