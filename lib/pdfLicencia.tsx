// Genera el PDF de la licencia de funcionamiento con @react-pdf/renderer,
// replicando el formato oficial impreso de la Municipalidad Provincial de
// Trujillo (membrete, escudo, franjas azules, texto de facultades, cuadro
// de datos y pie de firma).
//
// Se sube una copia a Vercel Blob al emitir/renovar (solo como respaldo de
// auditoría); la descarga real del usuario pasa por
// app/api/licencias/[id]/pdf, que llama a generarPdfLicencia() EN CADA
// REQUEST para que la marca de agua "VENCIDA" siempre refleje el estado
// actual (ver comentario ahí sobre por qué no se puede confiar en un PDF
// estático una vez que la licencia puede vencer).
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import {
  RESOLUCION_GERENCIAL_LICENCIA,
  ORDENANZA_MUNICIPAL_LICENCIA,
  FIRMANTE_LICENCIA_NOMBRE,
  FIRMANTE_LICENCIA_CARGO,
} from "./constantes";
import { formatearFechaLarga } from "./fechas";

const AZUL_MPT = "#1b3d6d";

// Código Catastral y Zonificación los asigna el área de catastro de la
// municipalidad, no el negocio (no se piden en el wizard); quedan
// pendientes de completar en el propio sistema catastral municipal.
const DATO_CATASTRAL_PENDIENTE = "Por asignar";

const logoBase64 = (() => {
  try {
    const ruta = path.join(process.cwd(), "public", "logo-mpt.png");
    return `data:image/png;base64,${fs.readFileSync(ruta).toString("base64")}`;
  } catch {
    return null;
  }
})();

const estilos = StyleSheet.create({
  pagina: { fontSize: 9.5, fontFamily: "Helvetica", color: "#111" },
  bandaSuperior: { backgroundColor: AZUL_MPT, height: 16, width: "100%" },
  bandaInferior: {
    backgroundColor: AZUL_MPT,
    height: 16,
    width: "100%",
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  contenido: { paddingHorizontal: 48, paddingTop: 20, paddingBottom: 90 },
  encabezado: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  logo: { width: 56, height: 56, marginRight: 14 },
  tituloMunicipalidad: { fontSize: 14, fontWeight: 700, color: AZUL_MPT },
  bloqueTitulo: { textAlign: "center", marginBottom: 16 },
  tituloLicencia: { fontSize: 13, fontWeight: 700, color: AZUL_MPT, marginBottom: 2 },
  subtituloLicencia: { fontSize: 9.5, marginBottom: 2 },
  parrafoLegal: { marginBottom: 14, lineHeight: 1.4, textAlign: "justify" },
  concedeA: { fontWeight: 700, marginBottom: 10 },
  fila: { flexDirection: "row", marginBottom: 7 },
  etiqueta: { fontWeight: 700, width: 150 },
  valor: { flex: 1 },
  fecha: { textAlign: "right", marginTop: 18, marginBottom: 22 },
  firmaBloque: { alignItems: "center", marginBottom: 6 },
  firmaMunicipalidad: { fontWeight: 700, fontSize: 9.5 },
  firmaSubgerencia: { fontSize: 8.5, marginBottom: 26 },
  firmaLinea: { borderTopWidth: 1, borderTopColor: "#111", width: 220, marginBottom: 4 },
  firmaNombre: { fontWeight: 700, fontSize: 9 },
  firmaCargo: { fontSize: 9 },
  qr: { width: 64, height: 64, position: "absolute", right: 48, bottom: 96 },
  prohibiciones: { marginTop: 4 },
  prohibicionesTitulo: { fontWeight: 700, marginBottom: 4 },
  prohibicionItem: { marginBottom: 2 },
  obligatorio: { fontWeight: 700, marginTop: 8 },
  piePagina: { marginTop: 14, fontSize: 7.5, color: "#555" },
  marcaDeAgua: {
    position: "absolute",
    top: 340,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 90,
    fontWeight: 700,
    color: "#dc2626",
    opacity: 0.35,
    transform: "rotate(-35deg)",
  },
});

export type DatosLicenciaPdf = {
  numeroLicencia: string;
  numeroExpediente: string;
  razonSocial: string;
  ruc: string;
  representanteLegalNombre: string;
  representanteLegalDni: string;
  nombreComercial: string;
  distrito: string;
  direccionLocal: string;
  giroActividad: string;
  fechaEmision: string;
  fechaVencimiento: string;
  urlConsultaPublica: string;
};

function DocumentoLicencia({
  datos,
  qrDataUrl,
  vencida,
}: {
  datos: DatosLicenciaPdf;
  qrDataUrl: string;
  vencida: boolean;
}) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.bandaSuperior} />

        {vencida && <Text style={estilos.marcaDeAgua}>VENCIDA</Text>}

        <View style={estilos.contenido}>
          <View style={estilos.encabezado}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aquí es el componente de @react-pdf/renderer, no <img>; no soporta prop alt. */}
            {logoBase64 && <Image src={logoBase64} style={estilos.logo} />}
            <Text style={estilos.tituloMunicipalidad}>Municipalidad Provincial de Trujillo</Text>
          </View>

          <View style={estilos.bloqueTitulo}>
            <Text style={estilos.tituloLicencia}>LICENCIA DE FUNCIONAMIENTO</Text>
            <Text style={estilos.subtituloLicencia}>N° {datos.numeroLicencia}</Text>
            <Text style={estilos.subtituloLicencia}>Ley N° 28976</Text>
          </View>

          <Text style={estilos.parrafoLegal}>
            En uso de las facultades conferidas mediante Resolución Gerencial {RESOLUCION_GERENCIAL_LICENCIA}, la
            Ordenanza Municipal {ORDENANZA_MUNICIPAL_LICENCIA} y la Ley Orgánica de Municipalidades.
          </Text>

          <Text style={estilos.concedeA}>CONCEDE A:</Text>

          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Razón Social:</Text>
            <Text style={estilos.valor}>{datos.razonSocial}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Doc. de Identidad:</Text>
            <Text style={estilos.valor}>RUC: {datos.ruc}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Representante Legal:</Text>
            <Text style={estilos.valor}>{datos.representanteLegalNombre}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Doc. de Identidad:</Text>
            <Text style={estilos.valor}>DNI: {datos.representanteLegalDni}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Nombre Comercial:</Text>
            <Text style={estilos.valor}>{datos.nombreComercial}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Dirección:</Text>
            <Text style={estilos.valor}>{datos.direccionLocal}, {datos.distrito}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Código Catastral:</Text>
            <Text style={estilos.valor}>{DATO_CATASTRAL_PENDIENTE}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Giro:</Text>
            <Text style={estilos.valor}>{datos.giroActividad}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Zonificación:</Text>
            <Text style={estilos.valor}>{DATO_CATASTRAL_PENDIENTE}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Visto el Expediente:</Text>
            <Text style={estilos.valor}>{datos.numeroExpediente}</Text>
          </View>

          <Text style={estilos.fecha}>Trujillo, {formatearFechaLarga(datos.fechaEmision)}</Text>

          <View style={estilos.firmaBloque}>
            <Text style={estilos.firmaMunicipalidad}>MUNICIPALIDAD PROVINCIAL DE TRUJILLO</Text>
            <Text style={estilos.firmaSubgerencia}>Subgerencia de Licencias y Comercializaciones</Text>
            <View style={estilos.firmaLinea} />
            <Text style={estilos.firmaNombre}>{FIRMANTE_LICENCIA_NOMBRE}</Text>
            <Text style={estilos.firmaCargo}>{FIRMANTE_LICENCIA_CARGO}</Text>
          </View>

          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aquí es el componente de @react-pdf/renderer, no <img>; no soporta prop alt. */}
          <Image src={qrDataUrl} style={estilos.qr} />

          <View style={estilos.prohibiciones}>
            <Text style={estilos.prohibicionesTitulo}>PROHIBICIONES AL ESTABLECIMIENTO</Text>
            <Text style={estilos.prohibicionItem}>Prohibido consumir bebidas alcohólicas dentro y fuera del local</Text>
            <Text style={estilos.prohibicionItem}>Prohibido ocupar pasajes de circulación</Text>
            <Text style={estilos.obligatorio}>
              ES OBLIGATORIO QUE SE EXHIBA EN UN LUGAR VISIBLE DEL ESTABLECIMIENTO
            </Text>
          </View>

          <Text style={estilos.piePagina}>
            Fecha de vencimiento: {datos.fechaVencimiento}. Escanea el código QR para verificar la vigencia de
            esta licencia en {datos.urlConsultaPublica}.
          </Text>
        </View>

        <View style={estilos.bandaInferior} />
      </Page>
    </Document>
  );
}

export async function generarPdfLicencia(datos: DatosLicenciaPdf, vencida: boolean = false): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(datos.urlConsultaPublica);
  return renderToBuffer(<DocumentoLicencia datos={datos} qrDataUrl={qrDataUrl} vencida={vencida} />);
}
