// Validación de RUC contra la API de Decolecta (https://decolecta.com), que
// consulta datos reales de SUNAT: si el RUC existe, su razón social, y si
// está ACTIVO y HABIDO. No es el convenio empresarial oficial de SUNAT (eso
// requiere trámite formal con la municipalidad), pero sirve para verificar
// que el negocio sea real.
//
// Endpoint: GET {SUNAT_API_URL}?numero={ruc}  con  Authorization: Bearer {SUNAT_API_TOKEN}
// Respuesta de ejemplo (campos que usamos): { razon_social, estado, condicion }
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

  if (!url || !token) {
    return { disponible: false, motivo: "Servicio de validación de RUC no configurado." };
  }

  try {
    const respuesta = await fetch(`${url}?numero=${ruc}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      // Decolecta responde 422 con {message: "ruc no valido"} y 401 si el
      // token es inválido/excedió su cuota, entre otros casos.
      return { disponible: false, motivo: datos.message ?? datos.error ?? "El servicio de SUNAT no respondió correctamente." };
    }

    const razonSocial: string | undefined = datos.razon_social;
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
