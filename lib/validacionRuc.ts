// Validaciones del RUC que NO dependen de ningún servicio externo: formato,
// tipo de contribuyente y dígito verificador (algoritmo módulo 11 que usa
// SUNAT). Sirven para rechazar de inmediato un RUC mal escrito o de un tipo
// no admitido, sin gastar cuota de la API externa de validación.

const PESOS_DIGITO_VERIFICADOR = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

// Los 2 primeros dígitos del RUC indican el tipo de contribuyente ante
// SUNAT (10 = persona natural, 20 = persona jurídica, 15/17/25 = otros
// casos). Este sistema solo admite RUC de persona jurídica (empresas y
// sociedades formalmente constituidas). Si la municipalidad decide aceptar
// también personas naturales con negocio, basta con agregar "10" acá.
export const TIPOS_RUC_PERMITIDOS = ["20"] as const;

export function tieneFormatoValido(ruc: string): boolean {
  return /^\d{11}$/.test(ruc);
}

export function esTipoPermitido(ruc: string): boolean {
  return (TIPOS_RUC_PERMITIDOS as readonly string[]).includes(ruc.slice(0, 2));
}

// Verifica el último dígito del RUC contra el algoritmo oficial de dígito
// verificador (módulo 11), el mismo que usa SUNAT/RENIEC. Detecta RUC mal
// tipeados (typos) sin necesidad de consultar ningún servicio.
export function tieneDigitoVerificadorValido(ruc: string): boolean {
  if (!tieneFormatoValido(ruc)) return false;

  const digitos = ruc.split("").map(Number);
  const suma = PESOS_DIGITO_VERIFICADOR.reduce(
    (acumulado, peso, indice) => acumulado + peso * digitos[indice],
    0
  );

  const resto = suma % 11;
  let digitoEsperado = 11 - resto;
  if (digitoEsperado === 10) digitoEsperado = 0;
  if (digitoEsperado === 11) digitoEsperado = 1;

  return digitoEsperado === digitos[10];
}

export type ResultadoValidacionLocal = { valido: true } | { valido: false; motivo: string };

// Corre las 3 validaciones locales en orden. Se usa antes de llamar a la
// API externa (lib/sunat.ts) y también como defensa en profundidad en el
// endpoint POST /api/solicitudes, por si alguien llama a la API saltándose
// la pantalla del wizard.
export function validarRucLocalmente(ruc: string): ResultadoValidacionLocal {
  if (!tieneFormatoValido(ruc)) {
    return { valido: false, motivo: "El RUC debe tener 11 dígitos numéricos." };
  }
  if (!esTipoPermitido(ruc)) {
    return {
      valido: false,
      motivo: "Solo se aceptan RUC de persona jurídica (tipo 20). Este trámite es para negocios formalmente constituidos.",
    };
  }
  if (!tieneDigitoVerificadorValido(ruc)) {
    return { valido: false, motivo: "El RUC ingresado no es válido (dígito verificador incorrecto)." };
  }
  return { valido: true };
}
