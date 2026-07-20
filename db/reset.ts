// Reinicio completo de la base de datos: borra TODO (expedientes, negocios,
// documentos, pagos, inspecciones, licencias, usuarios) y vuelve a sembrar
// desde cero con un único admin y un único inspector.
// DESTRUCTIVO e irreversible. Ejecutar con: npm run db:reset
import "../lib/cargarEnvLocal";
import bcrypt from "bcryptjs";
import { db } from "../lib/db/client";
import {
  usuarios,
  negocios,
  expedientes,
  documentos,
  pagos,
  inspecciones,
  licencias,
  reportesInfraestructura,
  passwordResetTokens,
} from "../lib/db/schema";

async function vaciarTodo() {
  // Se borra en orden de hijos primero para no romper las foreign keys.
  await db.delete(passwordResetTokens);
  await db.delete(reportesInfraestructura);
  await db.delete(licencias);
  await db.delete(inspecciones);
  await db.delete(pagos);
  await db.delete(documentos);
  await db.delete(expedientes);
  await db.delete(usuarios);
  await db.delete(negocios);
  console.log("Base de datos vaciada.");
}

async function crearUsuario(email: string, password: string, rol: "admin" | "inspector", nombre: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usuarios).values({ email, passwordHash, rol, nombre });
  console.log(`Creado ${rol}: ${email} / ${password}`);
}

async function main() {
  await vaciarTodo();
  await crearUsuario("admin@licencias-trujillo.pe", "CambiarEsta123", "admin", "Administrador MPT");
  await crearUsuario("inspector@licencias-trujillo.pe", "CambiarEsta123", "inspector", "Inspector Municipal");
  console.log("Listo. Cambia estas contraseñas apenas puedas.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
