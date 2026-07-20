// Configuración de Auth.js que es segura de usar en el Edge Runtime
// (sin acceso a base de datos). Se usa tanto en middleware.ts (protección de
// rutas) como en lib/auth.ts (configuración completa con el provider de
// credenciales, que sí necesita la base de datos y corre en Node).
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [], // los providers reales se agregan en lib/auth.ts
  callbacks: {
    // Decide si una request puede continuar antes de llegar a la página.
    // Cada área privada (/negocio, /inspector, /admin) exige su propio rol.
    authorized({ auth, request }) {
      const rol = auth?.user?.rol;
      const pathname = request.nextUrl.pathname;

      if (pathname.startsWith("/negocio")) return rol === "negocio";
      if (pathname.startsWith("/inspector")) return rol === "inspector";
      if (pathname.startsWith("/admin")) return rol === "admin";
      if (pathname.startsWith("/cajero")) return rol === "cajero";

      return true;
    },
    // Copia el rol y el negocioId del usuario autenticado al token JWT.
    jwt({ token, user }) {
      if (user) {
        token.rol = user.rol;
        token.negocioId = user.negocioId ?? null;
      }
      return token;
    },
    // Expone rol y negocioId en session.user para usarlos en páginas/endpoints.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.rol = token.rol as "negocio" | "inspector" | "admin" | "cajero";
        session.user.negocioId = token.negocioId as string | null;
      }
      return session;
    },
  },
};
