import { describe, expect, it } from "vitest";
import { esCorreoTemporal } from "./correoTemporal";

describe("esCorreoTemporal", () => {
  it("detecta dominios desechables conocidos", () => {
    expect(esCorreoTemporal("alguien@mailinator.com")).toBe(true);
    expect(esCorreoTemporal("alguien@guerrillamail.com")).toBe(true);
    expect(esCorreoTemporal("alguien@10minutemail.com")).toBe(true);
  });

  it("no marca como temporal un correo de un proveedor real", () => {
    expect(esCorreoTemporal("negocio@gmail.com")).toBe(false);
    expect(esCorreoTemporal("contacto@empresa.com.pe")).toBe(false);
  });

  it("no distingue mayúsculas/minúsculas en el dominio", () => {
    expect(esCorreoTemporal("alguien@MAILINATOR.com")).toBe(true);
  });

  it("no lanza error con un correo mal formado", () => {
    expect(esCorreoTemporal("no-es-un-correo")).toBe(false);
  });
});
