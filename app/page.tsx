import Link from "next/link";

export default function PaginaInicio() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl w-full text-center space-y-10">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">
            Municipalidad Provincial de Trujillo
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Licencia de Funcionamiento Municipal
          </h1>
          <p className="text-gray-600">
            Tramita, consulta y renueva tu licencia de funcionamiento para tu negocio en la Provincia de Trujillo.
          </p>
        </div>

        <Link
          href="/solicitud/nuevo"
          className="block w-full sm:w-auto sm:mx-auto sm:inline-block bg-blue-700 hover:bg-blue-800 text-white text-lg font-semibold px-10 py-5 rounded-xl shadow-md transition-colors"
        >
          Iniciar solicitud de licencia
        </Link>

        <div className="grid sm:grid-cols-2 gap-4 pt-4">
          <Link
            href="/consulta"
            className="border border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-6 py-4 text-gray-800 font-medium transition-colors"
          >
            Consultar estado por RUC
          </Link>
          <Link
            href="/login"
            className="border border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-6 py-4 text-gray-800 font-medium transition-colors"
          >
            Ingresar como inspector / administrador
          </Link>
        </div>
      </div>
    </main>
  );
}
