// Dominios de correo desechable detectados en uso real contra este sistema
// (reportados durante pruebas/demo) que todavía NO aparecen en la lista
// pública de disposable-email-domains ni en el repositorio que la
// mantiene. Los servicios de correo temporal configuran servidores de
// correo (MX) reales -para poder mostrar el mensaje recibido en su bandeja
// temporal-, así que la verificación de MX en lib/correoTemporal.ts NO los
// detecta: la única forma de bloquearlos es agregarlos a mano acá apenas
// se detecten.
//
// Agregar un dominio nuevo a esta lista es tan simple como sumar una línea.
export const DOMINIOS_TEMPORALES_MANUAL = [
  "diarshop.com",
] as const;
