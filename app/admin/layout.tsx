import Link from "next/link";
import { auth } from "@/lib/auth";
import { AreaPrivadaNav } from "@/components/AreaPrivadaNav";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const sesion = await auth();

  return (
    <div className="flex-1 flex flex-col">
      <AreaPrivadaNav titulo="Panel de Administración" correo={sesion?.user?.email} />
      <div className="bg-white border-b px-4 py-2 flex gap-4 text-sm">
        <Link href="/admin" className="text-blue-700 hover:underline">Expedientes</Link>
        <Link href="/admin/inspectores" className="text-blue-700 hover:underline">Inspectores</Link>
        <Link href="/admin/cajeros" className="text-blue-700 hover:underline">Cajeros</Link>
        <Link href="/admin/caja" className="text-blue-700 hover:underline">Caja</Link>
      </div>
      <div className="flex-1 bg-gray-50">{children}</div>
    </div>
  );
}
