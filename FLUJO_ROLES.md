# Flujo de Uso por Rol

Explicación práctica de qué hace cada usuario al navegar la aplicación: qué pantallas ve, qué formularios llena y qué botones puede presionar. (Para el contexto general del proyecto, ver [`CONTEXTO_PROYECTO.md`](CONTEXTO_PROYECTO.md)).

---

## 1. Usuario / Negocio que solicita una licencia (sin cuenta)

Flujo tipo wizard, con indicador de pasos, sin necesidad de login.

1. **`/solicitud/nuevo`** — Ingresa su RUC (11 dígitos) y presiona **Validar**. El sistema lo busca en una API tipo SUNAT y muestra razón social/estado/condición; si no lo encuentra, permite escribir la razón social a mano. Si el RUC ya tiene un trámite en curso, se le ofrece un link para **consultar el estado** en vez de continuar. Si todo está bien, presiona **Continuar** y se crea el expediente.
2. **Domicilio** — Elige una dirección entre las registradas en SUNAT (botones clicables). Al elegir una, aparece un formulario con distrito/dirección (de solo lectura), un selector de giro/actividad (con opción "Otro"), nombre comercial, datos del representante legal (autocompletados si se encuentran) y correo/teléfono de contacto. Presiona **Continuar** para guardar y pasar al siguiente paso.
3. **Documentos** — Sube el plano de ubicación del local (PDF/JPG/PNG, máx. 10MB) con el botón **Subir plano** (o **Reemplazar plano** si ya subió uno, con opción de **Eliminar**). El botón **Continuar al pago** se habilita solo cuando hay un plano cargado.
4. **Pago** — Ve el monto del derecho de trámite (S/180). Si Mercado Pago está configurado, ingresa su correo y presiona **Pagar con Mercado Pago** (lo redirige a la pasarela). Si no está configurado (modo prueba), elige un medio de pago simulado y presiona **Pagar**. Al volver de Mercado Pago, una pantalla intermedia (**"Verificando tu pago..."**) le confirma si fue aprobado, quedó pendiente o fue rechazado (con botón **Volver a intentar**).
5. **Confirmación** — Pantalla final: se le indica que no necesita crear cuenta, debe guardar su número de expediente y RUC. Ve el número de expediente, el estado actual, la fecha de la primera inspección (si ya se agendó) y puede **Descargar comprobante de pago**. Desde aquí puede ir a **Consultar el estado de mi trámite** o volver al inicio.
6. **Después de pagado**: no hace nada activamente hasta que lo visite el inspector; puede usar `/consulta` en cualquier momento para revisar el avance con su RUC o número de expediente.

---

## 2. Negocio (con cuenta, para renovación y seguimiento post-licencia)

Portal en `/negocio`, requiere login.

- **Panel principal** — Ve el nombre/RUC del negocio. Si ya tiene licencia: número, fecha de vencimiento, estado (badge), botón **Descargar PDF**, botón **Reportar cambio de infraestructura**, y botón **Renovar licencia** (solo aparece si está por vencer o ya venció). Si tiene un expediente en curso: ve dirección, estado, planos subidos, pagos realizados, inspecciones (con observaciones) y, si el inspector observó el plano, un botón **Corregir el plano observado**. Abajo, un historial completo de expedientes anteriores (solo lectura).
- **Renovar** (`/negocio/renovar`) — Responde **¿Vas a operar en el mismo local?**. Si dice **No**, se le explica que debe iniciar un trámite nuevo completo (botón **Iniciar trámite nuevo**). Si dice **Sí**, paga el derecho de renovación (Mercado Pago o simulado) y, al aprobarse, puede **Descargar nueva licencia (PDF)** y **Descargar comprobante de pago** — sin nueva inspección.
- **Reportar cambio de infraestructura** (`/negocio/reportar-cambio`) — Escribe una descripción del cambio en un textarea y presiona **Enviar reporte**; se le advierte que si no reporta cambios puede llegar a **clausura** de la licencia.

---

## 3. Inspector

Portal en `/inspector`, requiere login. Regla vigente: solo un inspector activo a la vez.

- **Panel principal** (`/inspector`) — Ve su **cupo del día** ("X de Y completadas", con aviso si el cupo diario está lleno) y la lista de visitas pendientes de hoy/atrasadas: turno, nombre del negocio, etiqueta **Atrasada** si corresponde, número de expediente, distrito, y si es 1ª o 2ª visita. Cada fila tiene un link **Ver expediente**. La lista se auto-actualiza sola.
- **Detalle de expediente** (`/inspector/expediente/[id]`) — Ve los datos del negocio (RUC, giro, distrito, dirección), el estado del pago y el plano del local. Si tiene una inspección pendiente asignada, aparece el formulario de decisión:
  - Un textarea de **observaciones** (obligatorio si no aprueba conforme).
  - Un checkbox, solo visible en la primera visita: **"La observación requiere que el negocio cambie el plano"**.
  - Botón **Conforme** (se deshabilita si hay observaciones/checkbox marcado) → emite la licencia de inmediato.
  - Botón **Observada** → en la primera visita programa automáticamente la segunda inspección (30 días hábiles después); en la segunda visita, **rechaza definitivamente** el expediente.
  - Tras enviar, ve un mensaje de resultado (aprobado / segunda visita agendada con fecha / rechazado) y vuelve solo a la lista de inspecciones tras unos segundos.

---

## 4. Cajero

Portal en `/cajero`, requiere login. Antes de cualquier acción de cobro, necesita tener la **caja abierta**.

- **Panel principal** (`/cajero`) —
  - Si no tiene caja abierta: escribe el monto de apertura (mínimo S/500 sugerido por defecto) y presiona **Abrir caja**. Si ya solicitó un cierre y está pendiente de aprobación del admin, ve un aviso y un botón **Actualizar**.
  - Con la caja abierta, ve tres accesos directos: **Nueva solicitud** (inicia el wizard de trámite para un cliente presencial), **Renovar licencia**, y **Cambiar plano observado**; además de una tarjeta de **Cierre de caja** con el monto de apertura, los totales acumulados por medio de pago, y el botón **Solicitar cierre de caja**.
- **Nueva solicitud** — Usa el mismo wizard público (`/solicitud/nuevo` → domicilio → documentos), pero en el paso de pago usa la variante presencial (`pago-presencial`): ve el resumen del expediente y el formulario de cobro (ver más abajo), y presiona **Confirmar pago S/ X**.
- **Renovar licencia** (`/cajero/renovar`) — Busca al negocio por **RUC** (botón **Buscar negocio**). Al encontrarlo, puede reemplazar el plano si hace falta y completa el mismo formulario de cobro presencial. Al confirmar el pago, aparece una pantalla de éxito con botones **Descargar PDF** y **Descargar comprobante de pago**, más accesos para **Registrar otra renovación** o **Volver al panel principal**.
- **Cambiar plano observado** (`/cajero/documentos`) — Busca al negocio por RUC. Si es elegible (un inspector marcó que necesita corregir el plano), ve la observación del inspector, el plano actual, y sube el nuevo archivo con el botón **Reemplazar plano**. Si no es elegible, se le explica el motivo en texto plano.
- **Formulario de cobro presencial** (usado en los tres flujos anteriores) — Elige el medio: efectivo, Yape, o mixto. En mixto, al ingresar un monto el sistema autocompleta el complementario para que la suma sea exacta; si es en efectivo, valida que el vuelto no sea irrazonable; si hay parte en Yape, exige el número de operación. Presiona **Confirmar pago** para cerrar la venta, lo que genera automáticamente el comprobante en PDF.

---

## 5. Admin

Portal en `/admin`, requiere login. Rol de supervisión: la mayoría de sus pantallas son de solo lectura, salvo la gestión de personal y la aprobación de cierres de caja.

- **Expedientes** (`/admin`) — Tabla con todos los expedientes del sistema (número, negocio, distrito, tipo, estado). Sin filtros ni acciones de creación; clic en el número lleva al detalle.
- **Detalle de expediente** (`/admin/expediente/[id]`) — Vista completa de solo lectura: datos del local, plano subido, todos los pagos (con medio/canal/cajero que cobró), todas las inspecciones (con observaciones y si requirió cambio de plano), y las licencias emitidas (con link al PDF).
- **Pagos** (`/admin/pagos`) — Encabezado con el total aprobado y cantidad de pagos; tabla completa de pagos del sistema (fecha, expediente, negocio, monto, medio, canal, cajero, estado). Solo lectura.
- **Inspecciones** (`/admin/inspecciones`) — Tabla de todas las inspecciones registradas históricamente (fecha, turno, expediente, negocio, tipo, inspector, estado, observaciones). Solo lectura.
- **Inspectores** (`/admin/inspectores`) — Formulario para crear un inspector nuevo (nombre, correo, contraseña temporal) con botón **Crear inspector**. Lista de inspectores existentes con botón **Activar/Desactivar** por fila (activar uno desactiva automáticamente a los demás, ya que solo puede haber uno activo).
- **Cajeros** (`/admin/cajeros`) — Mismo patrón: formulario para crear cajero y lista con botón **Activar/Desactivar** por fila.
- **Caja** (`/admin/caja`) — Dos listas: **cierres pendientes de aprobación** (muestra cajero, monto de apertura, total cobrado por sesión, desglose por medio de pago, y botones **Aprobar**/**Rechazar**) e **historial de sesiones de caja** ya cerradas (solo lectura). Aprobar o rechazar refresca ambas listas al instante.

---

## 6. Consulta pública (sin cuenta)

- **`/consulta`** — Cualquier persona escribe un RUC (11 dígitos) o un número de expediente y presiona **Buscar**. Si existe, muestra razón social, número de expediente, estado del trámite y datos de la licencia (estado, vencimiento, botón **Descargar licencia (PDF)**). Deliberadamente NO muestra dirección, pagos ni observaciones (privacidad). Si no encuentra nada, indica "No se encontró ningún trámite".

---

## 7. Login

- **`/login`** — Formulario único (correo + contraseña, botón **Ingresar**) compartido por negocio, inspector, admin y cajero. Si las credenciales son incorrectas, muestra un mensaje de error. Incluye links a **Olvidé mi contraseña** y **Volver al inicio**. Al ingresar correctamente, el sistema redirige automáticamente al panel correspondiente según el rol del usuario.
