// Bloquea correos de servicios "desechables" (temp-mail, mailinator,
// guerrillamail, etc.), usados típicamente por bots o gente que no quiere
// dejar un correo real. Se usa en todos los formularios públicos que piden
// correo (domicilio, cuenta, pago, renovación) para evitar solicitudes falsas.
//
// La lista pública (disposable-email-domains, ~120 mil dominios) nunca
// cubre el 100%: aparecen dominios "trampa" nuevos todo el tiempo, y ni
// siquiera el repositorio que la mantiene los tiene apenas salen. Por eso
// se combina con DOMINIOS_TEMPORALES_MANUAL (lib/dominiosTemporalesManual.ts),
// una lista propia para ir agregando a mano los que se detecten en uso
// real. Se carga todo una sola vez como Set para que la búsqueda sea O(1).
import dominiosDesechables from "disposable-email-domains";
import { resolveMx } from "node:dns/promises";
import { DOMINIOS_TEMPORALES_MANUAL } from "./dominiosTemporalesManual";

const DOMINIOS_DESECHABLES = new Set([
  ...dominiosDesechables.map((dominio) => dominio.toLowerCase()),
  ...DOMINIOS_TEMPORALES_MANUAL.map((dominio) => dominio.toLowerCase()),
]);

export function esCorreoTemporal(email: string): boolean {
  const dominio = email.split("@")[1]?.toLowerCase().trim();
  if (!dominio) return false;
  return DOMINIOS_DESECHABLES.has(dominio);
}

const TIEMPO_MAXIMO_MS = 3000;

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Verifica que el dominio del correo exista y pueda recibir correo (tiene
// registros MX). Esto atrapa correos con dominios inventados o mal
// tipeados, pero OJO: NO atrapa servicios de correo temporal reales, ya
// que estos sí configuran MX de verdad (necesitan recibir el correo para
// mostrarlo en su bandeja temporal). Para esos casos, la defensa es la
// lista + DOMINIOS_TEMPORALES_MANUAL de arriba, no esta verificación.
//
// Si la consulta DNS falla por timeout u otro error de red (no porque el
// dominio no exista), se deja pasar el correo: preferimos no bloquear
// correos reales por una falla transitoria de la red del servidor.
export async function tieneServidorDeCorreo(email: string): Promise<boolean> {
  const dominio = email.split("@")[1]?.trim();
  if (!dominio) return false;

  try {
    const registros = await conTimeout(resolveMx(dominio), TIEMPO_MAXIMO_MS);
    return registros.length > 0;
  } catch (error) {
    const codigo = (error as NodeJS.ErrnoException)?.code;
    // ENOTFOUND/ENODATA = el dominio no existe o no tiene registros MX:
    // ahí sí se rechaza con confianza.
    if (codigo === "ENOTFOUND" || codigo === "ENODATA") return false;
    return true;
  }
}
