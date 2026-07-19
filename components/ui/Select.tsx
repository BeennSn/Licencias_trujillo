import { SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }
>(({ label, error, className = "", id, children, ...props }, ref) => {
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      {label && <span className="font-medium text-gray-800">{label}</span>}
      <select
        ref={ref}
        id={id}
        className={`border rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-red-500" : "border-gray-300"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </label>
  );
});
Select.displayName = "Select";
