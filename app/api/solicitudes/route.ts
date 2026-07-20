import { NextResponse } from "next/server";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { negocios, expedientes } from "@/lib/db/schema";
import { esquemaRuc } from "@/lib/validaciones";
import { generarNumeroExpediente } from "@/lib/numeracion";
import { consultarRuc, type DireccionTrujillo } from "@/lib/sunat";

// Paso A del wizard: crea (o reutiliza) el negocio por RUC y abre un
// expediente nuevo en estado BORRADOR. Si el negocio ya tiene un expediente
// en trámite (no terminal), se reutiliza ese en vez de crear uno duplicado.
//
// El RUC se vuelve a validar contra SUNAT acá, del lado del servidor: no se
// confía en el estado/condición que mande el cliente (pudo llamar a este
// endpoint directamente, saltándose la pantalla de validación del wizard).
// Solo se acepta razón social escrita a mano cuando el servicio de SUNAT
// realmente no responde (ver bloqueante en lib/sunat.ts); si el RUC es
// inválido o SUNAT confirma que no está ACTIVO y HABIDO, se rechaza.
export async function POST(request: Request) {
  const cuerpo = await request.json();
  const analisis = esquemaRuc.safeParse(cuerpo);

  if (!analisis.success) {
    return NextResponse.json({ error: analisis.error.issues[0].message }, { status: 400 });
  }

  const { ruc } = analisis.data;
  const resultadoSunat = await consultarRuc(ruc);

  let razonSocial: string;
  let estadoSunat: string | undefined;
  let condicionHabido: string | undefined;
  let direccionesTrujillo: DireccionTrujillo[] | undefined;
  let actividadEconomicaSunat: string | undefined;

  if (resultadoSunat.disponible) {
    if (!resultadoSunat.tienePresenciaEnTrujillo) {
      return NextResponse.json(
        {
          error:
            "Este RUC no tiene domicilio fiscal ni local anexo registrado en la Provincia de Trujillo ante SUNAT. Este sistema solo atiende negocios de Trujillo.",
        },
        { status: 400 }
      );
    }
    if (!resultadoSunat.esValidoParaTramite) {
      return NextResponse.json(
        { error: "El RUC debe estar ACTIVO y HABIDO en SUNAT para iniciar el trámite." },
        { status: 400 }
      );
    }
    razonSocial = resultadoSunat.razonSocial;
    estadoSunat = resultadoSunat.estado;
    condicionHabido = resultadoSunat.condicion;
    direccionesTrujillo = resultadoSunat.direccionesTrujillo;
    actividadEconomicaSunat = resultadoSunat.actividadEconomica || undefined;
  } else {
    if (resultadoSunat.bloqueante) {
      return NextResponse.json({ error: resultadoSunat.motivo }, { status: 400 });
    }
    // Servicio de SUNAT no disponible: se permite continuar con razón
    // social escrita a mano, igual que en la pantalla del wizard.
    const razonSocialManual: string | undefined = cuerpo.razonSocial;
    if (!razonSocialManual) {
      return NextResponse.json({ error: "Falta la razón social del negocio." }, { status: 400 });
    }
    razonSocial = razonSocialManual;
  }

  let [negocio] = await db.select().from(negocios).where(eq(negocios.ruc, ruc)).limit(1);

  if (!negocio) {
    [negocio] = await db
      .insert(negocios)
      .values({
        ruc,
        razonSocial,
        estadoSunat,
        condicionHabido,
        direccionesTrujillo: direccionesTrujillo ?? [],
        actividadEconomicaSunat,
      })
      .returning();
  } else if (direccionesTrujillo) {
    // Refresca el caché de direcciones y giro con el dato más reciente de
    // SUNAT (por si se registró un anexo nuevo desde la última consulta).
    [negocio] = await db
      .update(negocios)
      .set({ direccionesTrujillo, actividadEconomicaSunat })
      .where(eq(negocios.id, negocio.id))
      .returning();
  }

  const [expedienteEnTramite] = await db
    .select()
    .from(expedientes)
    .where(
      and(
        eq(expedientes.negocioId, negocio.id),
        notInArray(expedientes.estado, ["APROBADA", "RECHAZADA"])
      )
    )
    .limit(1);

  if (expedienteEnTramite) {
    // Si ya se programó (o pagó) la inspección, no tiene sentido "volver a
    // registrar" el mismo RUC en el wizard: ya no hay nada que completar
    // ahí, el negocio debe entrar con su cuenta a ver el estado. Solo se
    // permite retomar el wizard mientras sigue en pasos previos al pago.
    const ESTADOS_QUE_BLOQUEAN_REINGRESO: typeof expedienteEnTramite.estado[] = [
      "PAGO_APROBADO",
      "PRIMERA_INSPECCION_PROGRAMADA",
      "SEGUNDA_INSPECCION_PROGRAMADA",
    ];

    if (ESTADOS_QUE_BLOQUEAN_REINGRESO.includes(expedienteEnTramite.estado)) {
      return NextResponse.json(
        {
          error:
            "Este RUC ya tiene una solicitud en trámite con una inspección técnica programada. Ingresa con tu cuenta para ver el estado del expediente.",
          tramiteBloqueado: true,
          numeroExpediente: expedienteEnTramite.numeroExpediente,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      expedienteId: expedienteEnTramite.id,
      numeroExpediente: expedienteEnTramite.numeroExpediente,
      estado: expedienteEnTramite.estado,
      reanudado: true,
    });
  }

  const numeroExpediente = await generarNumeroExpediente();

  const [expediente] = await db
    .insert(expedientes)
    .values({
      numeroExpediente,
      negocioId: negocio.id,
      tipo: "nueva",
      estado: "BORRADOR",
    })
    .returning();

  return NextResponse.json({
    expedienteId: expediente.id,
    numeroExpediente: expediente.numeroExpediente,
    reanudado: false,
  });
}
