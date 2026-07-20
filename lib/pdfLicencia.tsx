// Genera el PDF de la licencia de funcionamiento con @react-pdf/renderer.
// Se sube una copia a Vercel Blob al emitir/renovar (solo como respaldo de
// auditoría); la descarga real del usuario pasa por
// app/api/licencias/[id]/pdf, que llama a generarPdfLicencia() EN CADA
// REQUEST para que la marca de agua "VENCIDA" siempre refleje el estado
// actual (ver comentario ahí sobre por qué no se puede confiar en un PDF
// estático una vez que la licencia puede vencer).
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";

const estilos = StyleSheet.create({
  pagina: { padding: 48, fontSize: 11, fontFamily: "Helvetica" },
  encabezado: { textAlign: "center", marginBottom: 24 },
  titulo: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitulo: { fontSize: 10, color: "#555" },
  fila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  etiqueta: { fontWeight: 700, width: 160 },
  valor: { flex: 1 },
  qr: { width: 90, height: 90, alignSelf: "center", marginTop: 24 },
  piePagina: { marginTop: 32, fontSize: 8, color: "#777", textAlign: "center" },
  marcaDeAgua: {
    position: "absolute",
    top: 320,
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
        {vencida && <Text style={estilos.marcaDeAgua}>VENCIDA</Text>}

        <View style={estilos.encabezado}>
          <Text style={estilos.titulo}>Municipalidad Provincial de Trujillo</Text>
          <Text style={estilos.subtitulo}>Licencia de Funcionamiento Municipal</Text>
        </View>

        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>N° de Licencia:</Text>
          <Text style={estilos.valor}>{datos.numeroLicencia}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>N° de Expediente:</Text>
          <Text style={estilos.valor}>{datos.numeroExpediente}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Razón Social:</Text>
          <Text style={estilos.valor}>{datos.razonSocial}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>RUC:</Text>
          <Text style={estilos.valor}>{datos.ruc}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Giro / Actividad:</Text>
          <Text style={estilos.valor}>{datos.giroActividad}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Distrito:</Text>
          <Text style={estilos.valor}>{datos.distrito}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Dirección del local:</Text>
          <Text style={estilos.valor}>{datos.direccionLocal}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Fecha de emisión:</Text>
          <Text style={estilos.valor}>{datos.fechaEmision}</Text>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.etiqueta}>Fecha de vencimiento:</Text>
          <Text style={estilos.valor}>{datos.fechaVencimiento}</Text>
        </View>

        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aquí es el componente de @react-pdf/renderer, no <img>; no soporta prop alt. */}
        <Image src={qrDataUrl} style={estilos.qr} />

        <Text style={estilos.piePagina}>
          Documento emitido conforme a la Ley N° 28976, Ley Marco de Licencia de Funcionamiento, y su
          reglamento D.S. N° 046-2017-PCM. Escanea el código QR para verificar la vigencia de esta licencia
          en {datos.urlConsultaPublica}.
        </Text>
      </Page>
    </Document>
  );
}

export async function generarPdfLicencia(datos: DatosLicenciaPdf, vencida: boolean = false): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(datos.urlConsultaPublica);
  return renderToBuffer(<DocumentoLicencia datos={datos} qrDataUrl={qrDataUrl} vencida={vencida} />);
}
