// Genera números correlativos legibles del tipo EXP-2026-000123 / LIC-2026-000045.
// Para el volumen de este MVP (demo/expo) basta con contar cuántas filas
// existen en el año actual; el riesgo de colisión por condición de carrera
// es aceptable a esta escala (no hay miles de solicitudes simultáneas).
import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { expedientes, licencias } from "./db/schema";

export async function generarNumeroExpediente(): Promise<string> {
  const anio = new Date().getFullYear();
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(expedientes)
    .where(sql`extract(year from ${expedientes.createdAt}) = ${anio}`);

  const correlativo = (Number(total) + 1).toString().padStart(6, "0");
  return `EXP-${anio}-${correlativo}`;
}

export async function generarNumeroLicencia(): Promise<string> {
  const anio = new Date().getFullYear();
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(licencias)
    .where(sql`extract(year from ${licencias.createdAt}) = ${anio}`);

  const correlativo = (Number(total) + 1).toString().padStart(6, "0");
  return `LIC-${anio}-${correlativo}`;
}
