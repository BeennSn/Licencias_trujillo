import type { DefaultSession } from "next-auth";

type RolUsuario = "negocio" | "inspector" | "admin" | "cajero";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: RolUsuario;
      negocioId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    rol: RolUsuario;
    negocioId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol: RolUsuario;
    negocioId: string | null;
  }
}
