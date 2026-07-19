// Lista de giros/actividades económicas más comunes en trámites de
// licencia de funcionamiento municipal, para que el negocio elija de un
// dropdown en vez de escribir el giro a mano (evita respuestas ambiguas
// tipo "ventas" o "negocio"). "Otro" deja un campo de texto libre para no
// bloquear giros que no estén en la lista.
export const GIROS_ACTIVIDAD = [
  "Bodega / minimarket / abarrotes",
  "Restaurante / comida rápida / cevichería",
  "Panadería / pastelería",
  "Bar / cantina / discoteca",
  "Farmacia / botica",
  "Ferretería / materiales de construcción",
  "Peluquería / salón de belleza / barbería",
  "Librería / útiles escolares / imprenta",
  "Venta de ropa, calzado y accesorios",
  "Electrodomésticos y tecnología",
  "Taller mecánico / servicio automotriz",
  "Lavandería",
  "Gimnasio / centro de acondicionamiento físico",
  "Academia / instituto / centro educativo",
  "Hotel / hospedaje / hostal",
  "Oficina administrativa / consultoría / servicios profesionales",
  "Agencia bancaria / financiera",
  "Veterinaria / venta de mascotas",
  "Joyería / bisutería",
  "Mueblería / decoración del hogar",
  "Fabricación / manufactura",
  "Almacén / depósito / logística",
] as const;

export const GIRO_OTRO = "Otro" as const;
