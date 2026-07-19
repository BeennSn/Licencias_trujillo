import { auth } from "@/lib/auth";
import { AreaPrivadaNav } from "@/components/AreaPrivadaNav";

// El rol ya está garantizado por middleware.ts (ver lib/auth.config.ts), así
// que este layout solo se encarga de la barra de navegación del inspector.
export default async function LayoutInspector({ children }: { children: React.ReactNode }) {
  const sesion = await auth();

  return (
    <div className="flex-1 flex flex-col">
      <AreaPrivadaNav titulo="Panel del Inspector" correo={sesion?.user?.email} />
      <div className="flex-1 bg-gray-50">{children}</div>
    </div>
  );
}
