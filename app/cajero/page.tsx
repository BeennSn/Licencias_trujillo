import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function PaginaCajero() {
  return (
    <main className="max-w-lg mx-auto px-4 py-10 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Atención presencial</h1>
        <p className="text-gray-500 text-sm">Registra trámites de negocios que se acercan a la ventanilla.</p>
      </div>

      <Link href="/solicitud/nuevo">
        <Card className="hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
          <h2 className="font-semibold text-gray-900">Nueva solicitud</h2>
          <p className="text-sm text-gray-500">
            Registra el RUC, domicilio, documentos y pago en efectivo de un trámite nuevo.
          </p>
        </Card>
      </Link>

      <Link href="/cajero/renovar">
        <Card className="hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
          <h2 className="font-semibold text-gray-900">Renovar licencia</h2>
          <p className="text-sm text-gray-500">
            Busca al negocio por RUC y cobra en efectivo la renovación de su licencia.
          </p>
        </Card>
      </Link>
    </main>
  );
}
