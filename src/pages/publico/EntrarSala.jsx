// Import de estado para controlar el código introducido y los estados de carga
import { useState } from 'react'
// Navegación programática y enlace declarativo
import { useNavigate, Link } from 'react-router-dom'
// Iconos: Vote para el logo de la página y TrendingUp para el botón de resultados
import { Vote, TrendingUp } from 'lucide-react'
// Notificaciones toast para errores de validación o de red
import toast from 'react-hot-toast'
// Cliente de Supabase para buscar la encuesta por código de sala
import { supabase } from '../../lib/supabase'
import { procesarEncuestasProgramadas } from '../../utils/scheduledSurveys'

// Primera página del flujo público: el usuario introduce el código de sala para votar o ver resultados
export default function EntrarSala() {
  const navigate = useNavigate()
  // Código de sala introducido por el usuario (se fuerza a mayúsculas)
  const [codigo, setCodigo] = useState('')
  // Estado de carga específico para el botón "Votar"
  const [cargando, setCargando] = useState(false)
  // Estado de carga específico para el botón "Ver resultados en vivo"
  const [cargandoResultados, setCargandoResultados] = useState(false)

  // Busca una encuesta en Supabase usando el código de sala introducido
  const buscarEncuesta = async (cod) => {
    await procesarEncuestasProgramadas()
    // Consulta la tabla 'encuesta' filtrando por el campo 'codigo_sala'
    const { data: encuesta, error } = await supabase
      .from('encuesta')
      .select('id, estado, nombre')
      .eq('codigo_sala', cod)
      .single()
    // Si no se encuentra la sala lanzamos un error descriptivo
    if (error || !encuesta) throw new Error('Código de sala no encontrado')
    return encuesta
  }

  // Maneja el envío del formulario para entrar a votar
  const handleEntrar = async (e) => {
    // Prevenimos la recarga de página por defecto del formulario
    e.preventDefault()
    // Ignoramos el envío si el campo está vacío
    if (!codigo.trim()) return
    setCargando(true)
    try {
      // Buscamos la encuesta con el código en mayúsculas
      const encuesta = await buscarEncuesta(codigo.toUpperCase())
      // Solo se puede votar si la encuesta está abierta
      if (encuesta.estado !== 'abierta') {
        toast.error('Esta votación no está abierta')
        return
      }
      // Navegamos a la página de identificación para continuar el flujo público
      navigate(`/sala/${codigo.toUpperCase()}`)
    } catch (err) {
      toast.error(err.message || 'Error al buscar la sala')
    } finally {
      setCargando(false)
    }
  }

  // Maneja el clic en "Ver resultados en vivo" sin necesidad de que la encuesta esté abierta
  const handleVerResultados = async () => {
    // Ignoramos el clic si el campo está vacío
    if (!codigo.trim()) return
    setCargandoResultados(true)
    try {
      // Verificamos que el código de sala existe (independientemente del estado de la encuesta)
      await buscarEncuesta(codigo.toUpperCase())
      // Redirigimos a la página de resultados en tiempo real
      navigate(`/sala/${codigo.toUpperCase()}/resultados`)
    } catch (err) {
      toast.error(err.message || 'Error al buscar la sala')
    } finally {
      setCargandoResultados(false)
    }
  }

  return (
    // Fondo degradado de índigo a blanco, tarjeta centrada
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8 text-center">
        {/* Logo circular con icono de voto */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
            <Vote size={28} className="text-indigo-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Votify</h1>
        <p className="text-sm text-gray-500 mb-6">Introduce el código de sala para votar</p>

        <form onSubmit={handleEntrar} className="space-y-4">
          {/* Input del código de sala: grande, centrado y en mayúsculas automáticas */}
          <input
            value={codigo}
            // Forzamos mayúsculas en tiempo real mientras el usuario escribe
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            // Longitud máxima del código de sala
            maxLength={6}
            className="w-full text-center text-3xl font-bold tracking-widest border-2 border-gray-200 rounded-xl px-4 py-4 focus:outline-none focus:border-indigo-500 uppercase"
            placeholder="XXXXXX"
            autoComplete="off"
          />
          {/* Botón principal para votar: deshabilitado si el código es demasiado corto */}
          <button
            type="submit"
            // Requiere mínimo 4 caracteres para habilitar el botón
            disabled={cargando || codigo.length < 4}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-base hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {cargando ? 'Buscando...' : 'Votar'}
          </button>
          {/* Botón secundario para ver resultados sin necesidad de votar */}
          <button
            type="button"
            onClick={handleVerResultados}
            disabled={cargandoResultados || codigo.length < 4}
            className="w-full flex items-center justify-center gap-2 border-2 border-indigo-200 text-indigo-600 py-3 rounded-xl font-medium text-base hover:bg-indigo-50 disabled:opacity-50 transition-colors"
          >
            <TrendingUp size={18} />
            {cargandoResultados ? 'Buscando...' : 'Ver resultados en vivo'}
          </button>
        </form>

        {/* Sección inferior para usuarios con rol (admin, juez, participante) */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-3">¿Eres admin, juez o participante?</p>
          {/* Enlace a la página de selección de rol */}
          <Link
            to="/acceso"
            className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Acceder al sistema →
          </Link>
        </div>
      </div>
    </div>
  )
}
