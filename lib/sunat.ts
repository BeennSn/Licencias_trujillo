// Validación de RUC contra una API pública tipo SUNAT (ver .env.example:
// SUNAT_API_URL y SUNAT_API_TOKEN). No es el convenio empresarial oficial de
// SUNAT (eso requiere trámite formal con la municipalidad), pero sí consulta
// datos reales: si el RUC existe, su razón social, y si está ACTIVO y HABIDO.
//
// Si el servicio externo falla o no responde (crítico el día de la demo),
// se devuelve disponible=false y la pantalla del wizard permite continuar
// con carga manual de razón social, dejando una marca para revisión.

export type ResultadoConsultaRuc =
  | {
      disponible: true;
      ruc: string;
      razonSocial: string;
      estado: string; // ej. "ACTIVO" | "BAJA DE OFICIO" | ...
      condicion: string; // ej. "HABIDO" | "NO HABIDO"
      esValidoParaTramite: boolean;
    }
  | {
      disponible: false;
      motivo: string;
    };

export async function consultarRuc(ruc: string): Promise<ResultadoConsultaRuc> {
  if (!/^\d{11}$/.test(ruc)) {
    return { disponible: false, motivo: "El RUC debe tener 11 dígitos numéricos." };
  }

  const url = process.env.SUNAT_API_URL;
  const token = process.env.SUNAT_API_TOKEN;

  if (!url) {
    return { disponible: false, motivo: "Servicio de validación de RUC no configurado." };
  }

  try {
    const respuesta = await fetch(`${url}/${ruc}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) {
      return { disponible: false, motivo: "El servicio de SUNAT no respondió correctamente." };
    }

    const datos = await respuesta.json();

    const razonSocial: string | undefined = datos.razonSocial ?? datos.nombre;
    const estado: string = (datos.estado ?? "").toString().toUpperCase();
    const condicion: string = (datos.condicion ?? "").toString().toUpperCase();

    if (!razonSocial) {
      return { disponible: false, motivo: "No se encontró información para este RUC." };
    }

    return {
      disponible: true,
      ruc,
      razonSocial,
      estado,
      condicion,
      esValidoParaTramite: estado === "ACTIVO" && condicion === "HABIDO",
    };
  } catch {
    return { disponible: false, motivo: "No se pudo conectar con el servicio de SUNAT. Intenta de nuevo o ingresa los datos manualmente." };
  }
}
