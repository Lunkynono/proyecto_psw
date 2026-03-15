// Componente Modal — diálogo superpuesto (overlay) para formularios y confirmaciones
// Bloquea el scroll del body mientras está abierto
// Se cierra al hacer clic fuera del contenido o en el botón X
import { X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * Modal reutilizable.
 * @param {boolean} open - Controla si el modal está visible
 * @param {function} onClose - Función llamada al cerrar (clic fuera o en X)
 * @param {string} title - Título mostrado en la cabecera del modal
 * @param {React.ReactNode} children - Contenido del modal
 * @param {string} maxWidth - Clase Tailwind para el ancho máximo (por defecto 'max-w-lg')
 */
export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  // Bloquea el scroll del body cuando el modal está abierto para evitar scroll doble
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    // Limpieza: restaura el scroll si el componente se desmonta mientras está abierto
    return () => { document.body.style.overflow = '' }
  }, [open])

  // No renderiza nada si el modal está cerrado (evita que esté en el DOM innecesariamente)
  if (!open) return null

  return (
    // Overlay semitransparente negro que cubre toda la pantalla
    // El clic en el overlay llama a onClose para cerrar el modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      {/* Contenedor del modal — clic aquí no propaga al overlay (no cierra) */}
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}  // Evita que el clic en el modal lo cierre
      >
        {/* Cabecera con título y botón de cierre */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        {/* Área de contenido del modal */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
