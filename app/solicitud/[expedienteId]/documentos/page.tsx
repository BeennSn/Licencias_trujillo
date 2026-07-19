"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { TAMANO_MAXIMO_DOCUMENTO_BYTES, TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS } from "@/lib/constantes";

type Documento = {
  id: string;
  tipo: "plano_local" | "otro";
  nombre: string;
  urlArchivo: string;
  fechaVigencia: string;
  enTramite: boolean;
};

export default function PasoDocumentos() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [tipo, setTipo] = useState<"plano_local" | "otro">("plano_local");
  const [nombre, setNombre] = useState("");
  const [fechaVigencia, setFechaVigencia] = useState("");
  const [enTramite, setEnTramite] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch(`/api/solicitudes/${expedienteId}/documentos`)
      .then((r) => r.json())
      .then((datos) => setDocumentos(datos.documentos ?? []));
  }, [expedienteId]);

  const tienePlanoValido = documentos.some((d) => d.tipo === "plano_local" && !d.enTramite);

  async function subirDocumento(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!archivo) {
      setError("Selecciona un archivo para subir.");
      return;
    }

    if (!TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS.includes(archivo.type as (typeof TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS)[number])) {
      setError("Solo se aceptan archivos PDF, JPG o PNG.");
      return;
    }

    if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_BYTES) {
      setError(`El archivo supera el tamaño máximo permitido (${TAMANO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024)} MB).`);
      return;
    }

    setCargando(true);

    const formulario = new FormData();
    formulario.append("tipo", tipo);
    formulario.append("nombre", nombre || archivo.name);
    formulario.append("fechaVigencia", fechaVigencia);
    formulario.append("enTramite", String(enTramite));
    formulario.append("archivo", archivo);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/documentos`, {
      method: "POST",
      body: formulario,
    });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo subir el documento.");
      return;
    }

    const listado = await fetch(`/api/solicitudes/${expedienteId}/documentos`).then((r) => r.json());
    setDocumentos(listado.documentos ?? []);
    setNombre("");
    setFechaVigencia("");
    setEnTramite(false);
    setArchivo(null);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg">
        <StepIndicator pasoActual={3} />
        <Card className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Documentos del local</h1>
            <p className="text-sm text-gray-500">
              El plano del local es obligatorio. Todos los documentos deben estar <strong>vigentes</strong> (fecha
              futura) y <strong>no encontrarse en trámite</strong>.
            </p>
          </div>

          <form onSubmit={subirDocumento} className="space-y-4 border-b border-gray-200 pb-6">
            <Select label="Tipo de documento" value={tipo} onChange={(e) => setTipo(e.target.value as "plano_local" | "otro")}>
              <option value="plano_local">Plano del local (obligatorio)</option>
              <option value="otro">Otro documento</option>
            </Select>

            <Input label="Nombre del documento" value={nombre} onChange={(e) => setNombre(e.target.value)} />

            <Input
              label="Fecha de vigencia"
              type="date"
              required
              value={fechaVigencia}
              onChange={(e) => setFechaVigencia(e.target.value)}
            />

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={enTramite} onChange={(e) => setEnTramite(e.target.checked)} />
              Este documento está en trámite (aún no ha sido emitido)
            </label>

            <Input
              label="Archivo (PDF, JPG o PNG, máx. 10 MB)"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? "Subiendo..." : "Subir documento"}
            </Button>
          </form>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Documentos subidos</h2>
            {documentos.length === 0 && <p className="text-sm text-gray-400">Aún no subes documentos.</p>}
            <ul className="space-y-1 text-sm">
              {documentos.map((doc) => (
                <li key={doc.id} className="flex justify-between items-center border rounded px-3 py-2">
                  <span>
                    {doc.tipo === "plano_local" ? "Plano del local" : doc.nombre} · vigente hasta {doc.fechaVigencia}
                  </span>
                  {doc.enTramite ? (
                    <span className="text-yellow-700 text-xs font-semibold">En trámite (no válido)</span>
                  ) : (
                    <span className="text-green-700 text-xs font-semibold">Vigente</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <Button
            onClick={() => router.push(`/solicitud/${expedienteId}/pago`)}
            disabled={!tienePlanoValido}
            className="w-full"
          >
            Continuar al pago
          </Button>
          {!tienePlanoValido && (
            <p className="text-xs text-gray-500 text-center">
              Sube el plano del local (vigente, no en trámite) para continuar.
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
