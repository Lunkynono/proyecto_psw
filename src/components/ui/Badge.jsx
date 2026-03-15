// Componente Badge — etiqueta de colores para mostrar estados, tipos o categorías
// Ejemplos de uso: estado de encuesta (abierta/cerrada), tipo de criterio (numérico/radio), etc.

// Mapa de colores disponibles: cada clave corresponde a clases Tailwind
const colors = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
  purple: 'bg-purple-100 text-purple-700',
}

/**
 * Etiqueta visual de colores.
 * @param {React.ReactNode} children - Texto a mostrar dentro del badge
 * @param {string} color - Color del badge: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'
 */
export default function Badge({ children, color = 'gray' }) {
  return (
    // Pastilla redondeada con el color seleccionado
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}
