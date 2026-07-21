"use client";

import { useState } from "react";
import { VUELTO_MAXIMO_RAZONABLE_SOLES } from "@/lib/constantes";

export type MedioPagoPresencial = "efectivo" | "yape" | "mixto";

// Estado y validaciones de un cobro presencial (efectivo / Yape / mixto),
// compartido entre el pago de una solicitud nueva y el de una renovación en
// caja (ver components/cajero/CamposCobroPresencial.tsx, que renderiza esto).
//
// Dos cosas que hace, más allá de guardar el valor de cada campo:
// - Mixto: al escribir en un campo (efectivo o Yape), el otro se
//   autocompleta con lo que falta para llegar a montoTotal y queda de solo
//   lectura, así la suma siempre es exacta y no hay que escribir dos montos
//   a mano ni cuadrarlos.
// - Efectivo/mixto: pide cuánto entregó el cliente en efectivo para
//   calcular el vuelto, rechazando un monto menor al debido o un vuelto
//   absurdamente alto (típico error de tipeo).
export function useCobroPresencial(montoTotal: number) {
  const [medioPago, setMedioPagoInterno] = useState<MedioPagoPresencial>("efectivo");
  const [campoActivo, setCampoActivo] = useState<"efectivo" | "yape" | null>(null);
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoYape, setMontoYape] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");

  function cambiarMedioPago(nuevo: MedioPagoPresencial) {
    setMedioPagoInterno(nuevo);
    setCampoActivo(null);
    setMontoEfectivo("");
    setMontoYape("");
    setMontoRecibido("");
    setNumeroOperacion("");
  }

  // Vuelve todo a su estado inicial — usado cuando el cajero encadena un
  // nuevo cobro (ej. "Registrar otra renovación") y no debe arrastrar
  // valores del cobro anterior.
  function reiniciar() {
    cambiarMedioPago("efectivo");
  }

  function montoComplementario(valor: string): string {
    const num = Number(valor);
    const acotado = valor.trim() !== "" && Number.isFinite(num) && num >= 0 ? Math.min(num, montoTotal) : 0;
    return (montoTotal - acotado).toFixed(2);
  }

  function cambiarEfectivo(valor: string) {
    setCampoActivo("efectivo");
    setMontoEfectivo(valor);
    setMontoYape(montoComplementario(valor));
  }

  function cambiarYape(valor: string) {
    setCampoActivo("yape");
    setMontoYape(valor);
    setMontoEfectivo(montoComplementario(valor));
  }

  const sumaMixto = (Number(montoEfectivo) || 0) + (Number(montoYape) || 0);

  // Cuánto hay que cobrar de verdad en efectivo (para el cálculo de
  // vuelto): el total si el medio es "efectivo", la parte que le tocó al
  // efectivo si es "mixto", o nada si paga todo por Yape.
  const montoEfectivoDebido =
    medioPago === "efectivo" ? montoTotal : medioPago === "mixto" ? Number(montoEfectivo) || 0 : 0;

  const numRecibido = Number(montoRecibido);
  const vuelto = numRecibido - montoEfectivoDebido;

  let errorVuelto: string | null = null;
  if (montoEfectivoDebido > 0 && montoRecibido.trim() !== "" && Number.isFinite(numRecibido)) {
    if (numRecibido < montoEfectivoDebido) {
      errorVuelto = "El monto recibido es menor al monto a cobrar en efectivo.";
    } else if (vuelto > VUELTO_MAXIMO_RAZONABLE_SOLES) {
      errorVuelto = `Ese vuelto (S/ ${vuelto.toFixed(2)}) parece un error. Revisa el monto recibido.`;
    }
  }

  // Mensaje de error si intenta enviar el cobro tal cual está, o null si
  // está listo para confirmarse.
  function validarParaEnviar(): string | null {
    if (medioPago === "yape" && !numeroOperacion.trim()) {
      return "Ingresa el número de operación para dejar constancia del cobro.";
    }
    if (medioPago === "mixto") {
      if (Math.round(sumaMixto * 100) !== Math.round(montoTotal * 100)) {
        return `La suma de efectivo y Yape debe ser exactamente S/ ${montoTotal.toFixed(2)}.`;
      }
      if (Number(montoYape) > 0 && !numeroOperacion.trim()) {
        return "Ingresa el número de operación del pago por Yape.";
      }
    }
    if (montoEfectivoDebido > 0) {
      if (montoRecibido.trim() === "" || !Number.isFinite(numRecibido)) {
        return "Ingresa el monto recibido en efectivo para calcular el vuelto.";
      }
      if (errorVuelto) return errorVuelto;
    }
    return null;
  }

  return {
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
    setNumeroOperacion,
    validarParaEnviar,
    reiniciar,
  };
}

export type CobroPresencial = ReturnType<typeof useCobroPresencial>;
