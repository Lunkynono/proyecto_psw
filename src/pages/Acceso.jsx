// Página de selección de rol — accesible desde /acceso
// Muestra tres bloques: Administrador, Juez y Participante
// Cada bloque lleva al login correspondiente (admin y juez comparten /login;
// participante tendrá su propia ruta cuando se implemente)
import { Link } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Users } from 'lucide-react'

// Configuración de los tres bloques de acceso
const bloques = [
  {
    icon: LayoutDashboard,
    titulo: 'Administrador',
    descripcion: 'Gestiona eventos, competiciones, equipos y encuestas.',
    color: 'indigo',
    to: '/login',
  },
  {
    icon: ClipboardList,
    titulo: 'Juez',
    descripcion: 'Evalúa los proyectos asignados en las competiciones.',
    color: 'violet',
    to: '/login',
  },
  {
    icon: Users,
    titulo: 'Participante',
    descripcion: 'Accede a tu espacio como participante del evento.',
    color: 'sky',
    to: '/participante',  // Ruta pendiente de implementar en Sprint 2
  },
]

// Clases Tailwind por color — separadas para poder usar JIT de Tailwind correctamente
const colorMap = {
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: 'bg-indigo-100 text-indigo-600',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: 'bg-violet-100 text-violet-600',
    btn: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  sky: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: 'bg-sky-100 text-sky-600',
    btn: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
}

export default function Acceso() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      {/* Cabecera */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Acceder a Votify</h1>
        <p className="text-gray-500 mt-2">Selecciona tu rol para continuar</p>
      </div>

      {/* Grid de 3 bloques de rol — una columna en móvil, tres en escritorio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
        {bloques.map(({ icon: Icon, titulo, descripcion, color, to }) => {
          const c = colorMap[color]
          return (
            <div
              key={titulo}
              className={`flex flex-col items-center text-center rounded-2xl border ${c.border} ${c.bg} p-7`}
            >
              {/* Icono del rol */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${c.icon}`}>
                <Icon size={26} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{titulo}</h2>
              <p className="text-sm text-gray-500 mb-6 flex-1">{descripcion}</p>
              {/* Botón de acceso — lleva al login correspondiente */}
              <Link
                to={to}
                className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors text-center ${c.btn}`}
              >
                Entrar como {titulo.toLowerCase()}
              </Link>
            </div>
          )
        })}
      </div>

      {/* Link para volver a la pantalla principal de voto público */}
      <Link to="/" className="mt-8 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        ← Volver al inicio
      </Link>
    </div>
  )
}
