"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Estado = "verificando" | "aprobado" | "pendiente" | "rechazado";

// Página a la que Mercado Pago redirige de vuelta después de Checkout Pro
// (ver back_urls en app/api/negocio/renovar/route.ts). Solo lee el
// payment_id de la URL y le pide al backend que lo verifique contra la API
// real — nunca decide el resultado del pago por su cuenta.
function ResultadoRenovacionContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id") ?? searchParams.get("collection_id");

  const [estado, setEstado] = useState<Estado>(paymentId ? "verificando" : "rechazado");
  const [mensaje, setMensaje] = useState<string | null>(
    paymentId ? null : "No se recibió información del pago."
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;

    fetch("/api/negocio/renovar/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    })
      .then((r) => r.json())
      .then((datos) => {
        if (datos.ok) {
          setEstado("aprobado");
          setPdfUrl(datos.pdfUrl ?? null);
          return;
        }
        setEstado(datos.estado === "pending" || datos.estado === "in_process" ? "pendiente" : "rechazado");
        setMensaje(datos.motivo ?? datos.error ?? "El pago no pudo confirmarse.");
      })
      .catch(() => {
        setEstado("rechazado");
        setMensaje("No se pudo verificar el pago.");
      });
  }, [paymentId]);

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <Card className="space-y-4 text-center">
        {estado === "verificando" && <p className="text-sm text-gray-500">Verificando tu pago...</p>}

        {estado === "aprobado" && (
          <>
            <div className="text-green-600 text-4xl">✓</div>
            <p className="text-green-700 font-medium">Licencia renovada correctamente.</p>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <Button className="w-full">Descargar nueva licencia (PDF)</Button>
              </a>
            )}
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
            <Button onClick={() => router.push("/negocio/renovar")} className="w-full">
              Volver a intentar
            </Button>
          </>
        )}

        <Link href="/negocio" className="text-sm text-gray-500 hover:underline block text-center">
          Volver a mi negocio
        </Link>
      </Card>
    </main>
  );
}

export default function ResultadoRenovacion() {
  return (
    <Suspense>
      <ResultadoRenovacionContenido />
    </Suspense>
  );
}
