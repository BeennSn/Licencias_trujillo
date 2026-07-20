"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresca la página del inspector cada cierto tiempo para que la lista de
// "Hoy" se actualice sola conforme el inspector va registrando decisiones,
// sin depender de una recarga manual. Los Server Components no tienen forma
// de "empujar" cambios; un intervalo con router.refresh() es la opción más
// simple y consistente con el resto del código (no hay ninguna capa de
// data-fetching en el cliente como SWR/React Query en este proyecto).
export function AutoRefresh({ intervaloMs = 45000 }: { intervaloMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervaloMs);
    return () => clearInterval(id);
  }, [router, intervaloMs]);

  return null;
}
