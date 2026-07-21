// Consulta al representante legal registrado ante SUNAT para un RUC, vía
// apiperu.dev (https://docs.apiperu.dev/enpoints/consulta-ruc-representantes).
// Se usa solo para autocompletar "Nombre del representante legal" y su DNI
// en el paso de domicilio del wizard — el negocio igual puede corregirlo a
// mano si el dato viene vacío o desactualizado (a diferencia de distrito/
// dirección, que sí quedan bloqueados porque vienen de una fuente distinta
// y más confiable).
//
// Endpoint: POST https://apiperu.dev/api/ruc-representantes
// Body: { ruc: "20999888771" }, Authorization: Bearer {APIPERU_DEV_TOKEN}

export type RepresentanteLegal = { nombre: string; dni: string; cargo: string };

type RespuestaApiPeruDev = {
  success: boolean;
  data?: {
    tipo_de_documento: string;
    numero_de_documento: string;
    nombre: string;
    cargo: string;
    fecha_desde: string;
  }[];
};

// Si SUNAT tiene registrado más de un representante (gerentes, apoderados,
// directores), se prioriza el que tenga cargo de "GERENTE GENERAL" —  es el
// dato más útil para una licencia de funcionamiento — y si no hay uno así,
// se toma el primero de la lista.
function elegirRepresentante(lista: RespuestaApiPeruDev["data"]): RepresentanteLegal | null {
  if (!lista || lista.length === 0) return null;

  const gerenteGeneral = lista.find((r) => r.cargo?.toUpperCase().includes("GERENTE GENERAL"));
  const elegido = gerenteGeneral ?? lista[0];

  if (!elegido.nombre || elegido.tipo_de_documento !== "DNI" || !/^\d{8}$/.test(elegido.numero_de_documento)) {
    return null;
  }

  return { nombre: elegido.nombre, dni: elegido.numero_de_documento, cargo: elegido.cargo };
}

export async function consultarRepresentanteLegal(ruc: string): Promise<RepresentanteLegal | null> {
  const token = process.env.APIPERU_DEV_TOKEN;
  if (!token) return null;

  try {
    const respuesta = await fetch("https://apiperu.dev/api/ruc-representantes", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ruc }),
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) return null;

    const datos: RespuestaApiPeruDev = await respuesta.json();
    if (!datos.success) return null;

    return elegirRepresentante(datos.data);
  } catch {
    return null;
  }
}
