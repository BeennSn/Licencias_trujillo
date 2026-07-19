// Único punto centralizado de protección de rutas por rol. La lógica de
// "quién puede entrar a dónde" vive en el callback `authorized` de
// lib/auth.config.ts; este archivo solo conecta ese callback con Next.js.
import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/negocio/:path*", "/inspector/:path*", "/admin/:path*"],
};
