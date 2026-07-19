"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function PaginaRecuperarPassword() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    setCargando(true);
    await fetch("/api/auth/recuperar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setCargando(false);
    setEnviado(true);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <Card className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="text-sm text-gray-500">
            Te enviaremos un enlace al correo con el que registraste tu negocio.
          </p>
        </div>

        {enviado ? (
          <p className="text-sm text-green-700">
            Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.
          </p>
        ) : (
          <form onSubmit={manejarEnvio} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? "Enviando..." : "Enviar enlace"}
            </Button>
          </form>
        )}

        <p className="text-xs text-gray-500">
          ¿Ya no tienes acceso a ese correo?{" "}
          <a href="mailto:soporte@licencias-trujillo.pe" className="text-blue-700 hover:underline">
            Contacta a soporte
          </a>
          .
        </p>

        <Link href="/login" className="text-sm text-gray-500 hover:underline block text-center">
          Volver a iniciar sesión
        </Link>
      </Card>
    </main>
  );
}
