import { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "peligro";

const clasesPorVariante: Record<Variante, string> = {
  primario: "bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-300",
  secundario: "bg-white text-blue-700 border border-blue-700 hover:bg-blue-50",
  peligro: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

export function Button({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={`px-4 py-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed ${clasesPorVariante[variante]} ${className}`}
      {...props}
    />
  );
}
