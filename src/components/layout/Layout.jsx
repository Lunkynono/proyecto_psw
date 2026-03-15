// Componente Layout — envuelve todas las páginas autenticadas (admin y juez)
// Proporciona la barra de navegación superior y el contenedor centrado con padding
import Navbar from './Navbar'

/**
 * Layout principal de la aplicación.
 * @param {React.ReactNode} children - Contenido de la página a renderizar
 */
export default function Layout({ children }) {
  return (
    // Fondo gris claro que ocupa toda la pantalla
    <div className="min-h-screen bg-gray-50">
      {/* Barra de navegación con logo, links de rol y botón de cerrar sesión */}
      <Navbar />
      {/* Contenedor centrado con ancho máximo y padding horizontal/vertical */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
