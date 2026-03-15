// Componente Input — campo de texto con label y mensaje de error integrados
// Compatible con react-hook-form mediante forwardRef (permite que el form acceda al DOM del input)
import { forwardRef } from 'react'

/**
 * Campo de texto reutilizable con label y validación visual.
 * @param {string} label - Texto de la etiqueta (opcional)
 * @param {string} error - Mensaje de error a mostrar bajo el input (opcional)
 * @param {string} className - Clases adicionales para el input
 */
const Input = forwardRef(function Input({ label, error, className = '', ...props }, ref) {
  return (
    <div>
      {/* Label solo se renderiza si se pasa la prop */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <input
        ref={ref}  // Ref necesario para que react-hook-form acceda al elemento del DOM
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          error ? 'border-red-400' : 'border-gray-300'  // Borde rojo si hay error de validación
        } ${className}`}
        {...props}  // Propaga name, type, placeholder, onChange, etc.
      />
      {/* Mensaje de error de validación (viene de react-hook-form) */}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
})

export default Input
