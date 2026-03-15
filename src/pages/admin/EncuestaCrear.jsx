// Página de creación de encuesta — ruta /admin/competiciones/:id/encuesta/nueva
// Permite al admin configurar una nueva encuesta (votación) para una competición:
// - Nombre, descripción, tipo de votante (juez/público/ambos) y peso
// - Selección de criterios de evaluación ya existentes en la competición
// - Creación de nuevos criterios directamente desde esta pantalla
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

// Etiquetas y colores de los tipos de criterio para los badges
const TIPO_LABELS = { numerico: 'Numérico', radio: 'Radio', checklist: 'Checklist', comentario: 'Comentario' }
const TIPO_COLORS = { numerico: 'blue', radio: 'purple', checklist: 'green', comentario: 'yellow' }

export default function EncuestaCrear() {
  const { id: competicionId } = useParams()  // ID de la competición desde la URL
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [comp, setComp] = useState(null)
  const [criterios, setCriterios] = useState([])          // Criterios disponibles de la competición
  const [proyectos, setProyectos] = useState([])          // Proyectos que se evaluarán (solo para mostrar)
  const [criteriosSeleccionados, setCriteriosSeleccionados] = useState([])  // IDs de criterios seleccionados
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [modalCriterio, setModalCriterio] = useState(false)
  const [guardandoCriterio, setGuardandoCriterio] = useState(false)

  // Estado del formulario del modal de nuevo criterio
  const [nuevoCriterio, setNuevoCriterio] = useState({
    titulo: '', descripcion: '', tipo: 'numerico', peso: 1.0,
    rango_min: '', rango_max: '', max_selecciones: '', ilimitado: true,
    opciones: [{ texto: '' }, { texto: '' }]  // Opciones para tipos radio/checklist
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { tipo_votante: 'juez', peso: 1.0 }
  })

  useEffect(() => { cargarDatos() }, [competicionId])

  // Carga la competición, sus criterios y equipos en paralelo
  // Verifica que el usuario es organizador del evento
  async function cargarDatos() {
    try {
      const [{ data: competicion }, { data: crits }, { data: eqs }] = await Promise.all([
        // Trae la competición con su evento para verificar acceso
        supabase.from('competicion').select('*, evento(organizador_id, nombre, id)').eq('id', competicionId).single(),
        // Trae los criterios de esta competición con sus opciones
        supabase.from('criterio').select('*, criterio_opcion(*)').eq('competicion_id', competicionId).order('orden'),
        // Trae los equipos con sus proyectos (para mostrar qué proyectos se evaluarán)
        supabase.from('equipo').select('*, proyecto(*)').eq('competicion_id', competicionId)
      ])
      // Control de acceso
      if (!competicion || competicion.evento.organizador_id !== user.id) {
        toast.error('Sin acceso')
        return navigate('/admin')
      }
      setComp(competicion)
      setCriterios(crits || [])
      // Aplana el array de proyectos: cada equipo puede tener múltiples proyectos
      const prs = (eqs || []).flatMap(eq => eq.proyecto || [])
      setProyectos(prs)
    } catch (err) {
      toast.error('Error al cargar')
    } finally {
      setCargando(false)
    }
  }

  // Añade o quita un criterio de la selección para esta encuesta
  const toggleCriterio = (critId) => {
    setCriteriosSeleccionados(prev =>
      prev.includes(critId) ? prev.filter(x => x !== critId) : [...prev, critId]
    )
  }

  // Crea un nuevo criterio en la BD y lo añade automáticamente a la selección
  const crearCriterio = async () => {
    if (!nuevoCriterio.titulo.trim()) return toast.error('Título obligatorio')
    setGuardandoCriterio(true)
    try {
      // Construye el payload según el tipo de criterio
      const payload = {
        competicion_id: Number(competicionId),
        titulo: nuevoCriterio.titulo.trim(),
        descripcion: nuevoCriterio.descripcion || null,
        tipo: nuevoCriterio.tipo,
        peso: parseFloat(nuevoCriterio.peso) || 1.0,
        orden: criterios.length  // Se añade al final de los criterios existentes
      }
      // Rango solo aplica a criterios numéricos
      if (nuevoCriterio.tipo === 'numerico') {
        payload.rango_min = nuevoCriterio.rango_min !== '' ? parseFloat(nuevoCriterio.rango_min) : null
        payload.rango_max = nuevoCriterio.rango_max !== '' ? parseFloat(nuevoCriterio.rango_max) : null
      }
      // Máximo de selecciones solo aplica a checklist
      if (nuevoCriterio.tipo === 'checklist') {
        payload.max_selecciones = nuevoCriterio.ilimitado ? null : parseInt(nuevoCriterio.max_selecciones) || null
      }
      const { data: crit, error } = await supabase.from('criterio').insert(payload).select().single()
      if (error) throw error

      // Inserta las opciones para criterios tipo radio o checklist
      if (['radio', 'checklist'].includes(nuevoCriterio.tipo)) {
        const opciones = nuevoCriterio.opciones.filter(o => o.texto.trim())
        if (opciones.length > 0) {
          await supabase.from('criterio_opcion').insert(opciones.map((o, i) => ({ criterio_id: crit.id, texto: o.texto.trim(), orden: i })))
        }
      }
      // Añade el criterio a la lista local y lo marca como seleccionado automáticamente
      setCriterios([...criterios, { ...crit, criterio_opcion: [] }])
      setCriteriosSeleccionados([...criteriosSeleccionados, crit.id])
      // Resetea el formulario del modal
      setNuevoCriterio({ titulo: '', descripcion: '', tipo: 'numerico', peso: 1.0, rango_min: '', rango_max: '', max_selecciones: '', ilimitado: true, opciones: [{ texto: '' }, { texto: '' }] })
      setModalCriterio(false)
      toast.success('Criterio creado y añadido')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardandoCriterio(false)
    }
  }

  // Crea la encuesta con los criterios seleccionados
  const onSubmit = async (data) => {
    let seleccionados = [...criteriosSeleccionados]

    // Regla UT 3266: toda encuesta debe tener al menos un criterio de tipo 'comentario'
    // Si el admin no seleccionó ninguno, se crea uno automático llamado "Comentarios adicionales"
    const tieneComentario = criterios.filter(c => seleccionados.includes(c.id)).some(c => c.tipo === 'comentario')
    if (!tieneComentario) {
      const { data: autoCrit, error } = await supabase.from('criterio').insert({
        competicion_id: Number(competicionId),
        titulo: 'Comentarios adicionales',
        tipo: 'comentario',
        peso: 1.0,
        orden: criterios.length
      }).select().single()
      if (!error) seleccionados.push(autoCrit.id)  // Añade el criterio automático a la selección
    }

    setGuardando(true)
    try {
      // PASO 1: Crea la encuesta
      const { data: encuesta, error } = await supabase.from('encuesta').insert({
        competicion_id: Number(competicionId),
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        tipo_votante: data.tipo_votante,  // 'juez', 'publico' o 'ambos'
        peso: parseFloat(data.peso) || 1.0,
        creador_id: user.id
      }).select().single()
      if (error) throw error

      // PASO 2: Vincula los criterios seleccionados a la encuesta mediante la tabla pivote
      if (seleccionados.length > 0) {
        await supabase.from('encuesta_criterio').insert(
          seleccionados.map(cid => ({ encuesta_id: encuesta.id, criterio_id: cid }))
        )
      }

      toast.success('Encuesta creada')
      navigate(`/admin/competiciones/${competicionId}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <Layout><div className="flex justify-center py-12"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb: Mis eventos → Evento → Competición → Nueva encuesta */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link to="/admin" className="hover:text-indigo-600">Mis eventos</Link>
          <ChevronRight size={14} />
          <Link to={`/admin/eventos/${comp?.evento?.id}/editar`} className="hover:text-indigo-600">{comp?.evento?.nombre}</Link>
          <ChevronRight size={14} />
          <Link to={`/admin/competiciones/${competicionId}`} className="hover:text-indigo-600">{comp?.nombre}</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900">Nueva encuesta</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Información básica de la encuesta */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">Información de la encuesta</h2>
            <Input
              label="Nombre *"
              error={errors.nombre?.message}
              {...register('nombre', { required: 'Obligatorio' })}
              placeholder="Votación principal"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('descripcion')} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de votante</label>
                {/* Define quién puede votar en esta encuesta */}
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" {...register('tipo_votante')}>
                  <option value="juez">Jurado</option>
                  <option value="publico">Público</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
              <div className="w-28">
                {/* Peso relativo de esta encuesta respecto a otras del mismo evento */}
                <label className="block text-sm font-medium text-gray-700 mb-1">Peso encuesta</label>
                <input type="number" step="0.1" min="0.1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" {...register('peso')} />
              </div>
            </div>
          </div>

          {/* Selección de criterios de evaluación */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Criterios de evaluación</h2>
              <Button type="button" size="sm" variant="secondary" onClick={() => setModalCriterio(true)}>
                <Plus size={14} /> Crear criterio
              </Button>
            </div>
            {criterios.length === 0 ? (
              <p className="text-sm text-gray-500">No hay criterios. Crea el primero.</p>
            ) : (
              <div className="space-y-2">
                {/* Checkbox para seleccionar qué criterios incluir en esta encuesta */}
                {criterios.map(c => (
                  <label key={c.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={criteriosSeleccionados.includes(c.id)} onChange={() => toggleCriterio(c.id)} className="mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.titulo}</span>
                        <Badge color={TIPO_COLORS[c.tipo]}>{TIPO_LABELS[c.tipo]}</Badge>
                        <Badge color="gray">peso {c.peso}</Badge>
                      </div>
                      {c.descripcion && <p className="text-xs text-gray-500 mt-0.5">{c.descripcion}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Lista de proyectos que participarán (informativo, no editable aquí) */}
          {proyectos.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Proyectos a evaluar</h2>
              <div className="space-y-2">
                {proyectos.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                    {p.nombre}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate(`/admin/competiciones/${competicionId}`)}>Cancelar</Button>
            <Button type="submit" loading={guardando}>Crear encuesta</Button>
          </div>
        </form>
      </div>

      {/* Modal para crear un nuevo criterio directamente desde esta pantalla */}
      <Modal open={modalCriterio} onClose={() => setModalCriterio(false)} title="Crear criterio" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input value={nuevoCriterio.titulo} onChange={e => setNuevoCriterio({ ...nuevoCriterio, titulo: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input value={nuevoCriterio.descripcion} onChange={e => setNuevoCriterio({ ...nuevoCriterio, descripcion: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={nuevoCriterio.tipo} onChange={e => setNuevoCriterio({ ...nuevoCriterio, tipo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="numerico">Numérico</option>
                <option value="radio">Radio</option>
                <option value="checklist">Checklist</option>
                <option value="comentario">Comentario</option>
              </select>
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso</label>
              <input type="number" step="0.1" min="0.1" value={nuevoCriterio.peso}
                onChange={e => setNuevoCriterio({ ...nuevoCriterio, peso: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {/* Rango min/max solo para criterios numéricos */}
          {nuevoCriterio.tipo === 'numerico' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mín</label>
                <input type="number" value={nuevoCriterio.rango_min} onChange={e => setNuevoCriterio({ ...nuevoCriterio, rango_min: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="0" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Máx</label>
                <input type="number" value={nuevoCriterio.rango_max} onChange={e => setNuevoCriterio({ ...nuevoCriterio, rango_max: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="10" />
              </div>
            </div>
          )}
          {/* Opciones de texto para criterios radio y checklist */}
          {['radio', 'checklist'].includes(nuevoCriterio.tipo) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Opciones</label>
                <Button type="button" size="sm" variant="secondary" onClick={() => setNuevoCriterio({ ...nuevoCriterio, opciones: [...nuevoCriterio.opciones, { texto: '' }] })}>
                  <Plus size={13} />
                </Button>
              </div>
              {nuevoCriterio.opciones.map((op, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={op.texto} onChange={e => { const ops = [...nuevoCriterio.opciones]; ops[i].texto = e.target.value; setNuevoCriterio({ ...nuevoCriterio, opciones: ops }) }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={`Opción ${i + 1}`} />
                  {/* Botón de eliminar opción — solo si hay más de 2 */}
                  {nuevoCriterio.opciones.length > 2 && (
                    <button type="button" onClick={() => setNuevoCriterio({ ...nuevoCriterio, opciones: nuevoCriterio.opciones.filter((_, j) => j !== i) })} className="text-red-400">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Límite de selecciones para criterios checklist */}
          {nuevoCriterio.tipo === 'checklist' && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Máx. selecciones:</label>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={nuevoCriterio.ilimitado} onChange={e => setNuevoCriterio({ ...nuevoCriterio, ilimitado: e.target.checked })} />
                Ilimitado
              </label>
              {!nuevoCriterio.ilimitado && (
                <input type="number" min="1" value={nuevoCriterio.max_selecciones} onChange={e => setNuevoCriterio({ ...nuevoCriterio, max_selecciones: e.target.value })}
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalCriterio(false)}>Cancelar</Button>
            <Button loading={guardandoCriterio} onClick={crearCriterio}>Crear y añadir</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
