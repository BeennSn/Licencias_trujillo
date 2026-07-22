// Validación de RUC contra la API de ConsultasPeru (https://consultasperu.com),
// que consulta datos reales de SUNAT: si el RUC existe, su razón social, su
// domicilio fiscal (distrito/provincia/departamento) y locales anexos, y si
// está ACTIVO y HABIDO. No es el convenio empresarial oficial de SUNAT (eso
// requiere trámite formal con la municipalidad), pero sirve para verificar
// que el negocio sea real.
//
// Antes usábamos Decolecta (SUNAT_API_URL/SUNAT_API_TOKEN); se cambió a
// ConsultasPeru porque el plan de Decolecta se agotó (401 "Limit Exceeded").
// CONSULTASPERU_TOKEN ya se usaba en lib/consultasPeru.ts para el
// representante legal; aquí se reutiliza el mismo token para los datos
// generales del RUC y los locales anexos.
//
// Endpoints (POST, body JSON con {token, ...}):
// - https://api.consultasperu.com/api/v1/query
//   body: { token, type_document: "ruc", document_number: ruc }
//   data: { name, status, domicile_conditions, province, department,
//           district, address } — o data: [] (array vacío) si el RUC no existe.
// - https://api.consultasperu.com/api/v1/query/ruc-anexos
//   body: { token, ruc }
//   data: [{ direccion, distrito, provincia, departamento, ... }]
//
// Antes de llamar al servicio, se corren validaciones locales (formato,
// tipo de RUC, dígito verificador — ver lib/validacionRuc.ts). Si esas
// fallan, el resultado es "bloqueante": el wizard NO debe ofrecer carga
// manual, porque el RUC en sí está mal. Si en cambio el servicio externo
// falla o no responde (token vencido, timeout, etc.), el resultado NO es
// bloqueante: ahí sí se permite continuar con carga manual de razón
// social, dejando una marca para revisión.
import { validarRucLocalmente } from "./validacionRuc";

const CONSULTASPERU_URL_RUC = "https://api.consultasperu.com/api/v1/query";
const CONSULTASPERU_URL_ANEXOS = "https://api.consultasperu.com/api/v1/query/ruc-anexos";

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

type DatosRucConsultasPeru = {
  name?: string;
  status?: string;
  domicile_conditions?: string;
  province?: string;
  department?: string;
  district?: string;
  address?: string;
};

type AnexoConsultasPeru = { direccion?: string; distrito?: string; provincia?: string; departamento?: string };

// Los locales anexos son un "nice to have" (autocompletado de direcciones);
// si esta llamada falla no debe tumbar la consulta principal del RUC.
async function obtenerAnexosTrujillo(ruc: string, token: string): Promise<LocalAnexoSunat[]> {
  try {
    const respuesta = await fetch(CONSULTASPERU_URL_ANEXOS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ruc }),
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) return [];

    const datos: { success: boolean; data?: AnexoConsultasPeru[] } = await respuesta.json();
    if (!datos.success || !Array.isArray(datos.data)) return [];

    return datos.data.map((anexo) => ({
      direccion: anexo.direccion,
      distrito: anexo.distrito,
      provincia: anexo.provincia,
      departamento: anexo.departamento,
    }));
  } catch {
    return [];
  }
}

export async function consultarRuc(ruc: string): Promise<ResultadoConsultaRuc> {
  const validacionLocal = validarRucLocalmente(ruc);
  if (!validacionLocal.valido) {
    return { disponible: false, motivo: validacionLocal.motivo, bloqueante: true };
  }

  const token = process.env.CONSULTASPERU_TOKEN;

  if (!token) {
    return { disponible: false, motivo: "Servicio de validación de RUC no configurado.", bloqueante: false };
  }

  try {
    const respuesta = await fetch(CONSULTASPERU_URL_RUC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, type_document: "ruc", document_number: ruc }),
      signal: AbortSignal.timeout(8000),
    });

    const cuerpo: { success: boolean; message?: string; data?: DatosRucConsultasPeru | [] } =
      await respuesta.json();

    if (!respuesta.ok || !cuerpo.success) {
      // 401/429/5xx son problemas del servicio (token vencido, cuota,
      // caída): no bloquean, se permite carga manual.
      return {
        disponible: false,
        motivo: cuerpo.message ?? "El servicio de validación de RUC no respondió correctamente.",
        bloqueante: false,
      };
    }

    // ConsultasPeru responde data: [] (array vacío) cuando SUNAT no
    // reconoce el RUC: eso sí es un dato confirmado, es bloqueante.
    if (Array.isArray(cuerpo.data) || !cuerpo.data) {
      return { disponible: false, motivo: "No se encontró información para este RUC.", bloqueante: true };
    }

    const datosRuc = cuerpo.data;
    const razonSocial = datosRuc.name;
    const estado = (datosRuc.status ?? "").toString().toUpperCase();
    const condicion = (datosRuc.domicile_conditions ?? "").toString().toUpperCase();

    if (!razonSocial) {
      return { disponible: false, motivo: "No se encontró información para este RUC.", bloqueante: false };
    }

    const datosUbicacion: DatosUbicacionSunat = {
      direccion: datosRuc.address,
      distrito: datosRuc.district,
      provincia: datosRuc.province,
      departamento: datosRuc.department,
      locales_anexos: await obtenerAnexosTrujillo(ruc, token),
    };

    const presenciaEnTrujillo = tienePresenciaEnTrujillo(datosUbicacion);

    return {
      disponible: true,
      ruc,
      razonSocial,
      estado,
      condicion,
      tienePresenciaEnTrujillo: presenciaEnTrujillo,
      direccionesTrujillo: direccionesEnTrujillo(datosUbicacion),
      esValidoParaTramite: estado === "ACTIVO" && condicion === "HABIDO" && presenciaEnTrujillo,
    };
  } catch {
    return {
      disponible: false,
      motivo: "No se pudo conectar con el servicio de validación de RUC. Intenta de nuevo o ingresa los datos manualmente.",
      bloqueante: false,
    };
  }
}
