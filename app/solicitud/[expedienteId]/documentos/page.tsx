"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { TAMANO_MAXIMO_DOCUMENTO_BYTES, TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS } from "@/lib/constantes";
import { pasoPorDefecto, puedeVerDocumentos } from "@/lib/wizardPasos";

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
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);

  useEffect(() => {
    fetch(`/api/solicitudes/${expedienteId}`)
      .then((r) => r.json())
      .then((datos) => {
        // Evita saltar a este paso sin haber fijado el domicilio, o volver a
        // él cuando el trámite ya avanzó más allá del pago.
        if (!puedeVerDocumentos(datos.expediente)) {
          router.replace(`/solicitud/${expedienteId}/${pasoPorDefecto(datos.expediente)}`);
          return;
        }
        setVerificandoAcceso(false);
      });

    fetch(`/api/solicitudes/${expedienteId}/documentos`)
      .then((r) => r.json())
      .then((datos) => setDocumentos(datos.documentos ?? []));
  }, [expedienteId, router]);

  const tienePlanoValido = documentos.some((d) => d.tipo === "plano_local" && !d.enTramite);

  if (verificandoAcceso) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
        <p className="text-sm text-gray-500">Cargando...</p>
      </main>
    );
  }

  async function subirDocumento(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("Ingresa el nombre del documento.");
      return;
    }

    if (!fechaVigencia) {
      setError("Selecciona la fecha de vigencia del documento.");
      return;
    }

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
    formulario.append("nombre", nombre.trim());
    formulario.append("fechaVigencia", fechaVigencia);
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
    setArchivo(null);
  }

  async function eliminarDocumento(documentoId: string) {
    setError(null);
    setEliminandoId(documentoId);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/documentos/${documentoId}`, {
      method: "DELETE",
    });
    const datos = await respuesta.json();
    setEliminandoId(null);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo eliminar el documento.");
      return;
    }

    setDocumentos((actuales) => actuales.filter((doc) => doc.id !== documentoId));
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

            <Input
              label="Nombre del documento"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />

            <Input
              label="Fecha de vigencia"
              type="date"
              required
              value={fechaVigencia}
              onChange={(e) => setFechaVigencia(e.target.value)}
            />

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
                  <span className="flex items-center gap-3">
                    <span className="text-green-700 text-xs font-semibold">Vigente</span>
                    <button
                      type="button"
                      onClick={() => eliminarDocumento(doc.id)}
                      disabled={eliminandoId === doc.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      {eliminandoId === doc.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </span>
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
