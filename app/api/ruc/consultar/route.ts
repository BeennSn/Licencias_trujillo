import { NextResponse } from "next/server";
import { consultarRuc } from "@/lib/sunat";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ruc = searchParams.get("ruc") ?? "";

  const resultado = await consultarRuc(ruc);
  return NextResponse.json(resultado);
}
