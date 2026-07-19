import { describe, expect, it } from "vitest";
import { tienePresenciaEnTrujillo } from "./sunat";

describe("tienePresenciaEnTrujillo", () => {
  it("acepta un RUC cuyo domicilio fiscal está en Trujillo", () => {
    expect(
      tienePresenciaEnTrujillo({ provincia: "TRUJILLO", departamento: "LA LIBERTAD" })
    ).toBe(true);
  });

  it("rechaza un RUC con domicilio fiscal fuera de Trujillo y sin locales anexos", () => {
    expect(tienePresenciaEnTrujillo({ provincia: "LIMA", departamento: "LIMA" })).toBe(false);
  });

  it("acepta un RUC con domicilio fiscal en Lima pero con un local anexo en Trujillo", () => {
    expect(
      tienePresenciaEnTrujillo({
        provincia: "LIMA",
        departamento: "LIMA",
        locales_anexos: [
          { provincia: "AREQUIPA", departamento: "AREQUIPA" },
          { provincia: "TRUJILLO", departamento: "LA LIBERTAD" },
        ],
      })
    ).toBe(true);
  });

  it("rechaza si ningún local anexo está en Trujillo", () => {
    expect(
      tienePresenciaEnTrujillo({
        provincia: "LIMA",
        departamento: "LIMA",
        locales_anexos: [{ provincia: "PIURA", departamento: "PIURA" }],
      })
    ).toBe(false);
  });

  it("no confunde una provincia homónima de otro departamento", () => {
    expect(tienePresenciaEnTrujillo({ provincia: "TRUJILLO", departamento: "LIMA" })).toBe(false);
  });

  it("maneja datos sin locales_anexos (undefined) sin lanzar error", () => {
    expect(tienePresenciaEnTrujillo({ provincia: "LIMA", departamento: "LIMA" })).toBe(false);
  });
});
