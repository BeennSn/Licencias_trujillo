"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TAMANO_MAXIMO_DOCUMENTO_BYTES, TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS } from "@/lib/constantes";

type Elegibilidad =
  | { elegible: true; expedienteId: string; razonSocial: string; observaciones: string | null; documentoActual: string | null }
  | { elegible: false; motivo: string };

export default function PaginaCajeroDocumentos() {
  const [ruc, setRuc] = useState("");
  const [resultado, setResultado] = useState<Elegibilidad | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setResultado(null);
    setListo(false);
    setCargando(true);

    const respuesta = await fetch(`/api/cajero/documentos?ruc=${encodeURIComponent(ruc)}`);
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo consultar el RUC.");
      return;
    }

    setResultado(datos);
  }

  async function subirPlano() {
    if (!resultado?.elegible || !archivo) return;
    setError(null);

    if (!TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS.includes(archivo.type as (typeof TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS)[number])) {
      setError("Solo se aceptan archivos PDF, JPG o PNG.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_BYTES) {
      setError(`El archivo supera el tamaño máximo permitido (${TAMANO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024)} MB).`);
      return;
    }

    setSubiendo(true);
    const formulario = new FormData();
    formulario.append("archivo", archivo);

    const respuesta = await fetch(`/api/solicitudes/${resultado.expedienteId}/documentos`, {
      method: "POST",
      body: formulario,
    });
    const datos = await respuesta.json();
    setSubiendo(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo reemplazar el plano.");
      return;
    }

    setListo(true);
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10 space-y-4">
      <Link href="/cajero" className="text-xs text-gray-500 hover:underline">
        ← Volver al panel principal
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cambiar plano observado</h1>
        <p className="text-gray-500 text-sm">
          Solo disponible si el inspector marcó que la observación de la primera visita requiere cambiar el plano.
        </p>
      </div>

      <Card>
        <form onSubmit={buscar} className="space-y-4">
          <Input
            label="RUC del negocio"
            required
            inputMode="numeric"
            maxLength={11}
            value={ruc}
            onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={cargando || ruc.length !== 11} className="w-full">
            {cargando ? "Buscando..." : "Buscar negocio"}
          </Button>
        </form>
      </Card>

      {resultado && !resultado.elegible && (
        <Card>
          <p className="text-sm text-gray-600">{resultado.motivo}</p>
        </Card>
      )}

      {resultado?.elegible && !listo && (
        <Card className="space-y-3">
          <h2 className="font-semibold text-gray-900">{resultado.razonSocial}</h2>
          {resultado.observaciones && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Observación del inspector:</span> {resultado.observaciones}
            </p>
          )}
          {resultado.documentoActual && (
            <a href={resultado.documentoActual} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline">
              Ver plano actual
            </a>
          )}
          <Input
            label="Nuevo plano (PDF, JPG o PNG, máx. 10 MB)"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <Button onClick={subirPlano} disabled={!archivo || subiendo} className="w-full">
            {subiendo ? "Subiendo..." : "Reemplazar plano"}
          </Button>
        </Card>
      )}

      {listo && (
        <Card className="text-center space-y-2">
          <div className="text-green-600 text-3xl">✓</div>
          <p className="text-sm text-green-700">Plano reemplazado correctamente.</p>
        </Card>
      )}
    </main>
  );
}
