// Componente Button — botón reutilizable con variantes de estilo, tamaños y estado de carga
import Spinner from './Spinner'

// Variantes de color disponibles para el botón
const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',   // Acción principal
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200', // Acción secundaria / cancelar
  danger: 'bg-red-600 text-white hover:bg-red-700',         // Acción destructiva / cerrar
  ghost: 'text-gray-600 hover:bg-gray-100',                 // Sin fondo, sutil
}

// Tamaños de padding y fuente
const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

/**
 * Botón genérico de la aplicación.
 * @param {React.ReactNode} children - Contenido del botón (texto, iconos)
 * @param {'primary'|'secondary'|'danger'|'ghost'} variant - Estilo visual
 * @param {'sm'|'md'|'lg'} size - Tamaño del botón
 * @param {boolean} loading - Si true, muestra spinner y deshabilita el botón
 * @param {boolean} disabled - Deshabilita el botón manualmente
 * @param {string} className - Clases adicionales opcionales
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props  // Resto de props (onClick, type, etc.) se pasan al <button> nativo
}) {
  return (
    <button
      // Deshabilita si se pasa disabled=true o si está en estado loading
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {/* Muestra spinner giratorio mientras loading=true */}
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
