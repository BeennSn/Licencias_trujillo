// Esquemas Zod de validación para cada formulario del wizard y de las
// áreas privadas. Centralizados en un solo archivo porque son pequeños y
// así es más fácil ver de un vistazo qué reglas aplica cada paso.
import { z } from "zod";
import { DISTRITOS_TRUJILLO } from "./distritosTrujillo";
import { esTipoPermitido, tieneDigitoVerificadorValido } from "./validacionRuc";
import { esCorreoTemporal, tieneServidorDeCorreo } from "./correoTemporal";

// Correo válido en formato, que no sea de un servicio desechable conocido
// (mailinator, guerrillamail, etc.) y cuyo dominio realmente pueda recibir
// correo (tiene registros MX) — esto último atrapa dominios "trampa" tan
// nuevos que ninguna lista pública los tiene todavía. Al tener una
// validación async (la consulta MX), hay que parsear estos esquemas con
// `safeParseAsync`/`parseAsync`, nunca con la versión síncrona.
const correoNoTemporal = z
  .email("Ingresa un correo válido.")
  .refine((email) => !esCorreoTemporal(email), "No se aceptan correos temporales/desechables. Ingresa un correo real.")
  .refine(tieneServidorDeCorreo, "Este dominio de correo no existe o no puede recibir correos. Ingresa un correo real.");

// Celular peruano: 9 dígitos que empiezan con 9, con o sin el prefijo
// internacional +51 (también acepta espacios/guiones, que se limpian antes
// de validar). Se guarda siempre normalizado a solo los 9 dígitos.
export const telefonoPeru = z
  .string()
  .transform((telefono) => telefono.replace(/[\s\-()]/g, ""))
  .refine(
    (telefono) => /^(?:\+?51)?9\d{8}$/.test(telefono),
    "Ingresa un celular peruano válido: 9 dígitos, empieza con 9 (puedes incluir +51)."
  )
  .transform((telefono) => telefono.replace(/^\+?51/, ""));

// Repite las validaciones de lib/validacionRuc.ts como defensa en
// profundidad: la pantalla del wizard ya las corre antes de llamar a este
// endpoint, pero el endpoint no debe confiar solo en eso por si alguien lo
// llama directamente.
export const esquemaRuc = z.object({
  ruc: z
    .string()
    .regex(/^\d{11}$/, "El RUC debe tener 11 dígitos numéricos.")
    .refine(esTipoPermitido, "Solo se aceptan RUC de persona jurídica (tipo 20).")
    .refine(tieneDigitoVerificadorValido, "El RUC ingresado no es válido (dígito verificador incorrecto)."),
});

// DNI peruano: 8 dígitos.
const dniPeru = z.string().regex(/^\d{8}$/, "El DNI debe tener 8 dígitos.");

export const esquemaDomicilio = z.object({
  distrito: z.enum(DISTRITOS_TRUJILLO, {
    error: "Selecciona un distrito válido de la Provincia de Trujillo.",
  }),
  direccionLocal: z.string().min(5, "Ingresa la dirección completa del local."),
  giroActividad: z.string().min(3, "Indica el giro o actividad económica del negocio."),
  // Normalizados (minúsculas/recortados) para que la verificación de
  // duplicados entre RUC distintos no falle por mayúsculas, espacios o el
  // prefijo +51 puesto de forma distinta.
  emailContacto: correoNoTemporal.transform((email) => email.toLowerCase().trim()),
  telefonoContacto: telefonoPeru,
  // Solo se usan para imprimir la licencia (ver lib/pdfLicencia.tsx).
  nombreComercial: z.string().min(2, "Ingresa el nombre comercial del local."),
  representanteLegalNombre: z.string().min(3, "Ingresa el nombre del representante legal."),
  representanteLegalDni: dniPeru,
  areaLocalM2: z.string().regex(/^\d+(\.\d{1,2})?$/, "Ingresa el área del local en m² (solo números)."),
  horarioAtencion: z.string().min(3, "Indica el horario de atención del local."),
});

// Paso C: solo se pide el plano del local (requisito explícito del
// profesor). El tipo de archivo y el tamaño ya se validan antes en la ruta
// (ver TIPOS_ARCHIVO_DOCUMENTO_PERMITIDOS/TAMANO_MAXIMO_DOCUMENTO_BYTES);
// acá solo queda confirmar que efectivamente se subió algo.
export const esquemaDocumento = z.object({
  urlArchivo: z.string().min(1, "Debes subir el archivo."),
});

// Usado solo en modo simulado (sin MERCADOPAGO_ACCESS_TOKEN configurado);
// con credenciales reales, el pago va por Checkout Pro (ver
// esquemaIniciarPagoMercadoPago) y no necesita medioPago/tokenPago del
// cliente — Mercado Pago se encarga de eso en su propia plataforma.
export const esquemaPago = z.object({
  medioPago: z.enum(["tarjeta", "yape", "pagoefectivo"]),
  tokenPago: z.string().min(1, "Falta el token de pago generado por la pasarela."),
  email: correoNoTemporal,
});

export const esquemaIniciarPagoMercadoPago = z.object({
  email: correoNoTemporal,
});

// Antes esta ruta no validaba nada (tomaba el body tal cual); ahora exige
// las mismas reglas de correo que el resto del wizard.
export const esquemaRenovacion = z.object({
  mismoLocal: z.boolean(),
  medioPago: z.enum(["tarjeta", "yape", "pagoefectivo"]),
  tokenPago: z.string().min(1, "Falta el token de pago generado por la pasarela."),
  email: correoNoTemporal,
});

export const esquemaNuevoInspector = z.object({
  email: correoNoTemporal,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  nombre: z.string().min(2, "Ingresa el nombre del inspector."),
});

export const esquemaDecisionInspeccion = z.object({
  decision: z.enum(["conforme", "observada"]),
  observaciones: z.string().optional(),
  requiereCambioDocumento: z.boolean().optional().default(false),
});

export const esquemaReporteInfraestructura = z.object({
  descripcion: z.string().min(10, "Describe con más detalle el cambio realizado en el local."),
});
