"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Inspector = {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
};

export default function PaginaAdminInspectores() {
  const [inspectores, setInspectores] = useState<Inspector[]>([]);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargarInspectores() {
    const datos = await fetch("/api/admin/inspectores").then((r) => r.json());
    setInspectores(datos.inspectores ?? []);
  }

  useEffect(() => {
    let cancelado = false;
    fetch("/api/admin/inspectores")
      .then((r) => r.json())
      .then((datos) => {
        if (!cancelado) setInspectores(datos.inspectores ?? []);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function crearInspector(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch("/api/admin/inspectores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, nombre, password }),
    });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo crear el inspector.");
      return;
    }

    setEmail("");
    setNombre("");
    setPassword("");
    await cargarInspectores();
  }

  async function alternarActivo(id: string, activo: boolean) {
    await fetch(`/api/admin/inspectores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activo }),
    });
    await cargarInspectores();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Inspectores</h1>

      <Card className="space-y-4">
        <h2 className="font-semibold text-gray-800">Registrar nuevo inspector</h2>
        <form onSubmit={crearInspector} className="space-y-3">
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
            {cargando ? "Creando..." : "Crear inspector"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold text-gray-800">Inspectores registrados</h2>
        <p className="text-xs text-gray-500">
          Solo puede haber un inspector activo a la vez: activar uno desactiva automáticamente a los demás.
        </p>
        <ul className="divide-y text-sm">
          {inspectores.map((inspector) => (
            <li key={inspector.id} className="py-2 flex items-center justify-between">
              <span>{inspector.nombre} · {inspector.email}</span>
              <div className="flex items-center gap-3">
                <Badge tono={inspector.activo ? "verde" : "gris"}>{inspector.activo ? "Activo" : "Inactivo"}</Badge>
                <Button variante="secundario" onClick={() => alternarActivo(inspector.id, inspector.activo)}>
                  {inspector.activo ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
