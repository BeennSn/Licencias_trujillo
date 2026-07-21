import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { usuarios } from "@/lib/db/schema";

// Activa/desactiva un inspector (en vez de borrarlo: sus inspecciones ya
// programadas siguen referenciando su usuario, así que desactivar es más
// seguro que eliminar la fila).
//
// Solo puede haber un inspector activo a la vez (regla explícita del
// negocio: el reparto de inspecciones asume un único inspector operando).
// Al activar uno, se desactivan automáticamente todos los demás en vez de
// rechazar la acción, para que "Activar" siempre haga lo que dice sin que
// el admin tenga que desactivar al anterior a mano primero.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (sesion?.user?.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const { activo } = await request.json();

  if (activo) {
    await db.update(usuarios).set({ activo: false }).where(and(eq(usuarios.rol, "inspector"), ne(usuarios.id, id)));
  }

  await db.update(usuarios).set({ activo: Boolean(activo) }).where(eq(usuarios.id, id));

  return NextResponse.json({ ok: true });
}
