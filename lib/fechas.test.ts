import { describe, expect, it } from "vitest";
import { formatearFechaLarga, sumarAnios } from "./fechas";

describe("formatearFechaLarga", () => {
  it("formatea correctamente el primer mes del año", () => {
    expect(formatearFechaLarga("2026-01-05")).toBe("5 de enero del 2026");
  });

  it("formatea correctamente el último mes del año", () => {
    expect(formatearFechaLarga("2018-10-17")).toBe("17 de octubre del 2018");
  });
});

describe("sumarAnios", () => {
  it("suma años manteniendo mes y día", () => {
    expect(sumarAnios("2026-01-05", 1)).toBe("2027-01-05");
  });
});
