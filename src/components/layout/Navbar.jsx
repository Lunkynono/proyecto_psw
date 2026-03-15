// Barra de navegación superior — visible en todas las páginas autenticadas
// Muestra el logo, links de navegación según el rol activo, nombre del usuario y botón de salida
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Vote, LayoutDashboard, ClipboardList } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export default function Navbar() {
  // Obtiene el perfil (nombre) y la función de logout del store global
  const { perfil, logout } = useAuthStore()
  const navigate = useNavigate()
  // useLocation permite leer la ruta actual para resaltar el link activo
  const location = useLocation()

  // Detecta si la ruta actual es de administración o de juez para resaltar el tab correspondiente
  const esAdmin = location.pathname.startsWith('/admin')
  const esJuez = location.pathname.startsWith('/juez')

  // Cierra sesión y redirige a la pantalla de inicio
  const handleLogout = async () => {
    await logout()    // Llama a Supabase signOut y limpia el store
    navigate('/')     // Vuelve a la pantalla pública de entrada
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Sección izquierda: logo + links de rol */}
      <div className="flex items-center gap-4">
        {/* Logo con icono de voto — lleva a la raíz */}
        <Link to="/" className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
          <Vote size={22} />
          Votify
        </Link>

        {/* Links de navegación: Admin y Juez — se resaltan según la ruta activa */}
        <div className="flex items-center gap-1">
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              esAdmin
                ? 'bg-indigo-50 text-indigo-700'   // Activo
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <LayoutDashboard size={15} />
            <span className="hidden sm:block">Admin</span>
          </Link>
          <Link
            to="/juez"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              esJuez
                ? 'bg-indigo-50 text-indigo-700'   // Activo
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <ClipboardList size={15} />
            <span className="hidden sm:block">Juez</span>
          </Link>
        </div>
      </div>

      {/* Sección derecha: nombre del usuario y botón de cierre de sesión */}
      <div className="flex items-center gap-3">
        {/* Muestra el nombre del perfil si está disponible (oculto en móvil) */}
        {perfil && (
          <span className="text-sm text-gray-600 hidden sm:block">{perfil.nombre}</span>
        )}
        {/* Botón de cerrar sesión */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden sm:block">Salir</span>
        </button>
      </div>
    </nav>
  )
}
