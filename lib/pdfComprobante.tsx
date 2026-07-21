// Genera el comprobante de pago (recibo interno, no una factura SUNAT: el
// derecho de trámite no es una operación gravada) que se entrega al negocio
// al terminar de pagar, con el mismo estilo institucional que la licencia
// (ver lib/pdfLicencia.tsx) para que se vea consistente.
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";
import { formatearFechaLarga } from "./fechas";

const AZUL_MPT = "#1b3d6d";

const logoBase64 = (() => {
  try {
    const ruta = path.join(process.cwd(), "public", "logo-mpt.png");
    return `data:image/png;base64,${fs.readFileSync(ruta).toString("base64")}`;
  } catch {
    return null;
  }
})();

const estilos = StyleSheet.create({
  pagina: { fontSize: 10, fontFamily: "Helvetica", color: "#111", paddingHorizontal: 48, paddingVertical: 32 },
  bandaSuperior: { backgroundColor: AZUL_MPT, height: 12, width: "100%", position: "absolute", top: 0, left: 0 },
  encabezado: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 18 },
  logo: { width: 48, height: 48, marginRight: 12 },
  tituloMunicipalidad: { fontSize: 12, fontWeight: 700, color: AZUL_MPT },
  subtituloMunicipalidad: { fontSize: 8.5, color: "#555" },
  bloqueTitulo: { textAlign: "center", marginBottom: 20 },
  tituloComprobante: { fontSize: 14, fontWeight: 700, color: AZUL_MPT, marginBottom: 2 },
  subtituloComprobante: { fontSize: 10 },
  seccionTitulo: { fontWeight: 700, marginBottom: 6, marginTop: 12, color: AZUL_MPT },
  fila: { flexDirection: "row", marginBottom: 5 },
  etiqueta: { fontWeight: 700, width: 150 },
  valor: { flex: 1 },
  tabla: { marginTop: 6, borderWidth: 1, borderColor: "#d1d5db" },
  filaTabla: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d1d5db" },
  filaTablaUltima: { flexDirection: "row" },
  celdaCabecera: { flex: 1, padding: 6, fontWeight: 700, backgroundColor: "#f3f4f6" },
  celda: { flex: 1, padding: 6 },
  celdaMonto: { flex: 1, padding: 6, textAlign: "right" },
  celdaCabeceraMonto: { flex: 1, padding: 6, fontWeight: 700, backgroundColor: "#f3f4f6", textAlign: "right" },
  filaTotal: { flexDirection: "row", marginTop: 4 },
  etiquetaTotal: { flex: 1, textAlign: "right", fontWeight: 700, paddingRight: 6 },
  valorTotal: { width: 90, textAlign: "right", fontWeight: 700 },
  piePagina: { marginTop: 30, fontSize: 8, color: "#555" },
});

export type DetallePagoComprobante = { medioPago: string; monto: number };

export type DatosComprobantePdf = {
  numeroComprobante: string;
  numeroExpediente: string;
  tipoTramite: string;
  razonSocial: string;
  ruc: string;
  direccionLocal: string;
  distrito: string;
  fecha: string;
  detallePagos: DetallePagoComprobante[];
  montoTotal: number;
  atendidoPor: string | null;
};

const ETIQUETAS_MEDIO_PAGO: Record<string, string> = {
  efectivo: "Efectivo",
  yape: "Yape / Plin",
  tarjeta: "Tarjeta",
  pagoefectivo: "PagoEfectivo",
};

function DocumentoComprobante({ datos }: { datos: DatosComprobantePdf }) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.bandaSuperior} />

        <View style={estilos.encabezado}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aquí es el componente de @react-pdf/renderer, no <img>; no soporta prop alt. */}
          {logoBase64 && <Image src={logoBase64} style={estilos.logo} />}
          <View>
            <Text style={estilos.tituloMunicipalidad}>Municipalidad Provincial de Trujillo</Text>
            <Text style={estilos.subtituloMunicipalidad}>Subgerencia de Licencias y Comercializaciones</Text>
          </View>
        </View>

        <View style={estilos.bloqueTitulo}>
          <Text style={estilos.tituloComprobante}>COMPROBANTE DE PAGO</Text>
          <Text style={estilos.subtituloComprobante}>N° {datos.numeroComprobante}</Text>
        </View>

        <Text style={estilos.seccionTitulo}>DATOS DEL NEGOCIO</Text>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Razón Social:</Text>
          <Text style={estilos.valor}>{datos.razonSocial}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>RUC:</Text>
          <Text style={estilos.valor}>{datos.ruc}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Dirección:</Text>
          <Text style={estilos.valor}>{datos.direccionLocal}, {datos.distrito}</Text>
        </View>

        <Text style={estilos.seccionTitulo}>DATOS DEL TRÁMITE</Text>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Trámite:</Text>
          <Text style={estilos.valor}>{datos.tipoTramite}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Expediente:</Text>
          <Text style={estilos.valor}>{datos.numeroExpediente}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Fecha:</Text>
          <Text style={estilos.valor}>{formatearFechaLarga(datos.fecha)}</Text>
        </View>
        {datos.atendidoPor && (
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Atendido por:</Text>
            <Text style={estilos.valor}>{datos.atendidoPor}</Text>
          </View>
        )}

        <Text style={estilos.seccionTitulo}>DETALLE DE PAGO</Text>
        <View style={estilos.tabla}>
          <View style={estilos.filaTabla}>
            <Text style={estilos.celdaCabecera}>Medio de pago</Text>
            <Text style={estilos.celdaCabeceraMonto}>Monto (S/)</Text>
          </View>
          {datos.detallePagos.map((pago, indice) => (
            <View
              key={`${pago.medioPago}-${indice}`}
              style={indice === datos.detallePagos.length - 1 ? estilos.filaTablaUltima : estilos.filaTabla}
            >
              <Text style={estilos.celda}>{ETIQUETAS_MEDIO_PAGO[pago.medioPago] ?? pago.medioPago}</Text>
              <Text style={estilos.celdaMonto}>{pago.monto.toFixed(2)}</Text>
            </View>
          ))}
        </View>
        <View style={estilos.filaTotal}>
          <Text style={estilos.etiquetaTotal}>TOTAL PAGADO:</Text>
          <Text style={estilos.valorTotal}>S/ {datos.montoTotal.toFixed(2)}</Text>
        </View>

        <Text style={estilos.piePagina}>
          Este comprobante acredita el pago del derecho de trámite ante la Municipalidad Provincial de Trujillo. No
          constituye un comprobante de pago tributario (factura/boleta SUNAT).
        </Text>
      </Page>
    </Document>
  );
}

export async function generarPdfComprobante(datos: DatosComprobantePdf): Promise<Buffer> {
  return renderToBuffer(<DocumentoComprobante datos={datos} />);
}
