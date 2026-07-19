import { auth } from "@/lib/auth";
import { AreaPrivadaNav } from "@/components/AreaPrivadaNav";

export default async function LayoutNegocio({ children }: { children: React.ReactNode }) {
  const sesion = await auth();

  return (
    <div className="flex-1 flex flex-col">
      <AreaPrivadaNav titulo="Mi Negocio" correo={sesion?.user?.email} />
      <div className="flex-1 bg-gray-50">{children}</div>
    </div>
  );
}
