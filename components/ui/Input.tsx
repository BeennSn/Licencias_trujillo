import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
  ({ label, error, className = "", id, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
        {label && <span className="font-medium text-gray-800">{label}</span>}
        <input
          ref={ref}
          id={id}
          className={`border rounded-md px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-100 read-only:text-gray-500 read-only:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${
            error ? "border-red-500" : "border-gray-300"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </label>
    );
  }
);
Input.displayName = "Input";
