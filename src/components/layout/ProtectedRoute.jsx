// Componente de ruta protegida — impide el acceso a páginas que requieren autenticación
// Si el usuario no está autenticado, redirige a /login
// Si la autenticación aún se está verificando, muestra un spinner para evitar parpadeos
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Spinner from '../ui/Spinner'

/**
 * Envuelve rutas que requieren estar autenticado.
 * @param {React.ReactNode} children - La página a renderizar si hay sesión activa
 */
export default function ProtectedRoute({ children }) {
  // Lee el estado de auth del store global
  const { user, loading } = useAuthStore()

  // Mientras Supabase verifica la sesión (al arrancar la app), muestra spinner
  // Esto evita que el usuario sea redirigido a /login por un instante antes de
  // que la sesión se confirme desde localStorage
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Si no hay usuario autenticado, redirige a la pantalla de login
  // replace=true evita que /login quede en el historial de navegación
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Usuario autenticado: renderiza la página normalmente
  return children
}
