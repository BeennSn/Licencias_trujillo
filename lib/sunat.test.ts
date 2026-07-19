import { describe, expect, it } from "vitest";
import { direccionesEnTrujillo, tienePresenciaEnTrujillo } from "./sunat";

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

describe("direccionesEnTrujillo", () => {
  it("incluye el domicilio fiscal cuando está en Trujillo", () => {
    expect(
      direccionesEnTrujillo({
        direccion: "AV. ESPAÑA 123",
        distrito: "TRUJILLO",
        provincia: "TRUJILLO",
        departamento: "LA LIBERTAD",
      })
    ).toEqual([{ distrito: "TRUJILLO", direccion: "AV. ESPAÑA 123" }]);
  });

  it("incluye solo los locales anexos que están en Trujillo (como Supermercados Peruanos)", () => {
    const resultado = direccionesEnTrujillo({
      direccion: "CAL. MORELLI NRO 181",
      distrito: "SAN BORJA",
      provincia: "LIMA",
      departamento: "LIMA",
      locales_anexos: [
        { direccion: "NRO 300", distrito: "AREQUIPA", provincia: "AREQUIPA", departamento: "AREQUIPA" },
        {
          direccion: "FND. LAS CASUARINAS LT A MZ S/N",
          distrito: "TRUJILLO",
          provincia: "TRUJILLO",
          departamento: "LA LIBERTAD",
        },
      ],
    });

    expect(resultado).toEqual([
      { distrito: "TRUJILLO", direccion: "FND. LAS CASUARINAS LT A MZ S/N" },
    ]);
  });

  it("devuelve una lista vacía si no hay ninguna dirección en Trujillo", () => {
    expect(direccionesEnTrujillo({ direccion: "AV. X", provincia: "LIMA", departamento: "LIMA" })).toEqual([]);
  });

  it("ignora un local anexo en Trujillo sin dirección utilizable", () => {
    expect(
      direccionesEnTrujillo({
        provincia: "LIMA",
        departamento: "LIMA",
        locales_anexos: [{ provincia: "TRUJILLO", departamento: "LA LIBERTAD", direccion: "" }],
      })
    ).toEqual([]);
  });
});
