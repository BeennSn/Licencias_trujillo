# Marco legal del sistema de Licencias de Funcionamiento (MPT)

Este documento resume las normas que sustentan las reglas de negocio implementadas en el sistema, y deja explícitas las simplificaciones que se hicieron para este MVP.

## Base legal

- **Ley N° 28976 - Ley Marco de Licencia de Funcionamiento.** Norma nacional que regula el otorgamiento de licencias de funcionamiento en todas las municipalidades del Perú, incluida la Municipalidad Provincial de Trujillo (MPT).
- **Decreto Supremo N° 046-2017-PCM** - Reglamento de Inspecciones Técnicas de Seguridad en Edificaciones (ITSE), que complementa la Ley 28976 en lo referente a las inspecciones técnicas previas o posteriores al otorgamiento de la licencia.
- **Ley N° 29733 - Ley de Protección de Datos Personales.** Sustenta que la consulta pública del sistema solo exponga datos no sensibles (razón social, estado del trámite, PDF de la licencia si fue aprobada) y nunca datos privados del negocio (dirección exacta más allá de lo que ya figura en el PDF público, pagos, observaciones del inspector).

## Simplificación explícita para este MVP

En la normativa real, el tipo de inspección (ITSE) y si esta se realiza **antes o después** de otorgar la licencia depende del **nivel de riesgo** del giro del negocio (bajo, medio, alto, muy alto). Por instrucción explícita del cliente (la municipalidad, en este caso de estudio), este MVP implementa **un único flujo de inspección previa** (primera visita, y una segunda visita solo si hay observaciones), sin diferenciar niveles de riesgo. Esta es una simplificación intencional para el alcance del proyecto, documentada aquí para que quede clara en una futura iteración real del sistema.

## Requisitos exigidos por el sistema para iniciar el trámite

1. RUC válido de **persona jurídica (tipo 20)**, con dígito verificador correcto, verificado contra un servicio de consulta tipo SUNAT: debe figurar **ACTIVO** y **HABIDO**. El sistema valida el formato, el tipo y el dígito verificador localmente (sin depender del servicio externo) antes de consultar SUNAT; ver `lib/validacionRuc.ts`.
2. Razón social (obtenida automáticamente de la consulta de RUC, o ingresada manualmente si el servicio no responde).
3. Domicilio fiscal / dirección del local, restringido a los distritos de la Provincia de Trujillo (ver lista abajo).
4. Plano del local, con fecha de vigencia futura y sin estar "en trámite" (debe ya estar emitido).
5. Pago del derecho de trámite: **S/ 180.00** (monto configurable en `lib/constantes.ts` si el TUPA de la municipalidad cambia).

## Flujo de inspección y decisión

- Con documentación completa y pago aprobado, el sistema programa automáticamente la **primera inspección técnica lo antes posible** (primer día hábil peruano disponible).
- Si el inspector encuentra todo conforme: el expediente queda **Aprobada** y se emite la licencia en PDF (vigencia de 1 año).
- Si el inspector encuentra observaciones en la primera visita: se programa automáticamente una **segunda inspección exactamente a los 30 días hábiles peruanos** (excluyendo sábados, domingos y feriados nacionales).
- Si en la segunda visita también hay observaciones: el expediente queda **Rechazada de forma definitiva**. El negocio no queda bloqueado del sistema, pero para reintentar debe **iniciar un expediente completamente nuevo y pagar nuevamente el derecho de trámite**.

## Vigencia y renovación de la licencia

- La licencia tiene una vigencia de **1 año** desde su fecha de emisión.
- La renovación es **automática solo con el pago del derecho de trámite**, siempre que sea **el mismo local**. Si el negocio cambia de local, debe iniciar un **trámite nuevo completo** (con inspección incluida).

## Cambios de infraestructura

Todo cambio de infraestructura en el local debe ser reportado por el negocio a través del sistema. No reportarlo expone al negocio a que su licencia sea marcada como **Clausurada** por el inspector o el administrador. Este MVP no automatiza la detección física del cambio: solo registra el reporte para revisión.

## Fuera de alcance (por decisión explícita del cliente)

- **Multas**: el sistema no incluye ningún módulo de sanciones económicas.

## Alcance geográfico

Solo se atienden negocios ubicados en los distritos de la Provincia de Trujillo:

Trujillo, El Porvenir, La Esperanza, Florencia de Mora, Huanchaco, Laredo, Moche, Poroto, Salaverry, Simbal y Víctor Larco Herrera.

## Roles del sistema

- **Negocio**: sin cuenta hasta completar el pago del primer trámite; luego usa correo y contraseña para ver su expediente, reportar cambios y renovar.
- **Inspector**: único "agente" humano del proceso. Ve su calendario de inspecciones, revisa documentos y pago, y registra su decisión (conforme / observada).
- **Administrador**: gestiona inspectores y tiene una vista de supervisión de todos los expedientes.
- **Público (sin cuenta)**: puede consultar el estado de un trámite por RUC, viendo solo razón social, estado y el PDF de la licencia si corresponde.
