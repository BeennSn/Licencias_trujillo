import { describe, expect, it } from "vitest";
import { puedeTransicionar } from "./estadosExpediente";

describe("puedeTransicionar", () => {
  it("permite el camino feliz completo sin observaciones", () => {
    expect(puedeTransicionar("BORRADOR", "DOCUMENTOS_COMPLETOS")).toBe(true);
    expect(puedeTransicionar("DOCUMENTOS_COMPLETOS", "PAGO_PENDIENTE")).toBe(true);
    expect(puedeTransicionar("PAGO_PENDIENTE", "PAGO_APROBADO")).toBe(true);
    expect(puedeTransicionar("PAGO_APROBADO", "PRIMERA_INSPECCION_PROGRAMADA")).toBe(true);
    expect(puedeTransicionar("PRIMERA_INSPECCION_PROGRAMADA", "APROBADA")).toBe(true);
  });

  it("permite el camino con una observación (segunda inspección) y luego aprobación", () => {
    expect(
      puedeTransicionar("PRIMERA_INSPECCION_PROGRAMADA", "SEGUNDA_INSPECCION_PROGRAMADA")
    ).toBe(true);
    expect(puedeTransicionar("SEGUNDA_INSPECCION_PROGRAMADA", "APROBADA")).toBe(true);
  });

  it("permite el rechazo definitivo tras la segunda observación", () => {
    expect(puedeTransicionar("SEGUNDA_INSPECCION_PROGRAMADA", "RECHAZADA")).toBe(true);
  });

  it("no permite saltar directamente de BORRADOR a PAGO_APROBADO", () => {
    expect(puedeTransicionar("BORRADOR", "PAGO_APROBADO")).toBe(false);
  });

  it("no permite ninguna transición desde un estado terminal", () => {
    expect(puedeTransicionar("APROBADA", "RECHAZADA")).toBe(false);
    expect(puedeTransicionar("RECHAZADA", "APROBADA")).toBe(false);
  });

  it("no permite retroceder de PAGO_APROBADO a PAGO_PENDIENTE", () => {
    expect(puedeTransicionar("PAGO_APROBADO", "PAGO_PENDIENTE")).toBe(false);
  });
});
