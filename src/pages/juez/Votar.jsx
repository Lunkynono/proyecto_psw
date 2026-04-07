// Imports de React: estado y efecto para ciclo de vida
import { useEffect, useState } from 'react'
// Parámetros de URL y navegación programática
import { useParams, useNavigate } from 'react-router-dom'
// Gestión del formulario con validación
import { useForm } from 'react-hook-form'
// Notificaciones toast para feedback al usuario
import toast from 'react-hot-toast'
// Cliente de Supabase para consultas e inserciones en la base de datos
import { supabase } from '../../lib/supabase'
// Store Zustand con el usuario autenticado
import { useAuthStore } from '../../store/authStore'
// Utilidad para generar el voter_hash = SHA-256(userId + encuestaId)
import { generarVoterHash } from '../../utils/hash'
// Factory Method: crea la clase de votante según el rol
import { VotanteFactory } from '../../factories/VotanteFactory'
// Componentes de UI: layout, botón y spinner de carga
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

// Página de evaluación: permite al juez votar un proyecto concreto dentro de una encuesta
export default function Votar() {
  // Extraemos los IDs de la URL: encuestaId y proyectoId
  const { encuestaId, proyectoId } = useParams()
  // Usuario autenticado para generar su voter_hash único
  const { user } = useAuthStore()
  const navigate = useNavigate()
  // Datos de la encuesta actual
  const [encuesta, setEncuesta] = useState(null)
  // Datos del proyecto a evaluar
  const [proyecto, setProyecto] = useState(null)
  // Lista de criterios de evaluación ordenados por su campo 'orden'
  const [criterios, setCriterios] = useState([])
  // Controla si se están cargando los datos iniciales
  const [cargando, setCargando] = useState(true)
  // Controla si se está procesando el envío del voto
  const [enviando, setEnviando] = useState(false)
  // Estado de selecciones para criterios de tipo checklist: { [criterioId]: [opcionId, ...] }
  const [checklistSeleccionados, setChecklistSeleccionados] = useState({})

  // Inicializamos react-hook-form para los campos de criterios numéricos, radio y comentario
  const { register, handleSubmit, formState: { errors } } = useForm()

  // Cargamos los datos cuando cambian los parámetros de la URL
  useEffect(() => { cargarDatos() }, [encuestaId, proyectoId])

  // Carga en paralelo los datos de la encuesta, el proyecto y sus criterios de evaluación
  async function cargarDatos() {
    try {
      // Tres consultas en paralelo para optimizar el tiempo de carga
      const [{ data: enc }, { data: proy }, { data: encCrits }] = await Promise.all([
        // Consulta 'encuesta' con datos de la competición para mostrar el contexto
        supabase.from('encuesta').select('*, competicion(nombre)').eq('id', encuestaId).single(),
        // Consulta 'proyecto' con el nombre del equipo al que pertenece
        supabase.from('proyecto').select('*, equipo(nombre)').eq('id', proyectoId).single(),
        // Consulta 'encuesta_criterio' para obtener los criterios asociados a esta encuesta,
        // incluyendo las opciones de cada criterio (para radio y checklist)
        supabase.from('encuesta_criterio').select('criterio(*, criterio_opcion(*))').eq('encuesta_id', encuestaId)
      ])
      setEncuesta(enc)
      setProyecto(proy)
      // Extraemos los objetos criterio de la relación y eliminamos posibles valores nulos
      const crits = (encCrits || []).map(ec => ec.criterio).filter(Boolean)
      // Ordenamos los criterios por su campo 'orden' para mostrarlos en la secuencia correcta
      crits.sort((a, b) => a.orden - b.orden)
      setCriterios(crits)
    } catch (err) {
      toast.error('Error al cargar el formulario')
    } finally {
      setCargando(false)
    }
  }

  // Gestiona la selección/deselección de opciones en criterios de tipo checklist
  const toggleChecklist = (critId, opcionId, maxSel) => {
    setChecklistSeleccionados(prev => {
      // Obtenemos las opciones actualmente seleccionadas para este criterio
      const actuales = prev[critId] || []
      // Si la opción ya estaba seleccionada, la deseleccionamos
      if (actuales.includes(opcionId)) {
        return { ...prev, [critId]: actuales.filter(x => x !== opcionId) }
      }
      // Si se ha alcanzado el límite máximo de selecciones, no permitimos más
      if (maxSel && actuales.length >= maxSel) return prev
      // Añadimos la nueva opción al array de seleccionados
      return { ...prev, [critId]: [...actuales, opcionId] }
    })
  }

  // Procesa el envío del formulario de votación delegando en la fábrica
  const onSubmit = async (data) => {
    setEnviando(true)
    try {
      //Extrae
      const votante = VotanteFactory.crear('juez', supabase)// Crea objeto dominio
      const voterHash = await generarVoterHash(user.id, encuestaId)

      //no conoce tablas, solo contrato
      await votante.votar({encuestaId, proyectoId, voterHash, criterios,data, checklistSeleccionados})

      toast.success('Voto registrado correctamente')
      navigate('/juez')
    } catch (err) {//manejo de errores
      if (err.code === '23505') {//duplicado
        toast.error('Ya has votado por este proyecto')
      } else {
        toast.error(err.message || 'Error al registrar el voto')
      }
    } finally {
      setEnviando(false)
    }
  }

  // Mientras se cargan los datos mostramos el spinner centrado
  if (cargando) return <Layout><div className="flex justify-center py-12"><Spinner /></div></Layout>

  return (
    <Layout>
      {/* Contenedor con ancho máximo para una lectura cómoda */}
      <div className="max-w-xl mx-auto">
        {/* Cabecera con el contexto: encuesta, proyecto y equipo */}
        <div className="mb-5">
          {/* Nombre de la encuesta como subtítulo superior */}
          <p className="text-sm text-gray-500">{encuesta?.nombre}</p>
          {/* Nombre del proyecto como título principal */}
          <h1 className="text-xl font-bold text-gray-900">{proyecto?.nombre}</h1>
          {/* Equipo al que pertenece el proyecto */}
          <p className="text-sm text-gray-500">{proyecto?.equipo?.nombre}</p>
          {/* Descripción del proyecto si existe */}
          {proyecto?.descripcion && <p className="text-sm text-gray-600 mt-2">{proyecto.descripcion}</p>}
        </div>

        {/* Formulario de evaluación con un bloque por cada criterio */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {criterios.map(c => (
            // Tarjeta individual para cada criterio de evaluación
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
              {/* Título del criterio */}
              <p className="font-medium text-gray-800 mb-1">{c.titulo}</p>
              {/* Descripción/instrucciones del criterio si existe */}
              {c.descripcion && <p className="text-xs text-gray-500 mb-3">{c.descripcion}</p>}

              {/* Input numérico con validación de rango mínimo y máximo según el criterio */}
              {c.tipo === 'numerico' && (
                <div>
                  <input
                    type="number"
                    step="any"
                    // Aplicamos el rango definido en el criterio si existe
                    min={c.rango_min ?? undefined}
                    max={c.rango_max ?? undefined}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    // Placeholder dinámico: muestra el rango si está definido
                    placeholder={c.rango_min != null && c.rango_max != null ? `${c.rango_min} – ${c.rango_max}` : 'Valor numérico'}
                    {...register(`criterio_${c.id}`, {
                      required: 'Obligatorio',
                      // Validación del valor mínimo si está definido en el criterio
                      min: c.rango_min != null ? { value: c.rango_min, message: `Mínimo ${c.rango_min}` } : undefined,
                      // Validación del valor máximo si está definido en el criterio
                      max: c.rango_max != null ? { value: c.rango_max, message: `Máximo ${c.rango_max}` } : undefined
                    })}
                  />
                  {/* Mensaje de error de validación para este criterio */}
                  {errors[`criterio_${c.id}`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`criterio_${c.id}`].message}</p>
                  )}
                </div>
              )}

              {/* Lista de opciones de selección única (radio buttons) */}
              {c.tipo === 'radio' && (
                <div className="space-y-2">
                  {/* Ordenamos las opciones por su campo 'orden' */}
                  {(c.criterio_opcion || []).sort((a, b) => a.orden - b.orden).map(op => (
                    <label key={op.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      {/* Registramos el radio en react-hook-form como campo obligatorio */}
                      <input type="radio" value={op.id} {...register(`criterio_${c.id}`, { required: 'Selecciona una opción' })} />
                      {op.texto}
                    </label>
                  ))}
                  {errors[`criterio_${c.id}`] && (
                    <p className="text-red-500 text-xs">{errors[`criterio_${c.id}`].message}</p>
                  )}
                </div>
              )}

              {/* Lista de opciones de selección múltiple (checkboxes) con límite opcional */}
              {c.tipo === 'checklist' && (
                <div className="space-y-2">
                  {/* Mostramos el límite de selecciones si está definido en el criterio */}
                  {c.max_selecciones && (
                    <p className="text-xs text-gray-400 mb-1">Máximo {c.max_selecciones} selecciones</p>
                  )}
                  {(c.criterio_opcion || []).sort((a, b) => a.orden - b.orden).map(op => {
                    // Selecciones actuales para este criterio
                    const selec = checklistSeleccionados[c.id] || []
                    // Una opción está bloqueada si se alcanzó el máximo y no está ya seleccionada
                    const bloqueado = c.max_selecciones && selec.length >= c.max_selecciones && !selec.includes(op.id)
                    return (
                      // Opacidad reducida y cursor bloqueado cuando se alcanza el límite
                      <label key={op.id} className={`flex items-center gap-2 text-sm ${bloqueado ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={selec.includes(op.id)}
                          disabled={bloqueado}
                          // Delegamos la lógica de toggle al handler especializado
                          onChange={() => toggleChecklist(c.id, op.id, c.max_selecciones)}
                        />
                        {op.texto}
                      </label>
                    )
                  })}
                </div>
              )}

              {/* Área de texto libre para criterios de tipo comentario */}
              {c.tipo === 'comentario' && (
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Tu comentario..."
                  // Campo opcional, sin validación requerida
                  {...register(`criterio_${c.id}`)}
                />
              )}
            </div>
          ))}

          {/* Botonera inferior: cancelar (vuelve al dashboard) y enviar el voto */}
          <div className="flex justify-between">
            <Button type="button" variant="secondary" onClick={() => navigate('/juez')}>Cancelar</Button>
            {/* El botón muestra spinner mientras se procesa el envío */}
            <Button type="submit" loading={enviando}>Enviar voto</Button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
