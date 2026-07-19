import { describe, expect, it } from "vitest";
import { encontrarDistritoTrujillo } from "./distritosTrujillo";

describe("encontrarDistritoTrujillo", () => {
  it("encuentra el distrito aunque venga sin tildes y en mayúsculas (formato SUNAT)", () => {
    expect(encontrarDistritoTrujillo("VICTOR LARCO HERRERA")).toBe("Víctor Larco Herrera");
    expect(encontrarDistritoTrujillo("TRUJILLO")).toBe("Trujillo");
    expect(encontrarDistritoTrujillo("el porvenir")).toBe("El Porvenir");
  });

  it("devuelve undefined si el distrito no es de la Provincia de Trujillo", () => {
    expect(encontrarDistritoTrujillo("SAN BORJA")).toBeUndefined();
    expect(encontrarDistritoTrujillo("")).toBeUndefined();
  });
});
