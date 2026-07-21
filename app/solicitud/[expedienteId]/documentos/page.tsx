"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { TAMANO_MAXIMO_DOCUMENTO_BYTES, TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS } from "@/lib/constantes";
import { pasoPorDefecto, puedeVerDocumentos } from "@/lib/wizardPasos";
import type { EstadoExpediente } from "@/lib/estadosExpediente";

type Documento = {
  id: string;
  urlArchivo: string;
};

export default function PasoDocumentos() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();
  const { data: sesion, status: estadoSesion } = useSession();
  // Un cajero atendiendo en ventanilla cobra en efectivo, sin pasarela: el
  // resto del wizard (RUC/domicilio/documentos) es igual para ambos canales.
  const pasoDePago = sesion?.user?.rol === "cajero" ? "pago-presencial" : "pago";

  const [documento, setDocumento] = useState<Documento | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [estadoExpediente, setEstadoExpediente] = useState<EstadoExpediente | null>(null);

  useEffect(() => {
    if (estadoSesion === "loading") return;

    fetch(`/api/solicitudes/${expedienteId}`)
      .then((r) => r.json())
      .then((datos) => {
        // Evita saltar a este paso sin haber fijado el domicilio, o volver a
        // él cuando el trámite ya avanzó más allá del pago.
        if (!puedeVerDocumentos(datos.expediente)) {
          router.replace(`/solicitud/${expedienteId}/${pasoPorDefecto(datos.expediente, pasoDePago)}`);
          return;
        }
        setEstadoExpediente(datos.expediente.estado);
        setVerificandoAcceso(false);
      });

    fetch(`/api/solicitudes/${expedienteId}/documentos`)
      .then((r) => r.json())
      .then((datos) => setDocumento((datos.documentos ?? [])[0] ?? null));
  }, [expedienteId, router, estadoSesion, pasoDePago]);

  const tienePlano = Boolean(documento);
  // Corrección de documentos entre la 1ra y la 2da inspección (ver
  // lib/estadosExpediente.ts): el pago ya está hecho, así que acá no hay
  // "siguiente paso" del wizard al que avanzar — solo se guarda el cambio y
  // se vuelve al panel desde donde se accedió.
  const corrigiendoEntreInspecciones = estadoExpediente === "SEGUNDA_INSPECCION_PROGRAMADA";
  // El negocio ya no tiene cuenta: llega acá reingresando su RUC (ver
  // app/api/solicitudes/route.ts), así que al terminar vuelve a la pantalla
  // de confirmación de SU propio expediente, no a un panel logueado.
  const panelDeRetorno =
    sesion?.user?.rol === "cajero" ? "/cajero" : `/solicitud/${expedienteId}/confirmacion`;

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
    setDocumento((listado.documentos ?? [])[0] ?? null);
    setArchivo(null);
  }

  async function eliminarDocumento() {
    if (!documento) return;
    setError(null);
    setEliminando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/documentos/${documento.id}`, {
      method: "DELETE",
    });
    const datos = await respuesta.json();
    setEliminando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo eliminar el documento.");
      return;
    }

    setDocumento(null);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg">
        <StepIndicator pasoActual={3} />
        <Card className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {corrigiendoEntreInspecciones ? "Corregir el plano del local" : "Plano del local"}
            </h1>
            <p className="text-sm text-gray-500">
              {corrigiendoEntreInspecciones
                ? "Sube el plano corregido según lo que observó el inspector en la primera visita."
                : "Sube el plano del local. Si subes otro archivo, reemplaza al anterior."}
            </p>
          </div>

          {documento ? (
            <div className="flex items-center justify-between border rounded px-3 py-2 text-sm">
              <a href={documento.urlArchivo} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                Ver plano subido
              </a>
              <button
                type="button"
                onClick={eliminarDocumento}
                disabled={eliminando}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                {eliminando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aún no subes el plano del local.</p>
          )}

          <form onSubmit={subirDocumento} className="space-y-4">
            <Input
              label="Archivo (PDF, JPG o PNG, máx. 10 MB)"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? "Subiendo..." : documento ? "Reemplazar plano" : "Subir plano"}
            </Button>
          </form>

          <Button
            onClick={() =>
              router.push(
                corrigiendoEntreInspecciones ? panelDeRetorno : `/solicitud/${expedienteId}/${pasoDePago}`
              )
            }
            disabled={!tienePlano}
            className="w-full"
          >
            {corrigiendoEntreInspecciones ? "Guardar y volver" : "Continuar al pago"}
          </Button>
          {!tienePlano && (
            <p className="text-xs text-gray-500 text-center">Sube el plano del local para continuar.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
