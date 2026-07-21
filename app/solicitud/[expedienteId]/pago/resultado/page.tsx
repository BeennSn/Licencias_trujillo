"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StepIndicator } from "@/components/wizard/StepIndicator";

type Estado = "verificando" | "aprobado" | "pendiente" | "rechazado";

// Página a la que Mercado Pago redirige de vuelta después de Checkout Pro
// (ver back_urls en lib/pagos/mercadopago.ts::crearPreferenciaDeCobro).
// Solo lee el payment_id de la URL y le pide al backend que lo verifique
// contra la API real — nunca decide el resultado del pago por su cuenta.
function ResultadoPagoContenido() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id") ?? searchParams.get("collection_id");

  const [estado, setEstado] = useState<Estado>(paymentId ? "verificando" : "rechazado");
  const [mensaje, setMensaje] = useState<string | null>(
    paymentId ? null : "No se recibió información del pago."
  );

  useEffect(() => {
    if (!paymentId) return;

    fetch(`/api/solicitudes/${expedienteId}/pago/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    })
      .then((r) => r.json())
      .then((datos) => {
        if (datos.ok) {
          setEstado("aprobado");
          setTimeout(() => router.push(`/solicitud/${expedienteId}/confirmacion`), 1500);
          return;
        }
        setEstado(datos.estado === "pending" || datos.estado === "in_process" ? "pendiente" : "rechazado");
        setMensaje(datos.motivo ?? datos.error ?? "El pago no pudo confirmarse.");
      })
      .catch(() => {
        setEstado("rechazado");
        setMensaje("No se pudo verificar el pago.");
      });
  }, [expedienteId, router, paymentId]);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg">
        <StepIndicator pasoActual={4} />
        <Card className="space-y-4 text-center">
          {estado === "verificando" && <p className="text-sm text-gray-500">Verificando tu pago...</p>}

          {estado === "aprobado" && (
            <>
              <div className="text-green-600 text-4xl">✓</div>
              <p className="text-green-700 font-medium">¡Pago aprobado! Redirigiendo...</p>
            </>
          )}

          {estado === "pendiente" && (
            <>
              <p className="text-amber-700 font-medium">Tu pago quedó pendiente de confirmación.</p>
              {mensaje && <p className="text-sm text-gray-500">{mensaje}</p>}
            </>
          )}

          {estado === "rechazado" && (
            <>
              <p className="text-red-700 font-medium">El pago no se pudo completar.</p>
              {mensaje && <p className="text-sm text-gray-500">{mensaje}</p>}
              <Button onClick={() => router.push(`/solicitud/${expedienteId}/pago`)} className="w-full">
                Volver a intentar
              </Button>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}

export default function ResultadoPago() {
  return (
    <Suspense>
      <ResultadoPagoContenido />
    </Suspense>
  );
}
