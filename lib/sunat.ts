// Validación de RUC contra la API de Decolecta (https://decolecta.com), que
// consulta datos reales de SUNAT: si el RUC existe, su razón social, y si
// está ACTIVO y HABIDO. No es el convenio empresarial oficial de SUNAT (eso
// requiere trámite formal con la municipalidad), pero sirve para verificar
// que el negocio sea real.
//
// Endpoint: GET {SUNAT_API_URL}?numero={ruc}  con  Authorization: Bearer {SUNAT_API_TOKEN}
// Respuesta de ejemplo (campos que usamos): { razon_social, estado, condicion }
//
// Antes de llamar al servicio, se corren validaciones locales (formato,
// tipo de RUC, dígito verificador — ver lib/validacionRuc.ts). Si esas
// fallan, el resultado es "bloqueante": el wizard NO debe ofrecer carga
// manual, porque el RUC en sí está mal. Si en cambio el servicio externo
// falla o no responde (token vencido, timeout, etc.), el resultado NO es
// bloqueante: ahí sí se permite continuar con carga manual de razón
// social, dejando una marca para revisión.
import { validarRucLocalmente } from "./validacionRuc";

export type ResultadoConsultaRuc =
  | {
      disponible: true;
      ruc: string;
      razonSocial: string;
      estado: string;
      condicion: string;
      esValidoParaTramite: boolean;
    }
  | {
      disponible: false;
      motivo: string;
      // true = el RUC en sí es inválido (formato/tipo/dígito verificador, o
      // SUNAT confirma que no existe): no se debe permitir carga manual.
      // false = no se pudo verificar (servicio caído/no configurado): se
      // permite continuar con carga manual, marcada para revisión.
      bloqueante: boolean;
    };

export async function consultarRuc(ruc: string): Promise<ResultadoConsultaRuc> {
  const validacionLocal = validarRucLocalmente(ruc);
  if (!validacionLocal.valido) {
    return { disponible: false, motivo: validacionLocal.motivo, bloqueante: true };
  }

  const url = process.env.SUNAT_API_URL;
  const token = process.env.SUNAT_API_TOKEN;

  if (!url || !token) {
    return { disponible: false, motivo: "Servicio de validación de RUC no configurado.", bloqueante: false };
  }

  try {
    const respuesta = await fetch(`${url}?numero=${ruc}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      // Decolecta responde 422 con {message: "ruc no valido"} cuando SUNAT
      // no reconoce el RUC: eso sí es bloqueante (dato confirmado, no un
      // problema de nuestro lado). 401/429/5xx son problemas del servicio
      // (token vencido, cuota, caída), no bloquean.
      return {
        disponible: false,
        motivo: datos.message ?? datos.error ?? "El servicio de SUNAT no respondió correctamente.",
        bloqueante: respuesta.status === 422,
      };
    }

    const razonSocial: string | undefined = datos.razon_social;
    const estado: string = (datos.estado ?? "").toString().toUpperCase();
    const condicion: string = (datos.condicion ?? "").toString().toUpperCase();

    if (!razonSocial) {
      return { disponible: false, motivo: "No se encontró información para este RUC.", bloqueante: false };
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
    return {
      disponible: false,
      motivo: "No se pudo conectar con el servicio de SUNAT. Intenta de nuevo o ingresa los datos manualmente.",
      bloqueante: false,
    };
  }
}
