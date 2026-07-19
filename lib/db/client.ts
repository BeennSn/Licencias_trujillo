// Conexión a la base de datos Neon Postgres usando el driver HTTP
// (@neondatabase/serverless), que funciona bien en funciones serverless de
// Vercel sin necesitar un pool de conexiones persistente.
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta la variable de entorno DATABASE_URL (conexión a Neon Postgres).");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
