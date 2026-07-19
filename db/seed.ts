// Script de siembra: crea un administrador y un inspector de prueba para
// poder entrar al sistema apenas se despliega. Ejecutar con: npm run seed
// (requiere DATABASE_URL configurada, ver .env.example).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db/client";
import { usuarios } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function crearUsuarioSiNoExiste(email: string, password: string, rol: "admin" | "inspector", nombre: string) {
  const [existente] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (existente) {
    console.log(`Ya existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usuarios).values({ email, passwordHash, rol, nombre });
  console.log(`Creado ${rol}: ${email} / ${password}`);
}

async function main() {
  await crearUsuarioSiNoExiste("admin@licencias-trujillo.pe", "CambiarEsta123", "admin", "Administrador MPT");
  await crearUsuarioSiNoExiste("inspector1@licencias-trujillo.pe", "CambiarEsta123", "inspector", "Inspector de Pruebas 1");
  await crearUsuarioSiNoExiste("inspector2@licencias-trujillo.pe", "CambiarEsta123", "inspector", "Inspector de Pruebas 2");
  console.log("Listo. Cambia estas contraseñas apenas puedas.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
