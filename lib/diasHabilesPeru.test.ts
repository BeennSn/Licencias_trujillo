import { describe, expect, it } from "vitest";
import { esDiaHabil, fechaIsoAFecha, proximoDiaHabil, sumarDiasHabiles } from "./diasHabilesPeru";

describe("esDiaHabil", () => {
  it("marca el sábado y el domingo como no hábiles", () => {
    expect(esDiaHabil(fechaIsoAFecha("2026-07-18"))).toBe(false); // sábado
    expect(esDiaHabil(fechaIsoAFecha("2026-07-19"))).toBe(false); // domingo
  });

  it("marca un feriado nacional como no hábil aunque sea entre semana", () => {
    expect(esDiaHabil(fechaIsoAFecha("2026-07-28"))).toBe(false); // Fiestas Patrias, martes
  });

  it("marca un martes normal como hábil", () => {
    expect(esDiaHabil(fechaIsoAFecha("2026-07-21"))).toBe(true);
  });
});

describe("sumarDiasHabiles", () => {
  it("salta fines de semana al sumar días hábiles", () => {
    // Viernes 2026-07-17 + 1 día hábil -> lunes 2026-07-20 (sáb/dom no cuentan)
    expect(sumarDiasHabiles("2026-07-17", 1)).toBe("2026-07-20");
  });

  it("salta feriados nacionales", () => {
    // Lunes 2026-07-27 + 1 día hábil: martes 28 y miércoles 29 son feriados
    // (Fiestas Patrias), así que el siguiente día hábil es jueves 30.
    expect(sumarDiasHabiles("2026-07-27", 1)).toBe("2026-07-30");
  });

  it("calcula 30 días hábiles desde una fecha sin feriados cercanos", () => {
    const resultado = sumarDiasHabiles("2026-01-05", 30);
    expect(resultado).toBe("2026-02-16");
  });
});

describe("proximoDiaHabil", () => {
  it("devuelve la misma fecha si ya es hábil", () => {
    expect(proximoDiaHabil("2026-07-21")).toBe("2026-07-21");
  });

  it("avanza al lunes si cae en fin de semana", () => {
    expect(proximoDiaHabil("2026-07-18")).toBe("2026-07-20");
  });
});
