// Imports de React: estado y efecto para ciclo de vida del componente
import { useEffect, useState } from 'react'
// Enlace declarativo para navegación interna
import { Link } from 'react-router-dom'
// Iconos de estado: lista de tareas y check de completado
import { ClipboardList, CheckCircle } from 'lucide-react'
// Notificaciones toast para errores
import toast from 'react-hot-toast'
// Cliente de Supabase para consultas a la base de datos
import { supabase } from '../../lib/supabase'
// Store Zustand con el usuario autenticado
import { useAuthStore } from '../../store/authStore'
// Utilidad para generar el hash SHA-256 que identifica unívocamente al votante
import { generarVoterHash } from '../../utils/hash'
// Componentes de UI: layout general, badge de estado y spinner de carga
import Layout from '../../components/layout/Layout'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { procesarEncuestasProgramadas } from '../../utils/scheduledSurveys'

// Panel principal del juez: muestra todas las encuestas abiertas asignadas y su estado de votación
export default function JuezDashboard() {
  // Obtenemos el usuario autenticado del store de autenticación
  const { user } = useAuthStore()
  // Lista de encuestas enriquecidas con proyectos y pendientes de votación
  const [encuestas, setEncuestas] = useState([])
  // Controla si se está cargando la información inicial
  const [cargando, setCargando] = useState(true)

  // Cargamos las encuestas cada vez que cambia el usuario autenticado
  useEffect(() => {
    if (!user) return
    cargarEncuestas()
  }, [user])

  // Carga las encuestas asignadas al juez y calcula cuáles proyectos le quedan por evaluar
  async function cargarEncuestas() {
    setCargando(true)
    try {
      await procesarEncuestasProgramadas()
      // Consulta la tabla 'encuesta_juez' para obtener las encuestas asignadas al juez actual,
      // incluyendo datos anidados de la competición y el evento
      const { data: asignadas, error } = await supabase
        .from('encuesta_juez')
        .select('encuesta(*, competicion(nombre, evento(nombre)))')
        .eq('persona_id', user.id)

      if (error) throw error

      // Extraemos el objeto encuesta de cada fila y filtramos solo las que están abiertas
      const encs = (asignadas || [])
        .map(a => a.encuesta)
        .filter(e => e?.estado === 'abierta')

      // Para cada encuesta abierta, calculamos los proyectos pendientes de votación
      const result = await Promise.all(
        encs.map(async (enc) => {
          // Obtenemos en paralelo: los equipos/proyectos de la competición y el voter_hash del juez
          const [{ data: equipos, error: equiposError }, voterHash] = await Promise.all([
            // Consulta 'equipo' para obtener los proyectos asociados a la competición de esta encuesta
            supabase
              .from('encuesta_equipo')
              .select('equipo(proyecto(*))')
              .eq('encuesta_id', enc.id),

            // Genera el voter_hash = SHA-256(user.id + encuesta.id) para identificar los votos del juez
            generarVoterHash(user.id, enc.id)
          ])

          if (equiposError) throw equiposError

          // Aplanamos el array de equipos para obtener directamente la lista de proyectos
          const proyectos = (equipos || []).flatMap(eq => eq.equipo?.proyecto || [])

          // Solo los votos de ESTE juez, identificados por su voter_hash
          // Consulta 'voto' filtrando por encuesta y por el voter_hash único del juez
          const { data: misVotos, error: votosError } = await supabase
            .from('voto')
            .select('proyecto_id')
            .eq('encuesta_id', enc.id)
            .eq('voter_hash', voterHash)

          if (votosError) throw votosError

          // Creamos un Set de IDs de proyectos ya votados para búsqueda eficiente
          const votados = new Set((misVotos || []).map(v => v.proyecto_id))
          // Filtramos los proyectos que aún no tienen voto registrado por este juez
          const pendientes = proyectos.filter(p => !votados.has(p.id))

          // Devolvemos la encuesta enriquecida con sus proyectos y los pendientes de evaluar
          return { ...enc, proyectos, pendientes }
        })
      )

      setEncuestas(result)
    } catch (err) {
      toast.error(err.message || 'Error al cargar encuestas')
    } finally {
      setCargando(false)
    }
  }

  // Mientras se cargan los datos mostramos el spinner centrado dentro del layout
  if (cargando) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Panel del juez</h1>

      {/* Si no hay encuestas asignadas, mostramos un estado vacío con icono y mensaje */}
      {encuestas.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ClipboardList size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay encuestas abiertas asignadas</p>
          <p className="text-sm mt-1 text-gray-400">El organizador debe asignarte a una encuesta</p>
        </div>
      ) : (
        // Lista de tarjetas, una por encuesta asignada al juez
        <div className="space-y-4">
          {encuestas.map(enc => (
            <div key={enc.id} className="bg-white border border-gray-200 rounded-xl p-5">
              {/* Cabecera de la tarjeta: nombre de la encuesta, competición, evento y estado */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{enc.nombre}</h2>
                  {/* Ruta jerárquica: competición · evento */}
                  <p className="text-sm text-gray-500">
                    {enc.competicion?.nombre} · {enc.competicion?.evento?.nombre}
                  </p>
                </div>

                {/* Indicador de estado: checkmark verde si está todo votado, badge amarillo con los pendientes */}
                {enc.pendientes.length === 0 ? (
                  <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <CheckCircle size={16} />
                    Completado
                  </div>
                ) : (
                  // Badge que muestra el número de proyectos pendientes de evaluar
                  <Badge color="yellow">
                    {enc.pendientes.length} pendiente{enc.pendientes.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {/* Grid de proyectos: verde si ya votado, blanco si pendiente */}
              <div className="grid gap-2 sm:grid-cols-2">
                {enc.proyectos.map(p => {
                  // Un proyecto está votado si NO aparece en la lista de pendientes
                  const votado = !enc.pendientes.find(x => x.id === p.id)

                  return (
                    // Fondo verde si ya evaluado, blanco si pendiente
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        votado ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                        {/* Descripción truncada a una línea si existe */}
                        {p.descripcion && (
                          <p className="text-xs text-gray-500 line-clamp-1">{p.descripcion}</p>
                        )}
                      </div>

                      {/* Si ya votó muestra checkmark; si no, muestra enlace a la página de evaluación */}
                      {votado ? (
                        <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                      ) : (
                        // Enlace que lleva al formulario de votación para este proyecto y encuesta
                        <Link
                          to={`/juez/encuesta/${enc.id}/proyecto/${p.id}`}
                          className="text-sm text-indigo-600 font-medium hover:underline whitespace-nowrap ml-2"
                        >
                          Evaluar
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
