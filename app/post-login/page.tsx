import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Página intermedia sin UI: solo decide a qué panel enviar al usuario según
// su rol, justo después de un login exitoso.
export default async function PostLogin() {
  const sesion = await auth();

  if (!sesion?.user) redirect("/login");

  if (sesion.user.rol === "inspector") redirect("/inspector");
  if (sesion.user.rol === "admin") redirect("/admin");
  redirect("/negocio");
}
