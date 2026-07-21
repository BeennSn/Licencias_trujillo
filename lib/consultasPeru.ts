// Consulta al representante legal registrado ante SUNAT para un RUC, vía
// consultasperu.com. Se usa solo para autocompletar "Nombre del
// representante legal" y su DNI en el paso de domicilio del wizard — el
// negocio igual puede corregirlo a mano si el dato viene vacío o
// desactualizado (a diferencia de distrito/dirección, que sí quedan
// bloqueados porque vienen de una fuente distinta y más confiable).
//
// OJO: el token configurado ahora (CONSULTASPERU_TOKEN) es de la prueba
// gratuita de 5 días de consultasperu.com, no una suscripción paga. Cuando
// venza, este servicio simplemente empieza a fallar (401/403) y el código
// ya está preparado para eso: devuelve null y el negocio completa a mano,
// sin ningún error visible ni romper el wizard.
//
// Endpoint: POST https://api.consultasperu.com/api/v1/query/ruc-representantes
// Body: { token, ruc }

export type RepresentanteLegal = { nombre: string; dni: string; cargo: string };

type RespuestaConsultasPeru = {
  success: boolean;
  data?: {
    tipo_documento: string;
    numero_documento: string;
    nombres: string;
    cargo: string;
    fecha_desde: string;
  }[];
};

// Si SUNAT tiene registrado más de un representante (gerentes, apoderados,
// directores), se prioriza el que tenga cargo de gerente general — es el
// dato más útil para una licencia de funcionamiento — y si no hay uno así,
// se toma el primero de la lista.
function elegirRepresentante(lista: RespuestaConsultasPeru["data"]): RepresentanteLegal | null {
  if (!lista || lista.length === 0) return null;

  const gerenteGeneral = lista.find((r) => r.cargo?.toUpperCase().includes("GERENTE"));
  const elegido = gerenteGeneral ?? lista[0];

  if (!elegido.nombres || elegido.tipo_documento !== "DNI" || !/^\d{8}$/.test(elegido.numero_documento)) {
    return null;
  }

  return { nombre: elegido.nombres, dni: elegido.numero_documento, cargo: elegido.cargo };
}

export async function consultarRepresentanteLegal(ruc: string): Promise<RepresentanteLegal | null> {
  const token = process.env.CONSULTASPERU_TOKEN;
  if (!token) return null;

  try {
    const respuesta = await fetch("https://api.consultasperu.com/api/v1/query/ruc-representantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ruc }),
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) return null;

    const datos: RespuestaConsultasPeru = await respuesta.json();
    if (!datos.success) return null;

    return elegirRepresentante(datos.data);
  } catch {
    return null;
  }
}
