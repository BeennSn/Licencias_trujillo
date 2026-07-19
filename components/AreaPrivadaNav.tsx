"use client";

import { signOut } from "next-auth/react";

export function AreaPrivadaNav({ titulo, correo }: { titulo: string; correo?: string | null }) {
  return (
    <nav className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between">
      <span className="font-semibold">{titulo}</span>
      <div className="flex items-center gap-4 text-sm">
        {correo && <span className="text-blue-200">{correo}</span>}
        <button onClick={() => signOut({ callbackUrl: "/" })} className="underline hover:text-blue-200">
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
