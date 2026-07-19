"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// Login único para los 3 roles (negocio, inspector, admin): Auth.js valida
// las credenciales y guarda el rol en la sesión; /post-login decide a qué
// panel redirigir según ese rol.
export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const resultado = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setCargando(false);

    if (!resultado || resultado.error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    router.push("/post-login");
    router.refresh();
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <Card className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Iniciar sesión</h1>
          <p className="text-sm text-gray-500">Negocios, inspectores y administradores del sistema.</p>
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
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={cargando} className="w-full">
            {cargando ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <div className="text-sm text-center space-y-1">
          <Link href="/recuperar-password" className="text-blue-700 hover:underline block">
            Olvidé mi contraseña
          </Link>
          <Link href="/" className="text-gray-500 hover:underline block">
            Volver al inicio
          </Link>
        </div>
      </Card>
    </main>
  );
}
