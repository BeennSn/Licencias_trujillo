"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function PaginaRestablecerPassword() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch("/api/auth/restablecer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo restablecer la contraseña.");
      return;
    }

    setListo(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <Card className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Crear nueva contraseña</h1>

        {listo ? (
          <p className="text-sm text-green-700">Contraseña actualizada. Redirigiendo al login...</p>
        ) : (
          <form onSubmit={manejarEnvio} className="space-y-4">
            <Input
              label="Nueva contraseña"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
