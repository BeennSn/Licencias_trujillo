import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cobrarDerechoDeTramite } from "@/lib/pagos/mercadopago";
import { esquemaRenovacion } from "@/lib/validaciones";
import { ejecutarRenovacion } from "@/lib/renovacion";

// Renovación anual: regla de negocio explícita del cliente -> es AUTOMÁTICA
// con solo el pago, PERO únicamente si es el MISMO local. Por eso este
// expediente de tipo "renovacion" nunca pasa por documentos ni inspección:
// se salta directo de BORRADOR a APROBADA tras el pago (a propósito, no es
// un bug en la máquina de estados general, que sigue exigiendo inspección
// para trámites nuevos). La emisión de la nueva licencia vive en
// lib/renovacion.ts, compartida con la renovación presencial en caja (ver
// app/api/cajero/renovar).
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "negocio") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const cuerpo = await request.json();
  const analisis = await esquemaRenovacion.safeParseAsync(cuerpo);
  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const { mismoLocal, medioPago, tokenPago, email } = analisis.data;

  if (!mismoLocal) {
    return NextResponse.json(
      {
        error:
          "La renovación automática solo aplica si es el mismo local. Para un local distinto debes iniciar un trámite nuevo completo.",
      },
      { status: 400 }
    );
  }

  const negocioId = sesion.user.negocioId!;

  const resultado = await ejecutarRenovacion({
    negocioId,
    medioPago,
    canal: "web",
    emailNotificacion: email,
    resolverPago: () => cobrarDerechoDeTramite(tokenPago, email, medioPago),
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, pagoId: resultado.pagoId }, { status: resultado.status });
  }

  return NextResponse.json({ ok: true, pdfUrl: resultado.pdfUrl, fechaVencimiento: resultado.fechaVencimiento });
}
