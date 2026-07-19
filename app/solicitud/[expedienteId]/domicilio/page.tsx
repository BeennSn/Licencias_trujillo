"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { DISTRITOS_TRUJILLO } from "@/lib/distritosTrujillo";

export default function PasoDomicilio() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();

  const [distrito, setDistrito] = useState("");
  const [direccionLocal, setDireccionLocal] = useState("");
  const [giroActividad, setGiroActividad] = useState("");
  const [emailContacto, setEmailContacto] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/domicilio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distrito, direccionLocal, giroActividad, emailContacto, telefonoContacto }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo guardar el domicilio.");
      return;
    }

    router.push(`/solicitud/${expedienteId}/documentos`);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg">
        <StepIndicator pasoActual={2} />
        <Card className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Domicilio fiscal y del local</h1>
            <p className="text-sm text-gray-500">
              Solo se atienden trámites de negocios ubicados en la Provincia de Trujillo.
            </p>
          </div>

          <form onSubmit={manejarEnvio} className="space-y-4">
            <Select label="Distrito" required value={distrito} onChange={(e) => setDistrito(e.target.value)}>
              <option value="">Selecciona un distrito</option>
              {DISTRITOS_TRUJILLO.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>

            <Input
              label="Dirección del local"
              required
              value={direccionLocal}
              onChange={(e) => setDireccionLocal(e.target.value)}
            />

            <Input
              label="Giro / actividad económica"
              required
              value={giroActividad}
              onChange={(e) => setGiroActividad(e.target.value)}
            />

            <Input
              label="Correo de contacto"
              type="email"
              required
              value={emailContacto}
              onChange={(e) => setEmailContacto(e.target.value)}
            />

            <Input
              label="Teléfono de contacto"
              required
              value={telefonoContacto}
              onChange={(e) => setTelefonoContacto(e.target.value)}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? "Guardando..." : "Continuar"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
