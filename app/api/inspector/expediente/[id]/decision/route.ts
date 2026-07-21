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
//
// IMPORTANTE: la inspección solo se marca "conforme"/"observada" DESPUÉS de
// que el resto de la operación (generar PDF, subir a blob, emitir la
// licencia) haya salido bien. Antes se marcaba primero y recién después se
// intentaba lo demás — si algo fallaba en el medio (ej. la generación del
// PDF), la inspección quedaba marcada conforme pero sin licencia emitida y
// sin que el expediente avanzara, un estado inconsistente del que no había
// forma de recuperarse sin tocar la base de datos a mano.
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

  const { decision, observaciones, requiereCambioDocumento } = analisis.data;
  const hoy = aFechaIso(new Date());
  // Solo se marca en la primera visita (es la única que puede llevar a una
  // segunda) — igual queda forzado a false en el esquema del formulario si
  // tipoInspeccion !== "primera".
  const requiereCambioFinal = inspeccion.tipo === "primera" ? requiereCambioDocumento : false;

  if (decision === "conforme") {
    if (!puedeTransicionar(expediente.estado, "APROBADA")) {
      return NextResponse.json({ error: "El expediente no puede aprobarse desde su estado actual." }, { status: 409 });
    }

    const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expediente.negocioId)).limit(1);
    if (!negocio) {
      return NextResponse.json({ error: "No se encontró el negocio del expediente." }, { status: 500 });
    }

    const numeroLicencia = await generarNumeroLicencia();
    const fechaVencimiento = sumarAnios(hoy, VIGENCIA_LICENCIA_ANIOS);
    const urlConsultaPublica = `${process.env.NEXT_PUBLIC_SITE_URL}/consulta?ruc=${negocio.ruc}`;

    // Lo más propenso a fallar (generar el PDF, subir el blob) va ANTES de
    // tocar la base de datos, para no dejar la inspección marcada conforme
    // si esto revienta.
    let pdfUrl: string;
    try {
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
        fechaEmision: hoy,
        fechaVencimiento,
        urlConsultaPublica,
      });

      // allowOverwrite: numeroLicencia se calcula contando filas de
      // "licencias" (ver lib/numeracion.ts); si alguna vez se borra una fila
      // sin borrar su PDF del blob, un número puede reutilizarse y chocar
      // con un archivo huérfano en esa misma ruta. Sobrescribirlo es lo
      // correcto: el contenido nuevo es el real, el viejo ya no debería existir.
      const blob = await put(`licencias/${numeroLicencia}.pdf`, pdfBuffer, {
        access: "public",
        contentType: "application/pdf",
        allowOverwrite: true,
      });
      pdfUrl = blob.url;
    } catch (error) {
      console.error("Error generando/subiendo el PDF de la licencia:", error);
      return NextResponse.json(
        { error: "No se pudo generar la licencia (PDF). Intenta registrar la decisión de nuevo." },
        { status: 500 }
      );
    }

    // Recién acá, con el PDF ya listo, se escribe todo en la base de datos.
    await db.insert(licencias).values({
      expedienteId,
      negocioId: expediente.negocioId,
      numeroLicencia,
      fechaEmision: hoy,
      fechaVencimiento,
      pdfUrl,
      estado: "VIGENTE",
    });

    await db.update(expedientes).set({ estado: "APROBADA", updatedAt: new Date() }).where(eq(expedientes.id, expedienteId));

    await db
      .update(inspecciones)
      .set({ estado: "conforme", observaciones, requiereCambioDocumento: requiereCambioFinal, fechaRealizada: hoy })
      .where(eq(inspecciones.id, inspeccion.id));

    if (expediente.emailContacto) {
      await enviarCorreoDecisionInspeccion(expediente.emailContacto, expediente.numeroExpediente ?? "", true);
    }

    return NextResponse.json({ ok: true, resultado: "aprobado", pdfUrl });
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

    await db
      .update(inspecciones)
      .set({ estado: "observada", observaciones, requiereCambioDocumento: requiereCambioFinal, fechaRealizada: hoy })
      .where(eq(inspecciones.id, inspeccion.id));

    if (expediente.emailContacto) {
      await enviarCorreoDecisionInspeccion(expediente.emailContacto, expediente.numeroExpediente ?? "", false, observaciones);
    }
    // Reprogramación por observación: el profesor pidió que este aviso sea
    // solo para el negocio, no para el inspector (ver lib/notificacionesInspeccion.ts).
    await notificarInspeccionProgramada({ inspeccion: segundaInspeccion, expediente, notificarInspector: false });

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

  await db
    .update(inspecciones)
    .set({ estado: "observada", observaciones, requiereCambioDocumento: requiereCambioFinal, fechaRealizada: hoy })
    .where(eq(inspecciones.id, inspeccion.id));

  if (expediente.emailContacto) {
    await enviarCorreoDecisionInspeccion(expediente.emailContacto, expediente.numeroExpediente ?? "", false, observaciones);
  }

  return NextResponse.json({ ok: true, resultado: "rechazada" });
}
