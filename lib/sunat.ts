// Validación de RUC contra la API de Decolecta (https://decolecta.com), que
// consulta datos reales de SUNAT: si el RUC existe, su razón social, su
// domicilio fiscal (distrito/provincia/departamento) y locales anexos, y si
// está ACTIVO y HABIDO. No es el convenio empresarial oficial de SUNAT (eso
// requiere trámite formal con la municipalidad), pero sirve para verificar
// que el negocio sea real.
//
// Endpoint: GET {SUNAT_API_URL}?numero={ruc}  con  Authorization: Bearer {SUNAT_API_TOKEN}
// Campos que usamos de la respuesta: razon_social, estado, condicion,
// direccion, distrito, provincia, departamento, locales_anexos (cada uno
// con su propia direccion/distrito/provincia/departamento).
//
// Antes de llamar al servicio, se corren validaciones locales (formato,
// tipo de RUC, dígito verificador — ver lib/validacionRuc.ts). Si esas
// fallan, el resultado es "bloqueante": el wizard NO debe ofrecer carga
// manual, porque el RUC en sí está mal. Si en cambio el servicio externo
// falla o no responde (token vencido, timeout, etc.), el resultado NO es
// bloqueante: ahí sí se permite continuar con carga manual de razón
// social, dejando una marca para revisión.
import { validarRucLocalmente } from "./validacionRuc";

const DEPARTAMENTO_TRUJILLO = "LA LIBERTAD";
const PROVINCIA_TRUJILLO = "TRUJILLO";

export type LocalAnexoSunat = { provincia?: string; departamento?: string; direccion?: string; distrito?: string };

type DatosUbicacionSunat = {
  direccion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  locales_anexos?: LocalAnexoSunat[];
};

function esUbicacionTrujillo(provincia?: string, departamento?: string): boolean {
  return (
    (provincia ?? "").toUpperCase() === PROVINCIA_TRUJILLO &&
    (departamento ?? "").toUpperCase() === DEPARTAMENTO_TRUJILLO
  );
}

// El sistema es solo para la Provincia de Trujillo (ver lib/distritosTrujillo.ts).
// Un RUC califica si su domicilio fiscal está en Trujillo, O si tiene al
// menos un local anexo registrado ahí (común en cadenas con sede legal en
// Lima pero tiendas/locales en Trujillo que también necesitan su propia
// licencia de funcionamiento).
export function tienePresenciaEnTrujillo(datos: {
  provincia?: string;
  departamento?: string;
  locales_anexos?: LocalAnexoSunat[];
}): boolean {
  if (esUbicacionTrujillo(datos.provincia, datos.departamento)) return true;
  return (datos.locales_anexos ?? []).some((local) => esUbicacionTrujillo(local.provincia, local.departamento));
}

export type DireccionTrujillo = { distrito: string; direccion: string };

// Extrae las direcciones (domicilio fiscal y/o locales anexos) que SUNAT
// tiene registradas en la Provincia de Trujillo para este RUC, para
// ofrecerlas como sugerencia de autocompletado en el paso de domicilio del
// wizard (en vez de que el negocio tipee la dirección a ciegas). Si el RUC
// no tiene ninguna dirección en Trujillo (ej. va a abrir un local nuevo que
// SUNAT todavía no registra como anexo), la lista viene vacía y el wizard
// debe permitir carga manual igual.
export function direccionesEnTrujillo(datos: DatosUbicacionSunat): DireccionTrujillo[] {
  const direcciones: DireccionTrujillo[] = [];

  if (esUbicacionTrujillo(datos.provincia, datos.departamento) && datos.direccion?.trim()) {
    direcciones.push({ distrito: datos.distrito?.trim() || PROVINCIA_TRUJILLO, direccion: datos.direccion.trim() });
  }

  for (const anexo of datos.locales_anexos ?? []) {
    if (esUbicacionTrujillo(anexo.provincia, anexo.departamento) && anexo.direccion?.trim()) {
      direcciones.push({ distrito: anexo.distrito?.trim() || PROVINCIA_TRUJILLO, direccion: anexo.direccion.trim() });
    }
  }

  return direcciones;
}

export type ResultadoConsultaRuc =
  | {
      disponible: true;
      ruc: string;
      razonSocial: string;
      estado: string;
      condicion: string;
      tienePresenciaEnTrujillo: boolean;
      direccionesTrujillo: DireccionTrujillo[];
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

    const presenciaEnTrujillo = tienePresenciaEnTrujillo(datos);

    return {
      disponible: true,
      ruc,
      razonSocial,
      estado,
      condicion,
      tienePresenciaEnTrujillo: presenciaEnTrujillo,
      direccionesTrujillo: direccionesEnTrujillo(datos),
      esValidoParaTramite: estado === "ACTIVO" && condicion === "HABIDO" && presenciaEnTrujillo,
    };
  } catch {
    return {
      disponible: false,
      motivo: "No se pudo conectar con el servicio de SUNAT. Intenta de nuevo o ingresa los datos manualmente.",
      bloqueante: false,
    };
  }
}
