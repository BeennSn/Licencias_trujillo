// Configuración completa de Auth.js (con acceso a base de datos). Solo hay
// un provider: correo + contraseña. El negocio crea sus credenciales en el
// paso E del wizard (después de pagar); inspectores y admin se crean por
// db/seed.ts o desde el panel de administrador.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { usuarios } from "./db/schema";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const [usuario] = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.email, email.toLowerCase().trim()))
          .limit(1);

        if (!usuario || !usuario.activo) return null;

        const claveValida = await bcrypt.compare(password, usuario.passwordHash);
        if (!claveValida) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre ?? usuario.email,
          rol: usuario.rol,
          negocioId: usuario.negocioId,
        };
      },
    }),
  ],
});
