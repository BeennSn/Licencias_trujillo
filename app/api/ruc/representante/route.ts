import { NextResponse } from "next/server";
import { consultarRepresentanteLegal } from "@/lib/apiPeruDev";

// Autocompletado del paso de domicilio: busca el representante legal
// registrado ante SUNAT para el RUC (ver lib/apiPeruDev.ts). Si no se
// encuentra nada (RUC sin representante registrado, servicio no
// configurado/caído), devuelve representante: null y el negocio simplemente
// lo completa a mano — nunca bloquea el wizard por esto.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ruc = searchParams.get("ruc") ?? "";

  if (!/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: "El RUC debe tener 11 dígitos." }, { status: 400 });
  }

  const representante = await consultarRepresentanteLegal(ruc);
  return NextResponse.json({ representante });
}
