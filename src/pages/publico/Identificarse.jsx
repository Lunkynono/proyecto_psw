// Imports de React: estado y efecto para ciclo de vida
import { useEffect, useState } from 'react'
// Parámetros de URL (código de sala) y navegación programática
import { useParams, useNavigate, Link } from 'react-router-dom'
// Gestión del formulario con validación
import { useForm } from 'react-hook-form'
// Notificaciones toast para errores y avisos
import toast from 'react-hot-toast'
// Cliente de Supabase para verificar la sala y comprobar votos previos
import { supabase } from '../../lib/supabase'
import { procesarEncuestasProgramadas } from '../../utils/scheduledSurveys'
// Spinner de carga mientras se obtienen los datos de la sala
import Spinner from '../../components/ui/Spinner'

// Segunda página del flujo público: el votante introduce su correo para identificarse
export default function Identificarse() {
  // Código de sala extraído de la URL, ej: /sala/ABC123
  const { codigo } = useParams()
  const navigate = useNavigate()
  // Datos de la encuesta cargada (nombre, estado, competición)
  const [encuesta, setEncuesta] = useState(null)
  // Controla si se están cargando los datos iniciales de la sala
  const [cargando, setCargando] = useState(true)
  // Controla si se está procesando la verificación del correo
  const [enviando, setEnviando] = useState(false)

  // Inicializamos react-hook-form para el campo correo
  const { register, handleSubmit, formState: { errors } } = useForm()

  // Al montar el componente, cargamos los datos de la sala usando el código de la URL
  useEffect(() => {
    async function cargar() {
      await procesarEncuestasProgramadas()
      // Consulta la tabla 'encuesta' buscando por código de sala e incluyendo el nombre de la competición
      const { data, error } = await supabase
        .from('encuesta')
        .select('id, nombre, estado, competicion(nombre)')
        .eq('codigo_sala', codigo)
        .single()

      // Si no existe la sala o no está abierta, redirigimos al inicio del flujo
      if (error || !data || data.estado !== 'abierta') {
        toast.error('Sala no disponible')
        return navigate('/sala')
      }
      setEncuesta(data)
      setCargando(false)
    }
    cargar()
  }, [codigo, navigate])

  // Verifica que el correo no haya votado ya y guarda la identidad en localStorage para el siguiente paso
  const onSubmit = async (data) => {
    setEnviando(true)
    try {
      // Usar count para evitar errores de .single() cuando no hay filas
      // Consulta 'publico_registro' para detectar si este correo ya votó en esta encuesta
      const { count, error } = await supabase
        .from('publico_registro')
        .select('*', { count: 'exact', head: true })
        // Filtramos por la encuesta actual
        .eq('encuesta_id', encuesta.id)
        // Filtramos por el correo del votante (normalizado sin espacios)
        .eq('correo_votante', data.correo.trim())

      if (error) throw error

      // Si ya existe un registro para este correo en esta encuesta, bloqueamos el acceso
      if (count > 0) {
        toast.error('Ya has participado en esta votación')
        return
      }

      // Guardamos la identidad del votante en localStorage para recuperarla en VotarPublico
      localStorage.setItem('votify_sala', JSON.stringify({
        correo: data.correo.trim(),
        // Guardamos el código para verificar en la siguiente página que sigue siendo el mismo
        codigo,
        encuesta_id: encuesta.id
      }))
      // Redirigimos a la página de votación con el código de sala
      navigate(`/sala/${codigo}/votar`)
    } catch (err) {
      toast.error('Error al verificar tu registro. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  // Mostramos spinner centrado mientras se verifican los datos de la sala
  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner />
    </div>
  )

  return (
    // Fondo degradado con tarjeta de formulario centrada
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        {/* Cabecera con el contexto de la votación */}
        <div className="mb-5">
          {/* Nombre de la competición en etiqueta pequeña */}
          <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">{encuesta?.competicion?.nombre}</p>
          {/* Nombre de la encuesta como título principal */}
          <h1 className="text-xl font-bold text-gray-900 mt-1">{encuesta?.nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">Introduce tu correo para votar</p>
        </div>

        {/* Formulario de identificación con campo de correo */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Campo de correo electrónico: obligatorio y con validación de formato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
            <input
              type="email"
              {...register('correo', {
                required: 'El correo es obligatorio',
                // Expresión regular para validar que el correo tiene un formato válido
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo inválido' }
              })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="correo@ejemplo.com"
            />
            {/* Mensaje de error si el correo está vacío o tiene formato incorrecto */}
            {errors.correo && <p className="text-red-500 text-xs mt-1">{errors.correo.message}</p>}
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <Link
              to="/sala"
              className="w-full text-center border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Volver
            </Link>

            {/* Botón de envío: deshabilitado mientras se verifica el registro */}
            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {enviando ? 'Verificando...' : 'Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
