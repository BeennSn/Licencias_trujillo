// Bloquea correos de servicios "desechables" (temp-mail, mailinator,
// guerrillamail, etc.), usados típicamente por bots o gente que no quiere
// dejar un correo real. Se usa en todos los formularios públicos que piden
// correo (domicilio, cuenta, pago) para evitar solicitudes falsas.
//
// La lista viene del paquete disposable-email-domains (mantenido en
// GitHub por la comunidad, ~120 mil dominios); se carga una sola vez como
// Set para que la búsqueda sea O(1) en vez de recorrer el arreglo entero
// en cada validación.
import dominiosDesechables from "disposable-email-domains";

const DOMINIOS_DESECHABLES = new Set(dominiosDesechables.map((dominio) => dominio.toLowerCase()));

export function esCorreoTemporal(email: string): boolean {
  const dominio = email.split("@")[1]?.toLowerCase().trim();
  if (!dominio) return false;
  return DOMINIOS_DESECHABLES.has(dominio);
}
