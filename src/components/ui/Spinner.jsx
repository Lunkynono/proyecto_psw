// Componente Spinner — indicador visual de carga
// Se usa en botones (size="sm"), en páginas cargando (size="md") y en pantallas completas (size="lg")

/**
 * Círculo giratorio de carga.
 * @param {'sm'|'md'|'lg'} size - Tamaño del spinner
 */
export default function Spinner({ size = 'md' }) {
  // Mapa de tamaños a clases Tailwind
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    // Círculo con borde parcialmente coloreado (top en indigo) que gira con animate-spin
    <div className={`${sizes[size]} border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin`} />
  )
}
