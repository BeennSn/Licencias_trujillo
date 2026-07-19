"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";

type ResultadoRuc =
  | {
      disponible: true;
      ruc: string;
      razonSocial: string;
      estado: string;
      condicion: string;
      tienePresenciaEnTrujillo: boolean;
      esValidoParaTramite: boolean;
    }
  | { disponible: false; motivo: string; bloqueante: boolean };

export default function PasoRuc() {
  const router = useRouter();
  const [ruc, setRuc] = useState("");
  const [resultado, setResultado] = useState<ResultadoRuc | null>(null);
  const [razonSocialManual, setRazonSocialManual] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tramiteBloqueado, setTramiteBloqueado] = useState<string | null>(null);

  async function consultar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setResultado(null);
    setCargando(true);

    const respuesta = await fetch(`/api/ruc/consultar?ruc=${encodeURIComponent(ruc)}`);
    const datos: ResultadoRuc = await respuesta.json();
    setCargando(false);
    setResultado(datos);
  }

  async function continuar() {
    if (!resultado) return;

    const razonSocial = resultado.disponible ? resultado.razonSocial : razonSocialManual;
    if (!razonSocial) {
      setError("Ingresa la razón social del negocio.");
      return;
    }

    setCargando(true);
    setError(null);
    setTramiteBloqueado(null);

    const respuesta = await fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruc,
        razonSocial,
        estadoSunat: resultado.disponible ? resultado.estado : undefined,
        condicionHabido: resultado.disponible ? resultado.condicion : undefined,
      }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      // Ya tiene una inspección programada (o más adelante): no hay nada
      // que completar en el wizard, debe entrar con su cuenta.
      if (datos.tramiteBloqueado) {
        setTramiteBloqueado(datos.error);
        return;
      }
      setError(datos.error ?? "No se pudo crear la solicitud.");
      return;
    }

    router.push(`/solicitud/${datos.expedienteId}/domicilio`);
  }

  const puedeContinuar =
    resultado &&
    (resultado.disponible
      ? resultado.esValidoParaTramite
      : !resultado.bloqueante && razonSocialManual.trim().length > 3);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg">
        <StepIndicator pasoActual={1} />
        <Card className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ingresa el RUC de tu negocio</h1>
            <p className="text-sm text-gray-500">
              Validamos tu RUC contra el registro de SUNAT para confirmar que tu negocio es real y está activo.
            </p>
          </div>

          <form onSubmit={consultar} className="flex gap-2">
            <Input
              placeholder="11 dígitos"
              value={ruc}
              onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
              maxLength={11}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={cargando || ruc.length !== 11}>
              {cargando ? "Validando..." : "Validar"}
            </Button>
          </form>

          {resultado?.disponible === true && (
            <div className="rounded-md border border-gray-200 p-4 space-y-1 text-sm">
              <p><span className="font-medium">Razón social:</span> {resultado.razonSocial}</p>
              <p><span className="font-medium">Estado SUNAT:</span> {resultado.estado || "—"}</p>
              <p><span className="font-medium">Condición:</span> {resultado.condicion || "—"}</p>
              {!resultado.esValidoParaTramite && !resultado.tienePresenciaEnTrujillo && (
                <p className="text-red-600 font-medium pt-2">
                  Este RUC no tiene domicilio fiscal ni local anexo registrado en la Provincia de Trujillo ante
                  SUNAT. Este sistema solo atiende negocios de Trujillo.
                </p>
              )}
              {!resultado.esValidoParaTramite && resultado.tienePresenciaEnTrujillo && (
                <p className="text-red-600 font-medium pt-2">
                  Este RUC no está ACTIVO y HABIDO en SUNAT, por lo que no puede continuar con el trámite.
                </p>
              )}
            </div>
          )}

          {resultado?.disponible === false && resultado.bloqueante && (
            <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm">
              <p className="text-red-700 font-medium">{resultado.motivo}</p>
            </div>
          )}

          {resultado?.disponible === false && !resultado.bloqueante && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 space-y-3 text-sm">
              <p className="text-yellow-800">{resultado.motivo}</p>
              <p className="text-gray-600">
                Puedes continuar ingresando la razón social manualmente; quedará marcada para revisión.
              </p>
              <Input
                label="Razón social del negocio"
                value={razonSocialManual}
                onChange={(e) => setRazonSocialManual(e.target.value)}
              />
            </div>
          )}

          {tramiteBloqueado && (
            <div className="rounded-md border border-blue-300 bg-blue-50 p-4 space-y-3 text-sm">
              <p className="text-blue-800">{tramiteBloqueado}</p>
              <Link href="/login">
                <Button className="w-full">Ingresar a mi cuenta</Button>
              </Link>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {resultado && !tramiteBloqueado && (
            <Button onClick={continuar} disabled={!puedeContinuar || cargando} className="w-full">
              {cargando ? "Creando expediente..." : "Continuar"}
            </Button>
          )}
        </Card>
      </div>
    </main>
  );
}
