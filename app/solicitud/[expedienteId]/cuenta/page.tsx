"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { pasoActualDelWizard } from "@/lib/wizardPasos";

export default function PasoCuenta() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);

  useEffect(() => {
    fetch(`/api/solicitudes/${expedienteId}`)
      .then((r) => r.json())
      .then((datos) => {
        // No dejar crear la cuenta (paso E) sin haber pagado antes (paso D).
        const paso = pasoActualDelWizard(datos.expediente);
        if (paso !== "cuenta") {
          router.replace(`/solicitud/${expedienteId}/${paso}`);
          return;
        }
        setVerificandoAcceso(false);
      });
  }, [expedienteId, router]);

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/cuenta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo crear la cuenta.");
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
        <StepIndicator pasoActual={5} />
        <Card className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Crea tu cuenta</h1>
            <p className="text-sm text-gray-500">
              Con este correo y contraseña podrás ver el estado de tu expediente, recibir notificaciones y
              renovar tu licencia más adelante. Solo se pide una vez.
            </p>
          </div>

          <form onSubmit={manejarEnvio} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Contraseña"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? "Creando cuenta..." : "Crear cuenta y finalizar"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
