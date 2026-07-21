"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { MONTO_TRAMITE_SOLES, MONTO_TRAMITE_COBRO_REAL_SOLES } from "@/lib/constantes";

type MedioPagoPresencial = "efectivo" | "yape" | "mixto";
type ResultadoRenovacion = { razonSocial: string; pdfUrl: string | null; fechaVencimiento: string };
type Renovacion = { expedienteId: string; razonSocial: string; monto: number };

export default function PaginaCajeroRenovar() {
  const [cajaAbierta, setCajaAbierta] = useState(true);
  const [verificandoCaja, setVerificandoCaja] = useState(true);
  const [ruc, setRuc] = useState("");
  const [renovacion, setRenovacion] = useState<Renovacion | null>(null);
  const [documentoReemplazado, setDocumentoReemplazado] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);
  const [medioPago, setMedioPago] = useState<MedioPagoPresencial>("efectivo");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoYape, setMontoYape] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRenovacion | null>(null);

  useEffect(() => {
    fetch("/api/cajero/caja")
      .then((r) => r.json())
      .then((datos) => {
        setCajaAbierta(datos.caja?.estado === "abierta");
        setVerificandoCaja(false);
      });
  }, []);

  function reiniciar() {
    setResultado(null);
    setRenovacion(null);
    setDocumentoReemplazado(false);
    setArchivo(null);
    setRuc("");
    setMedioPago("efectivo");
    setNumeroOperacion("");
    setMontoEfectivo("");
    setMontoYape("");
    setError(null);
  }

  async function buscarNegocio(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const respuesta = await fetch("/api/cajero/renovar/iniciar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruc }),
    });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo iniciar la renovación.");
      return;
    }

    setRenovacion({ expedienteId: datos.expedienteId, razonSocial: datos.razonSocial, monto: datos.monto });
  }

  async function reemplazarPlano() {
    if (!renovacion || !archivo) return;
    setError(null);
    setSubiendoDocumento(true);

    const formulario = new FormData();
    formulario.append("archivo", archivo);

    const respuesta = await fetch(`/api/cajero/renovar/${renovacion.expedienteId}/documento`, {
      method: "POST",
      body: formulario,
    });
    const datos = await respuesta.json();
    setSubiendoDocumento(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo reemplazar el plano.");
      return;
    }

    setDocumentoReemplazado(true);
    setArchivo(null);
  }

  const sumaMixto = (Number(montoEfectivo) || 0) + (Number(montoYape) || 0);

  async function confirmarPago(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (medioPago === "yape" && !numeroOperacion.trim()) {
      setError("Ingresa el número de operación para dejar constancia del cobro.");
      return;
    }

    if (medioPago === "mixto") {
      if (Math.round(sumaMixto * 100) !== Math.round(MONTO_TRAMITE_SOLES * 100)) {
        setError(`La suma de efectivo y Yape debe ser exactamente S/ ${MONTO_TRAMITE_SOLES.toFixed(2)}.`);
        return;
      }
      if (Number(montoYape) > 0 && !numeroOperacion.trim()) {
        setError("Ingresa el número de operación del pago por Yape.");
        return;
      }
    }

    setCargando(true);

    const respuesta = await fetch("/api/cajero/renovar/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expedienteId: renovacion!.expedienteId,
        medioPago,
        numeroOperacion: numeroOperacion.trim() || undefined,
        montoEfectivo: medioPago === "mixto" ? Number(montoEfectivo) || 0 : undefined,
        montoYape: medioPago === "mixto" ? Number(montoYape) || 0 : undefined,
      }),
    });
    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo registrar la renovación.");
      return;
    }

    setResultado(datos);
  }

  if (verificandoCaja) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        <p className="text-sm text-gray-500">Cargando...</p>
      </main>
    );
  }

  if (!cajaAbierta) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <Card className="space-y-3 text-center">
          <p className="text-sm text-gray-700">Necesitas abrir tu caja antes de registrar una renovación.</p>
          <Link href="/cajero">
            <Button className="w-full">Ir a mi caja</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (resultado) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        <Card className="space-y-3 text-center">
          <div className="text-green-600 text-4xl">✓</div>
          <h1 className="text-xl font-bold text-gray-900">Licencia renovada</h1>
          <p className="text-sm text-gray-600">{resultado.razonSocial}</p>
          <p className="text-sm"><span className="font-medium">Vigente hasta:</span> {resultado.fechaVencimiento}</p>
          {resultado.pdfUrl && (
            <a href={resultado.pdfUrl} target="_blank" rel="noreferrer">
              <Button variante="secundario" className="w-full">Descargar PDF</Button>
            </a>
          )}
          <Button onClick={reiniciar} className="w-full">Registrar otra renovación</Button>
          <Link href="/cajero" className="text-sm text-gray-500 hover:underline block">
            Volver al panel principal
          </Link>
        </Card>
      </main>
    );
  }

  if (!renovacion) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Renovar licencia</h1>
          <p className="text-gray-500 text-sm">
            Busca al negocio por RUC para iniciar la renovación (S/ {MONTO_TRAMITE_SOLES.toFixed(2)}).
          </p>
        </div>

        <Card>
          <form onSubmit={buscarNegocio} className="space-y-4">
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
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{renovacion.razonSocial}</h1>
        <p className="text-gray-500 text-sm">Renovación por S/ {renovacion.monto.toFixed(2)}</p>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-800">¿Cambió algo en el local?</h2>
        <p className="text-sm text-gray-500">
          Si el negocio necesita actualizar su plano por algún cambio, reemplázalo acá. Si no hace falta, sáltalo.
        </p>
        {documentoReemplazado ? (
          <p className="text-sm text-green-700">Plano actualizado.</p>
        ) : (
          <div className="space-y-2">
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              onClick={reemplazarPlano}
              disabled={!archivo || subiendoDocumento}
              variante="secundario"
              className="w-full"
            >
              {subiendoDocumento ? "Subiendo..." : "Reemplazar plano"}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <form onSubmit={confirmarPago} className="space-y-4">
          <Select
            label="Método de pago"
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value as MedioPagoPresencial)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="yape">Yape / Plin (QR)</option>
            <option value="mixto">Mixto (efectivo + Yape)</option>
          </Select>

          {(medioPago === "yape" || medioPago === "mixto") && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-1 text-sm text-gray-600">
              <p>
                Genera el cobro por <strong>S/ {MONTO_TRAMITE_COBRO_REAL_SOLES.toFixed(2)}</strong> (modo prueba) en
                la app de Izipay y muestra el QR al cliente para que pague con Yape o Plin.
              </p>
            </div>
          )}

          {medioPago === "mixto" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Efectivo (S/)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoEfectivo}
                  onChange={(e) => setMontoEfectivo(e.target.value)}
                />
                <Input
                  label="Yape (S/)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoYape}
                  onChange={(e) => setMontoYape(e.target.value)}
                />
              </div>
              <p className={`text-xs ${Math.round(sumaMixto * 100) === Math.round(MONTO_TRAMITE_SOLES * 100) ? "text-green-700" : "text-gray-500"}`}>
                Suma: S/ {sumaMixto.toFixed(2)} de S/ {MONTO_TRAMITE_SOLES.toFixed(2)}
              </p>
            </div>
          )}

          {(medioPago === "yape" || (medioPago === "mixto" && Number(montoYape) > 0)) && (
            <Input
              label="Número de operación (Yape)"
              placeholder="Ej. 000123456"
              value={numeroOperacion}
              onChange={(e) => setNumeroOperacion(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={cargando} className="w-full">
            {cargando ? "Registrando..." : `Confirmar pago S/ ${renovacion.monto.toFixed(2)}`}
          </Button>
        </form>
      </Card>
    </main>
  );
}
