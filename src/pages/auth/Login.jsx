// Página de login y registro — accesible desde /login
// Sirve tanto para administradores como para jueces (comparten la misma pantalla)
// Tras autenticarse, redirige a /admin si el usuario tiene eventos propios, o a /juez si no
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

// Determina a qué pantalla debe ir el usuario según su rol:
// - Si tiene al menos un evento como organizador → es admin → /admin
// - Si no tiene eventos → es juez (u otro rol) → /juez
async function resolverDestino(userId) {
  const { count } = await supabase
    .from('evento')
    .select('*', { count: 'exact', head: true })  // Solo cuenta filas, no trae datos
    .eq('organizador_id', userId)
  return count > 0 ? '/admin' : '/juez'
}

export default function Login() {
  // Controla si el formulario está en modo login o en modo registro
  const [isRegistro, setIsRegistro] = useState(false)
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm()

  // Cuando el store confirma que hay usuario autenticado, decide a qué ruta ir
  // Esto se dispara tanto tras login exitoso como si ya había sesión activa
  useEffect(() => {
    if (!user) return
    resolverDestino(user.id).then(destino => navigate(destino, { replace: true }))
  }, [user])

  // Maneja tanto el login como el registro dependiendo del estado isRegistro
  const onSubmit = async (data) => {
    setCargando(true)
    try {
      if (isRegistro) {
        // Registro: crea una nueva cuenta en Supabase Auth
        // El trigger handle_new_user creará automáticamente la fila en la tabla 'persona'
        const { error } = await supabase.auth.signUp({
          email: data.correo,
          password: data.contrasena,
          options: { data: { nombre: data.nombre } }  // Metadatos usados por el trigger
        })
        if (error) throw error
        toast.success('Registro exitoso. Revisa tu correo para confirmar tu cuenta.')
      } else {
        // Login: autentica con email y contraseña
        // Si es exitoso, Supabase actualiza la sesión y el useEffect de arriba redirige
        const { error } = await supabase.auth.signInWithPassword({
          email: data.correo,
          password: data.contrasena
        })
        if (error) throw error
        // La navegación la dispara el useEffect cuando user se actualice en el store
      }
    } catch (err) {
      toast.error(err.message || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md w-full max-w-sm p-8">
        {/* Botón de volver a la pantalla de selección de rol */}
        <Link to="/acceso" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-5 transition-colors">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Votify</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {isRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Campo de nombre — solo visible en modo registro */}
          {isRegistro && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                {...register('nombre', { required: 'El nombre es obligatorio' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Tu nombre"
              />
              {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
            </div>
          )}

          {/* Campo de correo electrónico */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              {...register('correo', {
                required: 'El correo es obligatorio',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo inválido' }
              })}
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="correo@ejemplo.com"
            />
            {errors.correo && <p className="text-red-500 text-xs mt-1">{errors.correo.message}</p>}
          </div>

          {/* Campo de contraseña — mínimo 6 caracteres (requisito de Supabase Auth) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              {...register('contrasena', {
                required: 'La contraseña es obligatoria',
                minLength: { value: 6, message: 'Mínimo 6 caracteres' }
              })}
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
            {errors.contrasena && <p className="text-red-500 text-xs mt-1">{errors.contrasena.message}</p>}
          </div>

          {/* Botón de submit — deshabilitado mientras carga */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {cargando ? 'Cargando...' : isRegistro ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        {/* Toggle para cambiar entre login y registro */}
        <p className="text-center text-sm text-gray-500 mt-4">
          {isRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            className="text-indigo-600 font-medium hover:underline"
            onClick={() => setIsRegistro(!isRegistro)}
          >
            {isRegistro ? 'Iniciar sesión' : 'Registrarse'}
          </button>
        </p>
      </div>
    </div>
  )
}
