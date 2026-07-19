import { describe, expect, it } from "vitest";
import { telefonoPeru } from "./validaciones";

describe("telefonoPeru", () => {
  it("acepta un celular peruano de 9 dígitos", () => {
    const resultado = telefonoPeru.safeParse("987654321");
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data).toBe("987654321");
  });

  it("acepta el prefijo +51 y lo normaliza (guarda solo los 9 dígitos)", () => {
    const resultado = telefonoPeru.safeParse("+51987654321");
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data).toBe("987654321");
  });

  it("acepta el prefijo 51 sin el signo +", () => {
    const resultado = telefonoPeru.safeParse("51987654321");
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data).toBe("987654321");
  });

  it("ignora espacios y guiones", () => {
    const resultado = telefonoPeru.safeParse("+51 987-654 321");
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data).toBe("987654321");
  });

  it("rechaza un número que no empieza con 9", () => {
    expect(telefonoPeru.safeParse("812345678").success).toBe(false);
  });

  it("rechaza un número con menos de 9 dígitos", () => {
    expect(telefonoPeru.safeParse("98765432").success).toBe(false);
  });

  it("rechaza un número de otro país", () => {
    expect(telefonoPeru.safeParse("+1987654321").success).toBe(false);
  });
});
