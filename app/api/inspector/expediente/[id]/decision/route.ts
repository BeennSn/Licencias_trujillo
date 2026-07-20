import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expedientes, inspecciones, negocios, licencias } from "@/lib/db/schema";
import { esquemaDecisionInspeccion } from "@/lib/validaciones";
import { puedeTransicionar } from "@/lib/estadosExpediente";
import { programarSegundaInspeccion } from "@/lib/agenda";
import { generarNumeroLicencia } from "@/lib/numeracion";
import { generarPdfLicencia } from "@/lib/pdfLicencia";
import { sumarAnios } from "@/lib/fechas";
import { aFechaIso } from "@/lib/diasHabilesPeru";
import { VIGENCIA_LICENCIA_ANIOS } from "@/lib/constantes";
import { enviarCorreoDecisionInspeccion } from "@/lib/email";
import { notificarInspeccionProgramada } from "@/lib/notificacionesInspeccion";

// El inspector registra el resultado de una visita. Según la decisión:
// - Conforme -> el expediente queda APROBADA y se emite la licencia (PDF + QR).
// - Observada en la 1ra visita -> se programa automáticamente la 2da inspección
//   a exactamente 30 días hábiles peruanos.
// - Observada en la 2da visita -> el expediente queda RECHAZADA (definitivo;
//   para reintentar, el negocio debe iniciar un expediente nuevo y pagar de nuevo).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (!sesion?.user || sesion.user.rol !== "inspector") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id: expedienteId } = await params;
  const cuerpo = await request.json();
  const analisis = esquemaDecisionInspeccion.safeParse(cuerpo);

  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);
  if (!expediente) {
    return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
  }

  const [inspeccion] = await db
    .select()
    .from(inspecciones)
    .where(
      and(
        eq(inspecciones.expedienteId, expedienteId),
        eq(inspecciones.inspectorId, sesion.user.id),
        eq(inspecciones.estado, "programada")
      )
    )
    .orderBy(desc(inspecciones.createdAt))
    .limit(1);

  if (!inspeccion) {
    return NextResponse.json(
      { error: "No hay una inspección programada asignada a ti para este expediente." },
      { status: 404 }
    );
  }

  const { decision, observaciones } = analisis.data;
  const hoy = aFechaIso(new Date());

  await db
    .update(inspecciones)
    .set({ estado: decision === "conforme" ? "conforme" : "observada", observaciones, fechaRealizada: hoy })
    .where(eq(inspecciones.id, inspeccion.id));

  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expediente.negocioId)).limit(1);

  if (decision === "conforme") {
    if (!puedeTransicionar(expediente.estado, "APROBADA")) {
      return NextResponse.json({ error: "El expediente no puede aprobarse desde su estado actual." }, { status: 409 });
    }

    const numeroLicencia = await generarNumeroLicencia();
    const fechaVencimiento = sumarAnios(hoy, VIGENCIA_LICENCIA_ANIOS);
    const urlConsultaPublica = `${process.env.NEXT_PUBLIC_SITE_URL}/consulta?ruc=${negocio.ruc}`;

    const pdfBuffer = await generarPdfLicencia({
      numeroLicencia,
      numeroExpediente: expediente.numeroExpediente ?? "",
      razonSocial: negocio.razonSocial,
      ruc: negocio.ruc,
      representanteLegalNombre: expediente.representanteLegalNombre ?? "",
      representanteLegalDni: expediente.representanteLegalDni ?? "",
      nombreComercial: expediente.nombreComercial ?? "",
      distrito: expediente.distrito ?? "",
      direccionLocal: expediente.direccionLocal ?? "",
      giroActividad: expediente.giroActividad ?? "",
      areaLocalM2: expediente.areaLocalM2 ?? "",
      horarioAtencion: expediente.horarioAtencion ?? "",
      fechaEmision: hoy,
      fechaVencimiento,
      urlConsultaPublica,
    });

    const blob = await put(`licencias/${numeroLicencia}.pdf`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
    });

    await db.insert(licencias).values({
      expedienteId,
      negocioId: expediente.negocioId,
      numeroLicencia,
      fechaEmision: hoy,
      fechaVencimiento,
      pdfUrl: blob.url,
      estado: "VIGENTE",
    });

    await db.update(expedientes).set({ estado: "APROBADA", updatedAt: new Date() }).where(eq(expedientes.id, expedienteId));

    if (expediente.emailContacto) {
      await enviarCorreoDecisionInspeccion(expediente.emailContacto, expediente.numeroExpediente ?? "", true);
    }

    return NextResponse.json({ ok: true, resultado: "aprobado", pdfUrl: blob.url });
  }

  // decision === "observada"
  if (inspeccion.tipo === "primera") {
    if (!puedeTransicionar(expediente.estado, "SEGUNDA_INSPECCION_PROGRAMADA")) {
      return NextResponse.json({ error: "El expediente no puede pasar a segunda inspección desde su estado actual." }, { status: 409 });
    }

    const segundaInspeccion = await programarSegundaInspeccion(expedienteId, hoy);

    await db
      .update(expedientes)
      .set({ estado: "SEGUNDA_INSPECCION_PROGRAMADA", updatedAt: new Date() })
      .where(eq(expedientes.id, expedienteId));

    if (expediente.emailContacto) {
      await enviarCorreoDecisionInspeccion(expediente.emailContacto, expediente.numeroExpediente ?? "", false, observaciones);
    }
    await notificarInspeccionProgramada({ inspeccion: segundaInspeccion, expediente });

    return NextResponse.json({
      ok: true,
      resultado: "segunda_inspeccion_programada",
      fechaSegundaInspeccion: segundaInspeccion.fechaProgramada,
    });
  }

  // Segunda inspección observada: rechazo definitivo. El negocio no queda
  // bloqueado, pero para reintentar debe iniciar un expediente nuevo (y
  // pagar de nuevo el derecho de trámite, ver POST /api/solicitudes).
  if (!puedeTransicionar(expediente.estado, "RECHAZADA")) {
    return NextResponse.json({ error: "El expediente no puede rechazarse desde su estado actual." }, { status: 409 });
  }

  await db.update(expedientes).set({ estado: "RECHAZADA", updatedAt: new Date() }).where(eq(expedientes.id, expedienteId));

  if (expediente.emailContacto) {
    await enviarCorreoDecisionInspeccion(expediente.emailContacto, expediente.numeroExpediente ?? "", false, observaciones);
  }

  return NextResponse.json({ ok: true, resultado: "rechazada" });
}
