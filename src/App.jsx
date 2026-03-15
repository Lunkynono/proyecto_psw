// Componente raíz de la aplicación
// Configura el router, inicializa la sesión de Supabase Auth y define todas las rutas
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import Spinner from './components/ui/Spinner'

// Componente de protección para rutas autenticadas
import ProtectedRoute from './components/layout/ProtectedRoute'

// Autenticación
import Login from './pages/auth/Login'

// Páginas del administrador
import AdminDashboard from './pages/admin/Dashboard'
import EventoCrear from './pages/admin/EventoCrear'
import EventoEditar from './pages/admin/EventoEditar'
import CompeticionDetalle from './pages/admin/CompeticionDetalle'
import EncuestaCrear from './pages/admin/EncuestaCrear'
import Resultados from './pages/admin/Resultados'

// Páginas del juez
import JuezDashboard from './pages/juez/Dashboard'
import Votar from './pages/juez/Votar'

// Páginas públicas (sin cuenta)
import Acceso from './pages/Acceso'
import EntrarSala from './pages/publico/EntrarSala'
import Identificarse from './pages/publico/Identificarse'
import VotarPublico from './pages/publico/VotarPublico'
import ResultadosPublico from './pages/publico/ResultadosPublico'

// Componente de redirección inteligente para la ruta raíz "/"
// Si hay usuario autenticado → va a /admin; si no → muestra la pantalla pública (EntrarSala)
function RootRedirect() {
  const { user, loading } = useAuthStore()

  // Mientras se verifica la sesión, muestra un spinner para evitar redirecciones prematuras
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    )
  }

  // Usuario autenticado: redirige al panel de administración
  if (user) return <Navigate to="/admin" replace />

  // Sin sesión: muestra la pantalla de entrada de código de sala (público)
  return <EntrarSala />
}

export default function App() {
  const { setUser, setPerfil, setLoading } = useAuthStore()

  useEffect(() => {
    // PASO 1: getSession() inicializa el SDK de Supabase con el token guardado en localStorage
    // Es necesario llamarlo antes de cualquier consulta autenticada (INSERT, SELECT con RLS, etc.)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)  // Guarda el usuario en el store (o null si no hay sesión)
      setLoading(false)               // Marca la inicialización como completa — desbloquea las rutas

      // Si hay sesión, carga el perfil extendido (nombre, correo) desde la tabla 'persona'
      if (session?.user) {
        supabase.from('persona').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setPerfil(data ?? null))
      }
    }).catch(() => setLoading(false))  // Si getSession falla, desbloquea igualmente para no quedar cargando

    // PASO 2: onAuthStateChange escucha cambios posteriores (login, logout, refresh de token)
    // Se salta el evento INITIAL_SESSION porque ya lo maneja getSession() arriba
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return  // Evitar doble procesamiento del estado inicial

      setUser(session?.user ?? null)  // Actualiza el store ante cualquier cambio de sesión

      if (session?.user) {
        // Recarga el perfil cuando el usuario inicia sesión
        supabase.from('persona').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setPerfil(data ?? null))
      } else {
        // Limpia el perfil cuando se cierra sesión
        setPerfil(null)
      }
    })

    // Cancela la suscripción al desmontar el componente para evitar memory leaks
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      {/* Sistema de notificaciones toast (esquina superior derecha) */}
      <Toaster position="top-right" />
      <Routes>
        {/* Pantalla de login y registro */}
        <Route path="/login" element={<Login />} />

        {/* Raíz: redirige a /admin si autenticado, o muestra EntrarSala si no */}
        <Route path="/" element={<RootRedirect />} />

        {/* Rutas del administrador — todas protegidas por ProtectedRoute */}
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/eventos/nuevo" element={<ProtectedRoute><EventoCrear /></ProtectedRoute>} />
        <Route path="/admin/eventos/:id/editar" element={<ProtectedRoute><EventoEditar /></ProtectedRoute>} />
        <Route path="/admin/competiciones/:id" element={<ProtectedRoute><CompeticionDetalle /></ProtectedRoute>} />
        <Route path="/admin/competiciones/:id/encuesta/nueva" element={<ProtectedRoute><EncuestaCrear /></ProtectedRoute>} />
        <Route path="/admin/encuestas/:id/resultados" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />

        {/* Rutas del juez — protegidas */}
        <Route path="/juez" element={<ProtectedRoute><JuezDashboard /></ProtectedRoute>} />
        <Route path="/juez/encuesta/:encuestaId/proyecto/:proyectoId" element={<ProtectedRoute><Votar /></ProtectedRoute>} />

        {/* Selector de rol (admin / juez / participante) */}
        <Route path="/acceso" element={<Acceso />} />

        {/* Rutas públicas — flujo de voto popular sin cuenta */}
        <Route path="/sala" element={<EntrarSala />} />                        {/* Entrada por código */}
        <Route path="/sala/:codigo" element={<Identificarse />} />             {/* Identificación con nombre+email */}
        <Route path="/sala/:codigo/votar" element={<VotarPublico />} />        {/* Formulario de votación */}
        <Route path="/sala/:codigo/resultados" element={<ResultadosPublico />} /> {/* Resultados en tiempo real */}
      </Routes>
    </BrowserRouter>
  )
}
