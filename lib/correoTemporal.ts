// Bloquea correos de servicios "desechables" (temp-mail, mailinator,
// guerrillamail, etc.), usados típicamente por bots o gente que no quiere
// dejar un correo real. Se usa en todos los formularios públicos que piden
// correo (domicilio, cuenta, pago, renovación) para evitar solicitudes falsas.
//
// La lista (disposable-email-domains, ~120 mil dominios mantenidos por la
// comunidad) nunca cubre el 100% -dominios "trampa" nuevos aparecen todo el
// tiempo-, por eso se complementa con la verificación de registros MX de
// tieneServidorDeCorreo() más abajo. Se carga una sola vez como Set para
// que la búsqueda sea O(1).
import dominiosDesechables from "disposable-email-domains";
import { resolveMx } from "node:dns/promises";

const DOMINIOS_DESECHABLES = new Set(dominiosDesechables.map((dominio) => dominio.toLowerCase()));

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

// Ninguna lista estática cubre los dominios "trampa" recién registrados
// específicamente para spamear formularios (ej. dominios de un solo uso
// que ni siquiera están en las listas públicas todavía). Como defensa
// adicional, se verifica que el dominio tenga registros MX reales, es
// decir, que de verdad pueda recibir correo.
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
