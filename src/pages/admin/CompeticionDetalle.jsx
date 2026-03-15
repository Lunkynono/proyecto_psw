// Página de detalle de competición — ruta /admin/competiciones/:id
// Centro de gestión de una competición: equipos, criterios de evaluación, encuestas y jurado
// Todo el contenido está aislado por competición (no se comparte entre competiciones del mismo evento)
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Plus, Trash2, ChevronRight, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

// Etiquetas y colores para los tipos de criterio en los badges
const TIPO_LABELS = { numerico: 'Numérico', radio: 'Radio', checklist: 'Checklist', comentario: 'Comentario' }
const TIPO_COLORS = { numerico: 'blue', radio: 'purple', checklist: 'green', comentario: 'yellow' }

export default function CompeticionDetalle() {
  const { id } = useParams()          // ID de la competición desde la URL
  const { user } = useAuthStore()
  const navigate = useNavigate()

  // Estado principal de la página
  const [comp, setComp] = useState(null)        // Datos de la competición (incluye evento)
  const [equipos, setEquipos] = useState([])    // Equipos con proyectos y participantes
  const [criterios, setCriterios] = useState([]) // Criterios de evaluación con sus opciones
  const [encuestas, setEncuestas] = useState([]) // Encuestas creadas para esta competición
  const [jueces, setJueces] = useState([])       // Jueces asignados a esta competición
  const [cargando, setCargando] = useState(true)

  // Control de apertura de modales
  const [modalEquipo, setModalEquipo] = useState(false)
  const [modalCriterio, setModalCriterio] = useState(false)
  const [modalJuez, setModalJuez] = useState(false)

  // Estado del formulario del modal de nuevo equipo
  const [nuevoEquipo, setNuevoEquipo] = useState({
    nombre: '', proyectoNombre: '', proyectoDesc: '',
    participantes: [{ nombre: '', correo: '' }]
  })

  // Estado del formulario del modal de nuevo criterio
  const [nuevoCriterio, setNuevoCriterio] = useState({
    titulo: '', descripcion: '', tipo: 'numerico', peso: 1.0,
    rango_min: '', rango_max: '', max_selecciones: '', ilimitado: true,
    opciones: [{ texto: '' }, { texto: '' }]
  })

  // Estado del formulario del modal de añadir juez
  const [correoJuez, setCorreoJuez] = useState('')
  const [encuestasJuez, setEncuestasJuez] = useState([])  // Encuestas opcionales a asignar al juez

  // Estados de carga individuales para cada tipo de acción
  const [guardandoEquipo, setGuardandoEquipo] = useState(false)
  const [guardandoCriterio, setGuardandoCriterio] = useState(false)
  const [guardandoJuez, setGuardandoJuez] = useState(false)

  useEffect(() => { cargarDatos() }, [id])

  // Carga la competición primero (para verificar acceso), luego el resto en paralelo
  async function cargarDatos() {
    try {
      // PASO 1: Carga la competición con su evento para verificar que el usuario es el organizador
      const { data: competicion, error: errComp } = await supabase
        .from('competicion').select('*, evento(organizador_id, nombre, id)').eq('id', id).single()
      // Control de acceso: si la competición no existe o el usuario no es el organizador → redirige
      if (errComp || !competicion || competicion.evento.organizador_id !== user.id) {
        toast.error('Sin acceso')
        return navigate('/admin')
      }
      setComp(competicion)

      // PASO 2: Carga equipos, criterios, encuestas y jueces en paralelo
      const [{ data: eqs }, { data: crits }, { data: encs }] = await Promise.all([
        // Equipos con sus proyectos y participantes para mostrar la lista completa
        supabase.from('equipo').select('*, proyecto(*), participante(*)').eq('competicion_id', id),
        // Criterios con sus opciones (para radio/checklist), ordenados por 'orden'
        supabase.from('criterio').select('*, criterio_opcion(*)').eq('competicion_id', id).order('orden'),
        // Encuestas de esta competición
        supabase.from('encuesta').select('*').eq('competicion_id', id).order('created_at'),
      ])
      setEquipos(eqs || [])
      setCriterios(crits || [])
      setEncuestas(encs || [])

      // Jueces asignados específicamente a esta competición (tabla competicion_juez)
      // Usa join con 'persona' para obtener nombre y correo del juez
      const { data: compJueces } = await supabase
        .from('competicion_juez')
        .select('persona_id, persona(nombre, correo)')
        .eq('competicion_id', id)
      setJueces(compJueces || [])
    } catch (err) {
      toast.error('Error al cargar')
    } finally {
      setCargando(false)
    }
  }

  // Crea un nuevo equipo con su proyecto y participantes
  const guardarEquipo = async () => {
    if (!nuevoEquipo.nombre.trim() || !nuevoEquipo.proyectoNombre.trim()) {
      return toast.error('Nombre del equipo y proyecto son obligatorios')
    }
    setGuardandoEquipo(true)
    try {
      // PASO 1: Crea el equipo
      const { data: eq, error: e1 } = await supabase
        .from('equipo').insert({ competicion_id: Number(id), nombre: nuevoEquipo.nombre.trim() })
        .select().single()
      if (e1) throw e1

      // PASO 2: Crea el proyecto vinculado al equipo
      const { error: e2 } = await supabase.from('proyecto').insert({
        equipo_id: eq.id,
        nombre: nuevoEquipo.proyectoNombre.trim(),
        descripcion: nuevoEquipo.proyectoDesc || null
      })
      if (e2) throw e2

      // PASO 3: Inserta los participantes que tengan nombre y correo
      const parts = nuevoEquipo.participantes.filter(p => p.nombre.trim() && p.correo.trim())
      if (parts.length > 0) {
        const { error: e3 } = await supabase.from('participante').insert(
          parts.map(p => ({ equipo_id: eq.id, nombre: p.nombre.trim(), correo: p.correo.trim() }))
        )
        if (e3) throw e3
      }

      // Recarga todos los datos para reflejar el nuevo equipo
      await cargarDatos()
      setNuevoEquipo({ nombre: '', proyectoNombre: '', proyectoDesc: '', participantes: [{ nombre: '', correo: '' }] })
      setModalEquipo(false)
      toast.success('Equipo añadido')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardandoEquipo(false)
    }
  }

  // Crea un nuevo criterio de evaluación para esta competición
  const guardarCriterio = async () => {
    if (!nuevoCriterio.titulo.trim()) return toast.error('El título es obligatorio')
    setGuardandoCriterio(true)
    try {
      // Construye el payload con los campos comunes
      const payload = {
        competicion_id: Number(id),
        titulo: nuevoCriterio.titulo.trim(),
        descripcion: nuevoCriterio.descripcion || null,
        tipo: nuevoCriterio.tipo,
        peso: parseFloat(nuevoCriterio.peso) || 1.0,
        orden: criterios.length  // Se añade al final de los criterios existentes
      }
      // Rango solo para criterios numéricos
      if (nuevoCriterio.tipo === 'numerico') {
        payload.rango_min = nuevoCriterio.rango_min !== '' ? parseFloat(nuevoCriterio.rango_min) : null
        payload.rango_max = nuevoCriterio.rango_max !== '' ? parseFloat(nuevoCriterio.rango_max) : null
      }
      // Límite de selecciones solo para checklist
      if (nuevoCriterio.tipo === 'checklist') {
        payload.max_selecciones = nuevoCriterio.ilimitado ? null : parseInt(nuevoCriterio.max_selecciones) || null
      }

      const { data: crit, error } = await supabase.from('criterio').insert(payload).select().single()
      if (error) throw error

      // Inserta las opciones para criterios radio y checklist
      if (['radio', 'checklist'].includes(nuevoCriterio.tipo)) {
        const opciones = nuevoCriterio.opciones.filter(o => o.texto.trim())
        if (opciones.length > 0) {
          const { error: e2 } = await supabase.from('criterio_opcion').insert(
            opciones.map((o, i) => ({ criterio_id: crit.id, texto: o.texto.trim(), orden: i }))
          )
          if (e2) throw e2
        }
      }

      await cargarDatos()
      setNuevoCriterio({ titulo: '', descripcion: '', tipo: 'numerico', peso: 1.0, rango_min: '', rango_max: '', max_selecciones: '', ilimitado: true, opciones: [{ texto: '' }, { texto: '' }] })
      setModalCriterio(false)
      toast.success('Criterio añadido')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardandoCriterio(false)
    }
  }

  // Añade un juez a la competición por su correo electrónico
  // Validaciones: usuario debe existir en 'persona' y no puede ser el organizador del evento
  const guardarJuez = async () => {
    if (!correoJuez.trim()) return
    setGuardandoJuez(true)
    try {
      // Busca la persona por correo en la tabla 'persona' (RLS permite ver todos los perfiles)
      const { data: persona, error: errPersona } = await supabase
        .from('persona').select('id, nombre').eq('correo', correoJuez.trim()).single()

      // Si no existe ningún usuario con ese correo, muestra error
      if (errPersona || !persona) {
        toast.error('No existe ningún usuario registrado con ese correo')
        return
      }

      // Restricción: el organizador del evento no puede ser juez de sus propias competiciones
      if (persona.id === comp.evento.organizador_id) {
        toast.error('El organizador no puede ser juez de su propia competición')
        return
      }

      // Inserta en competicion_juez — upsert para evitar duplicados sin error
      const { error: errComp } = await supabase
        .from('competicion_juez')
        .upsert({ competicion_id: Number(id), persona_id: persona.id }, { ignoreDuplicates: true })
      if (errComp) throw errComp

      // Si se seleccionaron encuestas, asigna también al juez en esas encuestas específicas
      if (encuestasJuez.length > 0) {
        const { error: errEnc } = await supabase.from('encuesta_juez').upsert(
          encuestasJuez.map(eid => ({ encuesta_id: eid, persona_id: persona.id })),
          { ignoreDuplicates: true }
        )
        if (errEnc) throw errEnc
      }

      await cargarDatos()
      setCorreoJuez('')
      setEncuestasJuez([])
      setModalJuez(false)
      toast.success('Juez añadido')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardandoJuez(false)
    }
  }

  // Elimina un juez de la competición por su persona_id
  const eliminarJuez = async (personaId) => {
    try {
      const { error } = await supabase
        .from('competicion_juez')
        .delete()
        .eq('competicion_id', Number(id))
        .eq('persona_id', personaId)
      if (error) throw error
      // Actualiza la lista local sin recargar toda la página
      setJueces(jueces.filter(j => j.persona_id !== personaId))
      toast.success('Juez eliminado')
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Elimina un criterio de evaluación por su ID
  const eliminarCriterio = async (critId) => {
    try {
      const { error } = await supabase.from('criterio').delete().eq('id', critId)
      if (error) throw error
      setCriterios(criterios.filter(c => c.id !== critId))
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (cargando) return <Layout><div className="flex justify-center py-12"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb: Mis eventos → nombre del evento → nombre de la competición */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link to="/admin" className="hover:text-indigo-600">Mis eventos</Link>
          <ChevronRight size={14} />
          <Link to={`/admin/eventos/${comp?.evento_id}/editar`} className="hover:text-indigo-600">{comp?.evento?.nombre}</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium">{comp?.nombre}</span>
        </div>

        {/* SECCIÓN: EQUIPOS */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Equipos</h2>
            <Button size="sm" onClick={() => setModalEquipo(true)}>
              <Plus size={14} /> Añadir equipo
            </Button>
          </div>
          {/* Grid de tarjetas de equipos */}
          <div className="grid gap-3 sm:grid-cols-2">
            {equipos.map(eq => (
              <div key={eq.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-semibold text-gray-800">{eq.nombre}</p>
                {/* Nombre del primer proyecto del equipo (normalmente solo hay uno) */}
                {eq.proyecto?.[0] && (
                  <p className="text-sm text-indigo-600 mt-1">{eq.proyecto[0].nombre}</p>
                )}
                {/* Lista de participantes del equipo */}
                <div className="mt-2 space-y-0.5">
                  {eq.participante?.map(p => (
                    <p key={p.id} className="text-xs text-gray-500">{p.nombre} · {p.correo}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {equipos.length === 0 && <p className="text-sm text-gray-500 py-4">No hay equipos aún</p>}
        </section>

        {/* SECCIÓN: CRITERIOS DE EVALUACIÓN */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Criterios</h2>
            <Button size="sm" onClick={() => setModalCriterio(true)}>
              <Plus size={14} /> Añadir criterio
            </Button>
          </div>
          <div className="space-y-2">
            {criterios.map(c => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-800">{c.titulo}</span>
                    {/* Badge de tipo y peso del criterio */}
                    <Badge color={TIPO_COLORS[c.tipo]}>{TIPO_LABELS[c.tipo]}</Badge>
                    <Badge color="gray">peso: {c.peso}</Badge>
                  </div>
                  {c.descripcion && <p className="text-xs text-gray-500">{c.descripcion}</p>}
                  {/* Rango para criterios numéricos */}
                  {c.tipo === 'numerico' && (c.rango_min != null || c.rango_max != null) && (
                    <p className="text-xs text-gray-400 mt-1">Rango: {c.rango_min ?? '—'} – {c.rango_max ?? '—'}</p>
                  )}
                  {/* Opciones para criterios radio/checklist */}
                  {['radio', 'checklist'].includes(c.tipo) && c.criterio_opcion?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {c.criterio_opcion.map(o => o.texto).join(' / ')}
                    </p>
                  )}
                </div>
                <button onClick={() => eliminarCriterio(c.id)} className="text-red-400 hover:text-red-600 ml-3">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          {criterios.length === 0 && <p className="text-sm text-gray-500 py-4">No hay criterios aún</p>}
        </section>

        {/* SECCIÓN: ENCUESTAS */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Encuestas</h2>
            {/* Link para crear una nueva encuesta para esta competición */}
            <Link to={`/admin/competiciones/${id}/encuesta/nueva`}>
              <Button size="sm"><Plus size={14} /> Nueva encuesta</Button>
            </Link>
          </div>
          <div className="space-y-2">
            {encuestas.map(e => (
              <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{e.nombre}</p>
                  <div className="flex gap-2 mt-1">
                    {/* Estado de la encuesta: borrador/abierta/cerrada */}
                    <Badge color={e.estado === 'abierta' ? 'green' : e.estado === 'cerrada' ? 'red' : 'gray'}>
                      {e.estado}
                    </Badge>
                    {/* Tipo de votante: juez/público/ambos */}
                    <Badge color="blue">{e.tipo_votante}</Badge>
                    {/* Código de sala para el voto público */}
                    {e.codigo_sala && <Badge color="purple">Sala: {e.codigo_sala}</Badge>}
                  </div>
                </div>
                {/* Link a los resultados de la encuesta */}
                <Link to={`/admin/encuestas/${e.id}/resultados`} className="text-sm text-indigo-600 hover:underline">
                  Resultados
                </Link>
              </div>
            ))}
          </div>
          {encuestas.length === 0 && <p className="text-sm text-gray-500 py-4">No hay encuestas aún</p>}
        </section>

        {/* SECCIÓN: JURADO */}
        <section className="mt-8 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Jurado</h2>
            <Button size="sm" onClick={() => setModalJuez(true)}>
              <UserPlus size={14} /> Añadir juez
            </Button>
          </div>
          <div className="space-y-2">
            {jueces.map(j => (
              <div key={j.persona_id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  {/* Nombre del juez (desde la tabla persona via join) */}
                  <p className="font-medium text-sm text-gray-800">{j.persona?.nombre || '(sin nombre)'}</p>
                  <p className="text-xs text-gray-500">{j.persona?.correo}</p>
                </div>
                {/* Botón para eliminar al juez de esta competición */}
                <button
                  onClick={() => eliminarJuez(j.persona_id)}
                  className="text-red-400 hover:text-red-600 ml-4 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {jueces.length === 0 && (
              <p className="text-sm text-gray-500 py-4">No hay jueces asignados</p>
            )}
          </div>
        </section>
      </div>

      {/* MODAL: AÑADIR EQUIPO */}
      <Modal open={modalEquipo} onClose={() => setModalEquipo(false)} title="Añadir equipo" maxWidth="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del equipo *</label>
            <input value={nuevoEquipo.nombre} onChange={e => setNuevoEquipo({ ...nuevoEquipo, nombre: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Equipo Alpha" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del proyecto *</label>
            <input value={nuevoEquipo.proyectoNombre} onChange={e => setNuevoEquipo({ ...nuevoEquipo, proyectoNombre: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Mi proyecto" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del proyecto</label>
            <textarea rows={2} value={nuevoEquipo.proyectoDesc} onChange={e => setNuevoEquipo({ ...nuevoEquipo, proyectoDesc: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Participantes</label>
              {/* Botón para añadir filas de participantes al formulario */}
              <Button type="button" size="sm" variant="secondary" onClick={() => setNuevoEquipo({ ...nuevoEquipo, participantes: [...nuevoEquipo.participantes, { nombre: '', correo: '' }] })}>
                <Plus size={13} /> Añadir
              </Button>
            </div>
            {nuevoEquipo.participantes.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={p.nombre} onChange={e => { const ps = [...nuevoEquipo.participantes]; ps[i].nombre = e.target.value; setNuevoEquipo({ ...nuevoEquipo, participantes: ps }) }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre" />
                <input value={p.correo} onChange={e => { const ps = [...nuevoEquipo.participantes]; ps[i].correo = e.target.value; setNuevoEquipo({ ...nuevoEquipo, participantes: ps }) }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Correo" />
                {/* Botón para eliminar fila — solo si hay más de un participante */}
                {nuevoEquipo.participantes.length > 1 && (
                  <button type="button" onClick={() => setNuevoEquipo({ ...nuevoEquipo, participantes: nuevoEquipo.participantes.filter((_, j) => j !== i) })} className="text-red-400">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalEquipo(false)}>Cancelar</Button>
            <Button loading={guardandoEquipo} onClick={guardarEquipo}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: AÑADIR CRITERIO */}
      <Modal open={modalCriterio} onClose={() => setModalCriterio(false)} title="Añadir criterio" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input value={nuevoCriterio.titulo} onChange={e => setNuevoCriterio({ ...nuevoCriterio, titulo: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Innovación" />
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
          {/* Rango solo para criterios numéricos */}
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
                  <Plus size={13} /> Opción
                </Button>
              </div>
              {nuevoCriterio.opciones.map((op, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={op.texto} onChange={e => { const ops = [...nuevoCriterio.opciones]; ops[i].texto = e.target.value; setNuevoCriterio({ ...nuevoCriterio, opciones: ops }) }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={`Opción ${i + 1}`} />
                  {nuevoCriterio.opciones.length > 2 && (
                    <button type="button" onClick={() => setNuevoCriterio({ ...nuevoCriterio, opciones: nuevoCriterio.opciones.filter((_, j) => j !== i) })} className="text-red-400">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Configuración de límite de selecciones para checklist */}
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
            <Button loading={guardandoCriterio} onClick={guardarCriterio}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: AÑADIR JUEZ */}
      <Modal open={modalJuez} onClose={() => { setModalJuez(false); setCorreoJuez(''); setEncuestasJuez([]) }} title="Añadir juez">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo del juez</label>
            {/* El juez debe estar registrado previamente en el sistema */}
            <input type="email" value={correoJuez} onChange={e => setCorreoJuez(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="juez@ejemplo.com" />
          </div>
          {/* Selector opcional de encuestas — solo visible si la competición ya tiene encuestas */}
          {encuestas.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Asignar a encuestas (opcional)</label>
              {encuestas.map(e => (
                <label key={e.id} className="flex items-center gap-2 text-sm mb-1 cursor-pointer">
                  <input type="checkbox" checked={encuestasJuez.includes(e.id)}
                    onChange={ev => setEncuestasJuez(ev.target.checked ? [...encuestasJuez, e.id] : encuestasJuez.filter(x => x !== e.id))} />
                  {e.nombre}
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setModalJuez(false); setCorreoJuez(''); setEncuestasJuez([]) }}>Cancelar</Button>
            <Button loading={guardandoJuez} onClick={guardarJuez}>Añadir</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
