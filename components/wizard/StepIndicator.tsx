const PASOS = ["RUC", "Domicilio", "Documentos", "Pago", "Cuenta", "Listo"];

export function StepIndicator({ pasoActual }: { pasoActual: number }) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs justify-center mb-8">
      {PASOS.map((paso, indice) => {
        const numero = indice + 1;
        const activo = numero === pasoActual;
        const completado = numero < pasoActual;
        return (
          <li
            key={paso}
            className={`px-3 py-1 rounded-full border ${
              activo
                ? "bg-blue-700 text-white border-blue-700"
                : completado
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-gray-100 text-gray-500 border-gray-200"
            }`}
          >
            {numero}. {paso}
          </li>
        );
      })}
    </ol>
  );
}
