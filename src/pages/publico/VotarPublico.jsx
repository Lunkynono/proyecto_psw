// Imports de React: estado y efecto para ciclo de vida
import { useEffect, useState } from 'react'
// Parámetros de URL, navegación programática y enlace declarativo
import { useParams, useNavigate, Link } from 'react-router-dom'
// Icono de éxito para la pantalla de confirmación tras votar
import { CheckCircle } from 'lucide-react'
// Notificaciones toast para errores
import toast from 'react-hot-toast'
// Cliente de Supabase para insertar votos y respuestas
import { supabase } from '../../lib/supabase'
// Factory Method: votante público
import { VotantePublicoCreator } from '../../factories/creators/VotantePublicoCreator'
// Spinner de carga mientras se obtienen datos de la encuesta
import Spinner from '../../components/ui/Spinner'
import { RUBRICA_NIVELES, agruparRubrica, ordenarOpciones } from '../../utils/scoring'

// Tercera página del flujo público: muestra todos los proyectos con sus criterios para que el público vote
export default function VotarPublico() {
  // Código de sala extraído de la URL, ej: /sala/ABC123/votar
  const { codigo } = useParams()
  const navigate = useNavigate()
  // Datos de la encuesta activa
  const [encuesta, setEncuesta] = useState(null)
  // Lista de criterios de evaluación ordenados por su campo 'orden'
  const [criterios, setCriterios] = useState([])
  // Lista de proyectos que participan en la competición
  const [proyectos, setProyectos] = useState([])
  // Controla si se están cargando los datos iniciales
  const [cargando, setCargando] = useState(true)
  // Controla si se está procesando el envío del voto
  const [enviando, setEnviando] = useState(false)
  // Controla si el voto fue enviado exitosamente (muestra pantalla de confirmación)
  const [completado, setCompletado] = useState(false)

  // Estado de respuestas por proyecto y criterio
  // Mapa de respuestas para criterios numéricos, radio y comentario: clave = "proyectoId_criterioId"
  const [respuestas, setRespuestas] = useState({}) // { [proyectoId_criterioId]: valor }
  // Mapa de selecciones para criterios checklist: clave = "proyectoId_criterioId"
  const [checklistSel, setChecklistSel] = useState({}) // { [proyectoId_criterioId]: [opcionId] }
  const [rubricaSel, setRubricaSel] = useState({})
  // Datos de identidad del votante recuperados del localStorage (nombre, correo, encuesta_id)
  const [identidad, setIdentidad] = useState(null)

  // Al montar, verificamos que existan datos de identidad en localStorage y cargamos la encuesta
  useEffect(() => {
    // Recuperamos la identidad guardada en el paso Identificarse
    const datos = localStorage.getItem('votify_sala')
    // Si no hay identidad guardada, redirigimos al inicio del flujo
    if (!datos) return navigate(`/sala/${codigo}`)
    const parsed = JSON.parse(datos)
    // Verificamos que el código de la sesión guardada coincide con el de la URL actual
    if (parsed.codigo !== codigo) return navigate(`/sala/${codigo}`)
    setIdentidad(parsed)
    // Cargamos los datos de la encuesta usando el ID guardado en la sesión
    cargarDatos(parsed.encuesta_id)
  }, [codigo, navigate])

  // Carga en paralelo la encuesta y sus criterios, luego obtiene los proyectos de la competición
  async function cargarDatos(encuestaId) {
    try {
      // Dos consultas en paralelo para optimizar el tiempo de carga
      const [encuestaRes, criteriosRes] = await Promise.all([
        // Consulta 'encuesta' con el nombre e ID de la competición para obtener los proyectos
        supabase
          .from('encuesta')
          .select('*, competicion(nombre, id)')
          .eq('id', encuestaId)
          .single(),

        // Consulta 'encuesta_criterio' para obtener los criterios con sus opciones
        supabase
          .from('encuesta_criterio')
          .select(`
            criterio (
              *,
              criterio_opcion (*)
            )
          `)
          .eq('encuesta_id', encuestaId)
      ])

      const { data: enc, error: encError } = encuestaRes
      const { data: encCrits, error: critError } = criteriosRes

      if (encError) throw encError
      if (critError) throw critError

      // Si la encuesta no existe o ya no está abierta, redirigimos al inicio del flujo
      if (!enc || enc.estado !== 'abierta') {
        toast.error('Esta votación ya no está disponible')
        return navigate(`/sala/${codigo}`)
      }

      // Consulta la tabla 'equipo' para obtener todos los proyectos de la competición
      const { data: eqs, error: eqError } = await supabase
        .from('equipo')
        .select(`
          *,
          proyecto (*)
        `)
        // Filtramos por la competición asociada a esta encuesta
        .eq('competicion_id', enc.competicion_id)

      if (eqError) throw eqError

      setEncuesta(enc)

      // Aplanamos el array de equipos para obtener directamente la lista de proyectos
      const proyectosCargados = (eqs || []).flatMap(eq => eq.proyecto || [])
      setProyectos(proyectosCargados)

      // Extraemos los objetos criterio y eliminamos posibles valores nulos
      const crits = (encCrits || []).map(ec => ec.criterio).filter(Boolean)

      // Ordenamos los criterios por su campo 'orden' para mostrarlos en la secuencia correcta
      crits.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      setCriterios(crits)

      if (crits.length === 0) {
        toast.error('Esta encuesta no tiene criterios configurados')
      }

      if (proyectosCargados.length === 0) {
        toast.error('Esta competición no tiene proyectos disponibles para votar')
      }
    } catch (err) {
      toast.error(err.message || 'Error al cargar la encuesta')
    } finally {
      setCargando(false)
    }
  }

  // Actualiza la respuesta para un criterio concreto de un proyecto específico
  const setRespuesta = (proyId, critId, valor) => {
    // Usamos una clave compuesta "proyectoId_criterioId" para identificar cada celda del formulario
    setRespuestas(prev => ({ ...prev, [`${proyId}_${critId}`]: valor }))
  }

  // Gestiona la selección/deselección de opciones en criterios checklist para un proyecto
  const toggleChecklist = (proyId, critId, opId, maxSel) => {
    // Clave compuesta para identificar el conjunto de selecciones de este par proyecto-criterio
    const key = `${proyId}_${critId}`
    setChecklistSel(prev => {
      // Obtenemos las opciones actualmente seleccionadas para esta clave
      const actuales = prev[key] || []
      // Si la opción ya estaba seleccionada, la deseleccionamos
      if (actuales.includes(opId)) {
        return { ...prev, [key]: actuales.filter(x => x !== opId) }
      }
      // Si se ha alcanzado el límite de selecciones, no permitimos añadir más
      if (maxSel && actuales.length >= maxSel) return prev
      // Añadimos la nueva opción al array de seleccionados
      return { ...prev, [key]: [...actuales, opId] }
    })
  }

  // Procesa el envío del voto del público: registra el votante y guarda los votos de cada proyecto
 const handleEnviar = async () => {
  if (!encuesta || !identidad) {
    toast.error('No se ha podido validar la votación')
    return
  }

  if (proyectos.length === 0) {
    toast.error('No hay proyectos disponibles para votar')
    return
  }

  if (criterios.length === 0) {
    toast.error('No hay criterios configurados para esta encuesta')
    return
  }

  const rubricaIncompleta = proyectos.some(proyecto =>
    criterios.some(c => {
      if (c.tipo !== 'rubrica') return false
      const key = `${proyecto.id}_${c.id}`
      return agruparRubrica(c.criterio_opcion || []).some(g => !rubricaSel[key]?.[g.aspecto])
    })
  )

  if (rubricaIncompleta) {
    toast.error('Completa todos los aspectos de las rubricas')
    return
  }

  setEnviando(true)

  try {
    const creator = new VotantePublicoCreator(supabase)
    const votante = creator.crear()

    await votante.votar({
      encuesta,
      identidad,
      proyectos,
      criterios,
      respuestas,
      checklistSel,
      rubricaSel
    })

    localStorage.removeItem('votify_sala')
    setCompletado(true)
  } catch (err) {
    toast.error(err.message || 'Error al enviar el voto')
  } finally {
    setEnviando(false)
  }
}

  // Mientras se cargan los datos mostramos el spinner centrado en pantalla
  if (cargando) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>

  // Pantalla de confirmación que aparece tras enviar el voto exitosamente
  if (completado) return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4">
      <div className="text-center">
        {/* Icono grande de check verde como confirmación visual */}
        <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Gracias por participar!</h1>
        <p className="text-gray-500 mb-6">Tu voto ha sido registrado correctamente.</p>
        {/* Enlace a la página de resultados en tiempo real */}
        <Link
          to={`/sala/${codigo}/resultados`}
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          Ver resultados en vivo
        </Link>
      </div>
    </div>
  )

  return (
    // Fondo gris claro con el formulario de votación
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Cabecera con el contexto de la votación e identidad del votante */}
        <div className="mb-6">
          {/* Nombre de la competición en etiqueta pequeña de color índigo */}
          <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">{encuesta?.competicion?.nombre}</p>
          {/* Nombre de la encuesta como título principal */}
          <h1 className="text-xl font-bold text-gray-900 mt-1">{encuesta?.nombre}</h1>
          {/* Recordatorio de quién está votando */}
         <p className="text-sm text-gray-500">Votación anónima</p>
        </div>

        {/* Aviso si faltan proyectos o criterios */}
        {(proyectos.length === 0 || criterios.length === 0) && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            {proyectos.length === 0 && (
              <p>Esta competición no tiene proyectos visibles para votar.</p>
            )}
            {criterios.length === 0 && (
              <p>Esta encuesta no tiene criterios visibles para votar.</p>
            )}
          </div>
        )}

        {/* Lista de tarjetas, una por proyecto, cada una con todos sus criterios */}
        <div className="space-y-6">
          {proyectos.map(proyecto => (
            <div key={proyecto.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Cabecera de la tarjeta del proyecto con fondo azul claro */}
              <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50">
                <h2 className="font-semibold text-gray-900">{proyecto.nombre}</h2>
                {/* Descripción del proyecto si existe */}
                {proyecto.descripcion && <p className="text-sm text-gray-500 mt-1">{proyecto.descripcion}</p>}
              </div>
              {/* Sección de criterios: un control de input por cada criterio */}
              <div className="p-5 space-y-4">
                {criterios.map(c => (
                  <div key={c.id}>
                    {/* Título del criterio */}
                    <p className="text-sm font-medium text-gray-700 mb-2">{c.titulo}</p>
                    {/* Descripción/instrucciones del criterio si existe */}
                    {c.descripcion && <p className="text-xs text-gray-500 mb-2">{c.descripcion}</p>}

                    {/* Input numérico controlado con rango del criterio */}
                    {c.tipo === 'numerico' && (
                      <input
                        type="number"
                        step="any"
                        // Aplicamos el rango definido en el criterio si existe
                        min={c.rango_min ?? undefined}
                        max={c.rango_max ?? undefined}
                        // Valor controlado desde el estado de respuestas
                        value={respuestas[`${proyecto.id}_${c.id}`] || ''}
                        onChange={e => setRespuesta(proyecto.id, c.id, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        // Placeholder dinámico: muestra el rango si está definido
                        placeholder={c.rango_min != null && c.rango_max != null ? `${c.rango_min} – ${c.rango_max}` : 'Valor numérico'}
                      />
                    )}

                    {/* Grupo de radio buttons para selección única */}
                    {c.tipo === 'radio' && (
                      <div className="space-y-2">
                        {/* Ordenamos las opciones por su campo 'orden' */}
                        {ordenarOpciones(c.criterio_opcion || []).map(op => (
                          <label key={op.id} className="flex items-start gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              // Agrupamos los radios por proyecto y criterio para que sean independientes
                              name={`r_${proyecto.id}_${c.id}`}
                              value={op.id}
                              // Comparación no estricta porque el valor guardado puede ser number o string
                              checked={respuestas[`${proyecto.id}_${c.id}`] == op.id}
                              onChange={() => setRespuesta(proyecto.id, c.id, op.id)}
                            />
                            <span>{op.texto}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {c.tipo === 'rubrica' && (
                      <div className="w-full overflow-x-auto rounded-xl border border-gray-200">
                        <div className="min-w-[620px]">
                          <div className="grid grid-cols-[1.25fr_repeat(4,1fr)] bg-gray-50 text-xs font-semibold text-gray-600">
                            <div className="px-3 py-2">Aspecto</div>
                            {RUBRICA_NIVELES.map(nivel => (
                              <div key={nivel.key} className="px-3 py-2 text-center">{nivel.label}</div>
                            ))}
                          </div>
                        {agruparRubrica(c.criterio_opcion || []).map(grupo => (
                          <div key={grupo.aspecto} className="grid grid-cols-[1.25fr_repeat(4,1fr)] border-t border-gray-100">
                            <div className="flex items-center px-3 py-3 text-sm font-semibold text-gray-800">{grupo.aspecto}</div>
                              {RUBRICA_NIVELES.map(nivel => {
                              const opcion = grupo.opciones.find(op => op.nivel === nivel.key)
                              const key = `${proyecto.id}_${c.id}`
                              const seleccionado = rubricaSel[key]?.[grupo.aspecto] === opcion?.id
                              return (
                                <label key={nivel.key} className={`m-1 flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-semibold transition hover:shadow-sm ${seleccionado ? 'ring-2 ring-indigo-500 ring-offset-1 ' : ''}${nivel.color}`}>
                                  <input
                                    type="radio"
                                    className="sr-only"
                                    checked={seleccionado}
                                    disabled={!opcion}
                                    onChange={() => setRubricaSel(prev => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || {}), [grupo.aspecto]: opcion.id }
                                    }))}
                                  />
                                  <span>
                                    <span className="block">{nivel.label}</span>
                                    {opcion?.descriptor && (
                                      <span className="mt-1 block text-[11px] font-normal leading-snug text-gray-600">
                                        {opcion.descriptor}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        ))}
                        </div>
                      </div>
                    )}

                    {/* Grupo de checkboxes para selección múltiple con límite opcional */}
                    {c.tipo === 'checklist' && (
                      <div className="space-y-2">
                        {/* Mostramos el límite de selecciones si está definido en el criterio */}
                        {c.max_selecciones && (
                          <p className="text-xs text-gray-400">Máximo {c.max_selecciones} selecciones</p>
                        )}
                        {ordenarOpciones(c.criterio_opcion || []).map(op => {
                          // Clave compuesta para identificar las selecciones de este par proyecto-criterio
                          const key = `${proyecto.id}_${c.id}`
                          // Selecciones actuales para esta clave
                          const selec = checklistSel[key] || []
                          // Una opción está bloqueada si se alcanzó el máximo y no está seleccionada
                          const bloqueado = c.max_selecciones && selec.length >= c.max_selecciones && !selec.includes(op.id)
                          return (
                            // Opacidad reducida y cursor bloqueado al alcanzar el máximo
                            <label key={op.id} className={`flex items-center gap-2 text-sm ${bloqueado ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={selec.includes(op.id)}
                                disabled={bloqueado}
                                // Delegamos la lógica de toggle al handler especializado
                                onChange={() => toggleChecklist(proyecto.id, c.id, op.id, c.max_selecciones)}
                              />
                              <span>{op.texto}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {/* Área de texto libre para criterios de tipo comentario */}
                    {c.tipo === 'comentario' && (
                      <textarea
                        rows={3}
                        // Valor controlado desde el estado de respuestas
                        value={respuestas[`${proyecto.id}_${c.id}`] || ''}
                        onChange={e => setRespuesta(proyecto.id, c.id, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Tu comentario..."
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Botón de envío del voto: deshabilitado mientras se procesa, con padding inferior extra */}
        <div className="mt-6 pb-8">
          <button
            onClick={handleEnviar}
            disabled={enviando || proyectos.length === 0 || criterios.length === 0}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {enviando ? 'Enviando...' : 'Enviar voto'}
          </button>
        </div>
      </div>
    </div>
  )
}
