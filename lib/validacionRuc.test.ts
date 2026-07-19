import { describe, expect, it } from "vitest";
import {
  esTipoPermitido,
  tieneDigitoVerificadorValido,
  tieneFormatoValido,
  validarRucLocalmente,
} from "./validacionRuc";

describe("tieneFormatoValido", () => {
  it("rechaza RUC con menos u otros caracteres que no sean 11 dígitos", () => {
    expect(tieneFormatoValido("2010007097")).toBe(false); // 10 dígitos
    expect(tieneFormatoValido("201000709700")).toBe(false); // 12 dígitos
    expect(tieneFormatoValido("2010007097a")).toBe(false); // letra
  });

  it("acepta 11 dígitos numéricos", () => {
    expect(tieneFormatoValido("20100070970")).toBe(true);
  });
});

describe("esTipoPermitido", () => {
  it("acepta RUC tipo 20 (persona jurídica)", () => {
    expect(esTipoPermitido("20100070970")).toBe(true);
  });

  it("rechaza RUC tipo 10 (persona natural)", () => {
    expect(esTipoPermitido("10123456789")).toBe(false);
  });
});

describe("tieneDigitoVerificadorValido", () => {
  it("valida el dígito verificador de RUC reales conocidos", () => {
    expect(tieneDigitoVerificadorValido("20100070970")).toBe(true); // SUNAT
    expect(tieneDigitoVerificadorValido("20131312955")).toBe(true); // BCP
  });

  it("rechaza un RUC con el dígito verificador alterado", () => {
    expect(tieneDigitoVerificadorValido("20100070971")).toBe(false);
    expect(tieneDigitoVerificadorValido("20131312950")).toBe(false);
  });
});

describe("validarRucLocalmente", () => {
  it("aprueba un RUC de persona jurídica bien formado", () => {
    expect(validarRucLocalmente("20100070970")).toEqual({ valido: true });
  });

  it("rechaza un RUC de persona natural (tipo 10) con motivo explicativo", () => {
    const resultado = validarRucLocalmente("10131312955");
    expect(resultado.valido).toBe(false);
  });

  it("rechaza un RUC con dígito verificador inválido", () => {
    const resultado = validarRucLocalmente("20100070979");
    expect(resultado.valido).toBe(false);
  });
});
