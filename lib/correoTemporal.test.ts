import { describe, expect, it, vi, beforeEach } from "vitest";
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

// La consulta MX real depende de la red, así que se simula node:dns/promises
// para probar los 3 caminos sin depender de una conexión real: dominio con
// MX, dominio sin MX (ENOTFOUND) y una falla de red transitoria.
vi.mock("node:dns/promises", () => ({
  resolveMx: vi.fn(),
}));

describe("tieneServidorDeCorreo", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("acepta un dominio con registros MX", async () => {
    const dns = await import("node:dns/promises");
    vi.mocked(dns.resolveMx).mockResolvedValue([{ exchange: "mx.gmail.com", priority: 10 }]);

    const { tieneServidorDeCorreo } = await import("./correoTemporal");
    expect(await tieneServidorDeCorreo("negocio@gmail.com")).toBe(true);
  });

  it("rechaza un dominio sin registros MX (ENOTFOUND)", async () => {
    const dns = await import("node:dns/promises");
    const error = Object.assign(new Error("not found"), { code: "ENOTFOUND" });
    vi.mocked(dns.resolveMx).mockRejectedValue(error);

    const { tieneServidorDeCorreo } = await import("./correoTemporal");
    expect(await tieneServidorDeCorreo("alguien@diarshop.com")).toBe(false);
  });

  it("deja pasar el correo si la consulta DNS falla por una razón distinta (no bloquea por una falla de red)", async () => {
    const dns = await import("node:dns/promises");
    const error = Object.assign(new Error("timeout"), { code: "ETIMEOUT" });
    vi.mocked(dns.resolveMx).mockRejectedValue(error);

    const { tieneServidorDeCorreo } = await import("./correoTemporal");
    expect(await tieneServidorDeCorreo("alguien@empresa-real.com")).toBe(true);
  });
});
