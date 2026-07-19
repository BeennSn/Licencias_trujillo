// Esquemas Zod de validación para cada formulario del wizard y de las
// áreas privadas. Centralizados en un solo archivo porque son pequeños y
// así es más fácil ver de un vistazo qué reglas aplica cada paso.
import { z } from "zod";
import { DISTRITOS_TRUJILLO } from "./distritosTrujillo";
import { esTipoPermitido, tieneDigitoVerificadorValido } from "./validacionRuc";
import { esCorreoTemporal } from "./correoTemporal";

// Correo válido en formato Y que no sea de un servicio desechable
// (mailinator, guerrillamail, etc.), para dificultar el spam de bots.
const correoNoTemporal = z
  .email("Ingresa un correo válido.")
  .refine((email) => !esCorreoTemporal(email), "No se aceptan correos temporales/desechables. Ingresa un correo real.");

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

export const esquemaDomicilio = z.object({
  distrito: z.enum(DISTRITOS_TRUJILLO, {
    error: "Selecciona un distrito válido de la Provincia de Trujillo.",
  }),
  direccionLocal: z.string().min(5, "Ingresa la dirección completa del local."),
  giroActividad: z.string().min(3, "Indica el giro o actividad económica del negocio."),
  // Normalizados (minúsculas/recortados) para que la verificación de
  // duplicados entre RUC distintos no falle por mayúsculas o espacios.
  emailContacto: correoNoTemporal.transform((email) => email.toLowerCase().trim()),
  telefonoContacto: z
    .string()
    .min(6, "Ingresa un teléfono de contacto válido.")
    .transform((telefono) => telefono.trim()),
});

// Un documento solo es aceptable si su fecha de vigencia es futura y no
// está marcado como "en trámite" (requisito legal explícito del cliente:
// todos los documentos deben estar vigentes, nunca en proceso de obtención).
export const esquemaDocumento = z
  .object({
    tipo: z.enum(["plano_local", "otro"]),
    nombre: z.string().min(2),
    urlArchivo: z.string().min(1, "Debes subir el archivo."),
    fechaVigencia: z.iso.date("Ingresa una fecha de vigencia válida."),
    enTramite: z.boolean(),
  })
  .refine((doc) => doc.fechaVigencia > new Date().toISOString().slice(0, 10), {
    message: "La fecha de vigencia del documento debe ser futura.",
    path: ["fechaVigencia"],
  })
  .refine((doc) => doc.enTramite === false, {
    message: "El documento no puede estar en trámite: debe estar vigente y ya emitido.",
    path: ["enTramite"],
  });

export const esquemaCuenta = z.object({
  email: correoNoTemporal,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export const esquemaPago = z.object({
  medioPago: z.enum(["tarjeta", "yape", "pagoefectivo"]),
  tokenPago: z.string().min(1, "Falta el token de pago generado por la pasarela."),
  email: correoNoTemporal,
});

export const esquemaDecisionInspeccion = z.object({
  decision: z.enum(["conforme", "observada"]),
  observaciones: z.string().optional(),
});

export const esquemaReporteInfraestructura = z.object({
  descripcion: z.string().min(10, "Describe con más detalle el cambio realizado en el local."),
});
