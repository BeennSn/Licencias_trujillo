"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Resultado = {
  encontrado: boolean;
  razonSocial?: string;
  numeroExpediente?: string | null;
  estadoExpediente?: string | null;
  licencia?: { estado: string; fechaVencimiento: string; pdfUrl: string | null } | null;
};

// Acepta tanto un RUC (11 dígitos) como un número de expediente
// (EXP-2026-000006): se detecta el formato del texto ingresado, así el
// negocio puede consultar con cualquiera de los dos datos que ya tiene.
function tipoDeBusqueda(valor: string): "ruc" | "expediente" | null {
  const limpio = valor.trim();
  if (/^\d{11}$/.test(limpio)) return "ruc";
  if (/^EXP-/i.test(limpio)) return "expediente";
  return null;
}

function ConsultaContenido() {
  const parametros = useSearchParams();
  const valorInicial = parametros.get("numeroExpediente") ?? parametros.get("ruc") ?? "";
  const [busqueda, setBusqueda] = useState(valorInicial);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipo = tipoDeBusqueda(busqueda);

  async function consultar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setResultado(null);

    if (!tipo) {
      setError("Ingresa un RUC de 11 dígitos o tu número de expediente (EXP-2026-000006).");
      return;
    }

    setCargando(true);
    const parametro = tipo === "ruc" ? `ruc=${encodeURIComponent(busqueda.trim())}` : `numeroExpediente=${encodeURIComponent(busqueda.trim())}`;
    const respuesta = await fetch(`/api/consulta-publica?${parametro}`);
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo realizar la consulta.");
      return;
    }

    setResultado(datos);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg space-y-6">
        <Card className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Consultar estado de mi trámite</h1>
            <p className="text-sm text-gray-500">
              Busca con tu RUC (11 dígitos) o tu número de expediente (EXP-2026-000006). Por seguridad del negocio
              no se muestra dirección, pagos ni observaciones.
            </p>
          </div>

          <form onSubmit={consultar} className="flex gap-2">
            <Input
              placeholder="RUC o N° de expediente"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={cargando || !tipo}>
              {cargando ? "Buscando..." : "Buscar"}
            </Button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {resultado && !resultado.encontrado && (
            <p className="text-sm text-gray-600">No se encontró ningún trámite con ese dato.</p>
          )}

          {resultado?.encontrado && (
            <div className="space-y-3 text-sm border-t pt-4">
              <p><span className="font-medium">Razón social:</span> {resultado.razonSocial}</p>
              {resultado.numeroExpediente && (
                <p><span className="font-medium">N° de expediente:</span> {resultado.numeroExpediente}</p>
              )}
              {resultado.estadoExpediente && (
                <p><span className="font-medium">Estado del trámite:</span> {resultado.estadoExpediente}</p>
              )}
              {resultado.licencia && (
                <>
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Licencia:</span>
                    <Badge tono={resultado.licencia.estado === "VIGENTE" || resultado.licencia.estado === "RENOVADA" ? "verde" : "rojo"}>
                      {resultado.licencia.estado}
                    </Badge>
                  </p>
                  <p><span className="font-medium">Vigente hasta:</span> {resultado.licencia.fechaVencimiento}</p>
                  {resultado.licencia.pdfUrl && (
                    <a href={resultado.licencia.pdfUrl} target="_blank" rel="noreferrer">
                      <Button variante="secundario" className="w-full">Descargar licencia (PDF)</Button>
                    </a>
                  )}
                </>
              )}
            </div>
          )}
        </Card>

        <Link href="/" className="text-sm text-gray-500 hover:underline block text-center">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

export default function PaginaConsulta() {
  return (
    <Suspense>
      <ConsultaContenido />
    </Suspense>
  );
}
