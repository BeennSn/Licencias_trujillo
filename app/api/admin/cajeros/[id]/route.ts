import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { usuarios } from "@/lib/db/schema";

// Activa/desactiva un cajero (en vez de borrarlo: sus pagos presenciales ya
// registrados siguen referenciando su usuario, así que desactivar es más
// seguro que eliminar la fila).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (sesion?.user?.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const { activo } = await request.json();

  await db.update(usuarios).set({ activo: Boolean(activo) }).where(eq(usuarios.id, id));

  return NextResponse.json({ ok: true });
}
