"use client";

import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { QR_YAPE_PLIN_IMAGEN } from "@/lib/constantes";
import type { CobroPresencial, MedioPagoPresencial } from "@/lib/hooks/useCobroPresencial";

// Campos de un cobro presencial (efectivo / Yape / mixto), compartidos
// entre app/solicitud/[expedienteId]/pago-presencial y
// app/cajero/renovar. Toda la lógica (autocompletado del mixto, vuelto,
// validaciones) vive en el hook useCobroPresencial; esto solo renderiza.
export function CamposCobroPresencial({ cobro, montoTotal }: { cobro: CobroPresencial; montoTotal: number }) {
  const {
    medioPago,
    cambiarMedioPago,
    campoActivo,
    montoEfectivo,
    montoYape,
    cambiarEfectivo,
    cambiarYape,
    sumaMixto,
    montoEfectivoDebido,
    montoRecibido,
    setMontoRecibido,
    vuelto,
    errorVuelto,
    numeroOperacion,
    cambiarNumeroOperacion,
  } = cobro;

  return (
    <>
      <Select
        label="Método de pago"
        value={medioPago}
        onChange={(e) => cambiarMedioPago(e.target.value as MedioPagoPresencial)}
      >
        <option value="efectivo">Efectivo</option>
        <option value="yape">Yape / Plin (QR)</option>
        <option value="mixto">Mixto (efectivo + Yape)</option>
      </Select>

      {(medioPago === "yape" || medioPago === "mixto") && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3 text-center">
          <Image
            src={QR_YAPE_PLIN_IMAGEN}
            alt="QR para pagar con Yape/Plin"
            width={220}
            height={220}
            className="mx-auto rounded-md"
          />
          <p className="text-sm text-gray-600">
            Muestra este QR al cliente para que escanee y pague con Yape o Plin, indicándole el monto a pagar.
          </p>
          <p className="text-xs text-gray-400">
            Verifica en tu app que el pago llegó antes de confirmar el cobro acá abajo.
          </p>
        </div>
      )}

      {medioPago === "mixto" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Efectivo (S/)"
              type="number"
              min="0"
              max={montoTotal}
              step="0.01"
              value={montoEfectivo}
              readOnly={campoActivo === "yape"}
              onChange={(e) => cambiarEfectivo(e.target.value)}
            />
            <Input
              label="Yape (S/)"
              type="number"
              min="0"
              max={montoTotal}
              step="0.01"
              value={montoYape}
              readOnly={campoActivo === "efectivo"}
              onChange={(e) => cambiarYape(e.target.value)}
            />
          </div>
          <p
            className={`text-xs ${
              Math.round(sumaMixto * 100) === Math.round(montoTotal * 100) ? "text-green-700" : "text-gray-500"
            }`}
          >
            Suma: S/ {sumaMixto.toFixed(2)} de S/ {montoTotal.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">Escribe en un campo y el otro se completa solo.</p>
        </div>
      )}

      {montoEfectivoDebido > 0 && (
        <div className="space-y-1">
          <Input
            label={`Monto recibido en efectivo (a cobrar: S/ ${montoEfectivoDebido.toFixed(2)})`}
            type="number"
            min={montoEfectivoDebido}
            step="0.01"
            value={montoRecibido}
            onChange={(e) => setMontoRecibido(e.target.value)}
          />
          {errorVuelto ? (
            <p className="text-xs text-red-600">{errorVuelto}</p>
          ) : (
            montoRecibido.trim() !== "" && (
              <p className="text-xs text-green-700">Vuelto a entregar: S/ {vuelto.toFixed(2)}</p>
            )
          )}
        </div>
      )}

      {(medioPago === "yape" || (medioPago === "mixto" && Number(montoYape) > 0)) && (
        <Input
          label="Número de operación (Yape)"
          placeholder="Ej. 000123456"
          inputMode="numeric"
          value={numeroOperacion}
          onChange={(e) => cambiarNumeroOperacion(e.target.value)}
        />
      )}
    </>
  );
}
