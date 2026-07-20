import { describe, expect, it } from "vitest";
import { estaVencida, estaPorVencer, puedeTransicionarLicencia } from "./estadosLicencia";

describe("estaVencida", () => {
  it("es true si la fecha de vencimiento ya pasó", () => {
    expect(estaVencida("2025-01-01", "2026-01-01")).toBe(true);
  });

  it("es false si la fecha de vencimiento es hoy", () => {
    expect(estaVencida("2026-01-01", "2026-01-01")).toBe(false);
  });

  it("es false si la fecha de vencimiento es futura", () => {
    expect(estaVencida("2027-01-01", "2026-01-01")).toBe(false);
  });
});

describe("estaPorVencer", () => {
  it("es true dentro de la ventana de 30 días antes del vencimiento", () => {
    expect(estaPorVencer("2026-01-15", "2026-01-01")).toBe(true);
  });

  it("es true justo en el límite de 30 días", () => {
    expect(estaPorVencer("2026-01-31", "2026-01-01")).toBe(true);
  });

  it("es true si ya venció (por vencer incluye vencida)", () => {
    expect(estaPorVencer("2025-12-01", "2026-01-01")).toBe(true);
  });

  it("es false fuera de la ventana de 30 días", () => {
    expect(estaPorVencer("2026-06-01", "2026-01-01")).toBe(false);
  });
});

describe("puedeTransicionarLicencia", () => {
  it("permite VIGENTE -> VENCIDA", () => {
    expect(puedeTransicionarLicencia("VIGENTE", "VENCIDA")).toBe(true);
  });

  it("permite VENCIDA -> RENOVADA", () => {
    expect(puedeTransicionarLicencia("VENCIDA", "RENOVADA")).toBe(true);
  });

  it("no permite ninguna transición desde CLAUSURADA", () => {
    expect(puedeTransicionarLicencia("CLAUSURADA", "VIGENTE")).toBe(false);
    expect(puedeTransicionarLicencia("CLAUSURADA", "RENOVADA")).toBe(false);
  });
});
