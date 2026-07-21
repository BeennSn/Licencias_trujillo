// Genera el comprobante de pago al terminar una venta (nueva solicitud o
// renovación, web o presencial): arma el PDF con los datos que YA están en
// el expediente/negocio (no se le vuelve a pedir nada al negocio), lo sube
// a Vercel Blob, deja un registro en "comprobantes_pago" para trazabilidad
// y lo manda por correo adjunto.
//
// A propósito NUNCA lanza: se llama justo después de que el pago (y, en el
// caso de "conforme", la licencia) ya quedó confirmado en la base de datos;
// que falle la generación del comprobante no debe deshacer ni bloquear una
// venta que ya es real. Si algo sale mal queda solo en el log del servidor.
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "./db/client";
import { expedientes, negocios, usuarios, comprobantesPago } from "./db/schema";
import { generarNumeroComprobante } from "./numeracion";
import { generarPdfComprobante, type DetallePagoComprobante } from "./pdfComprobante";
import { aFechaIso } from "./diasHabilesPeru";
import { enviarCorreoComprobantePago } from "./email";

export type ResultadoComprobante = { numeroComprobante: string; pdfUrl: string };

export async function generarComprobantePago(params: {
  expedienteId: string;
  detallePagos: DetallePagoComprobante[];
  cajeroId?: string;
}): Promise<ResultadoComprobante | null> {
  const { expedienteId, detallePagos, cajeroId } = params;

  try {
    const [expediente] = await db.select().from(expedientes).where(eq(expedientes.id, expedienteId)).limit(1);
    if (!expediente) return null;

    const [negocio] = await db.select().from(negocios).where(eq(negocios.id, expediente.negocioId)).limit(1);
    if (!negocio) return null;

    let atendidoPor: string | null = null;
    if (cajeroId) {
      const [cajero] = await db.select().from(usuarios).where(eq(usuarios.id, cajeroId)).limit(1);
      atendidoPor = cajero?.nombre ?? null;
    }

    const montoTotal = detallePagos.reduce((suma, pago) => suma + pago.monto, 0);
    const numeroComprobante = await generarNumeroComprobante();
    const hoy = aFechaIso(new Date());

    const pdfBuffer = await generarPdfComprobante({
      numeroComprobante,
      numeroExpediente: expediente.numeroExpediente ?? "",
      tipoTramite: expediente.tipo === "renovacion" ? "Renovación de licencia de funcionamiento" : "Licencia de funcionamiento nueva",
      razonSocial: negocio.razonSocial,
      ruc: negocio.ruc,
      direccionLocal: expediente.direccionLocal ?? "",
      distrito: expediente.distrito ?? "",
      fecha: hoy,
      detallePagos,
      montoTotal,
      atendidoPor,
    });

    const blob = await put(`comprobantes/${numeroComprobante}.pdf`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      allowOverwrite: true,
    });

    await db.insert(comprobantesPago).values({
      numeroComprobante,
      expedienteId,
      negocioId: negocio.id,
      monto: montoTotal.toFixed(2),
      pdfUrl: blob.url,
    });

    // El comprobante ya quedó generado y guardado en este punto (PDF, blob
    // y fila en comprobantes_pago), así que si el envío del correo falla
    // igual se devuelve el resultado — que el negocio no reciba el correo
    // no debe ocultar el botón de descarga en la pantalla de confirmación.
    if (expediente.emailContacto) {
      try {
        await enviarCorreoComprobantePago(expediente.emailContacto, {
          numeroComprobante,
          numeroExpediente: expediente.numeroExpediente ?? "",
          razonSocial: negocio.razonSocial,
          montoTotal,
          pdfBuffer,
          pdfUrl: blob.url,
        });
      } catch (error) {
        console.error("Error mandando el correo del comprobante de pago:", error);
      }
    }

    return { numeroComprobante, pdfUrl: blob.url };
  } catch (error) {
    console.error("Error generando el comprobante de pago:", error);
    return null;
  }
}
