"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Cajero = {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
};

export default function PaginaAdminCajeros() {
  const [cajeros, setCajeros] = useState<Cajero[]>([]);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargarCajeros() {
    const datos = await fetch("/api/admin/cajeros").then((r) => r.json());
    setCajeros(datos.cajeros ?? []);
  }

  useEffect(() => {
    let cancelado = false;
    fetch("/api/admin/cajeros")
      .then((r) => r.json())
      .then((datos) => {
        if (!cancelado) setCajeros(datos.cajeros ?? []);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function crearCajero(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch("/api/admin/cajeros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, nombre, password }),
    });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo crear el cajero.");
      return;
    }

    setEmail("");
    setNombre("");
    setPassword("");
    await cargarCajeros();
  }

  async function alternarActivo(id: string, activo: boolean) {
    await fetch(`/api/admin/cajeros/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activo }),
    });
    await cargarCajeros();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Cajeros</h1>

      <Card className="space-y-4">
        <h2 className="font-semibold text-gray-800">Registrar nuevo cajero</h2>
        <form onSubmit={crearCajero} className="space-y-3">
          <Input label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input label="Correo" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="Contraseña temporal"
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={cargando} className="w-full">
            {cargando ? "Creando..." : "Crear cajero"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold text-gray-800">Cajeros registrados</h2>
        <ul className="divide-y text-sm">
          {cajeros.map((cajero) => (
            <li key={cajero.id} className="py-2 flex items-center justify-between">
              <span>{cajero.nombre} · {cajero.email}</span>
              <div className="flex items-center gap-3">
                <Badge tono={cajero.activo ? "verde" : "gris"}>{cajero.activo ? "Activo" : "Inactivo"}</Badge>
                <Button variante="secundario" onClick={() => alternarActivo(cajero.id, cajero.activo)}>
                  {cajero.activo ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
