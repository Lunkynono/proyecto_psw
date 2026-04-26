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
import { RUBRICA_NIVELES, TIPOS_CON_OPCIONES, ajustarPesoOpcion, agruparRubrica, construirOpcionesRubrica, opcionesConTexto, ordenarOpciones, pesosOpcionesValidos, reescalarPesosOpciones } from '../../utils/scoring'

// Etiquetas y colores para los tipos de criterio en los badges
const TIPO_LABELS = { numerico: 'Numerico', radio: 'Radio', checklist: 'Checklist', rubrica: 'Rubrica', comentario: 'Comentario' }
const TIPO_COLORS = { numerico: 'blue', radio: 'purple', checklist: 'green', rubrica: 'blue', comentario: 'yellow' }

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
    opciones: [{ texto: '', peso: 0 }, { texto: '', peso: 1 }],
    rubricaAspectos: [{ texto: 'Calidad tecnica', peso: 0.5, descriptores: {} }, { texto: 'Presentacion', peso: 0.5, descriptores: {} }]
  })

  // Estado del formulario del modal de añadir juez
  const [correoJuez, setCorreoJuez] = useState('')
  const [encuestasJuez, setEncuestasJuez] = useState([])  // Encuestas opcionales a asignar al juez

  // Estados de carga individuales para cada tipo de acción
  const [guardandoEquipo, setGuardandoEquipo] = useState(false)
  const [guardandoCriterio, setGuardandoCriterio] = useState(false)
  const [guardandoJuez, setGuardandoJuez] = useState(false)
  const [eliminandoEncuesta, setEliminandoEncuesta] = useState(null)

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
    if (nuevoCriterio.tipo === 'rubrica') {
      const aspectos = nuevoCriterio.rubricaAspectos.filter(a => a.texto.trim())
      if (aspectos.length === 0) return toast.error('Añade al menos un aspecto a evaluar')
    } else if (['radio', 'checklist'].includes(nuevoCriterio.tipo)) {
      const opciones = opcionesConTexto(nuevoCriterio.opciones)
      if (opciones.length < 2) return toast.error('Añade al menos dos opciones')
      if (!pesosOpcionesValidos(nuevoCriterio.peso, opciones)) {
        return toast.error(`La suma de pesos de las opciones debe ser ${nuevoCriterio.peso}`)
      }
    }
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

      // Inserta las opciones para criterios radio, checklist y rubrica
      if (TIPOS_CON_OPCIONES.includes(nuevoCriterio.tipo)) {
        const opciones = nuevoCriterio.tipo === 'rubrica'
          ? construirOpcionesRubrica(nuevoCriterio.rubricaAspectos, nuevoCriterio.peso)
          : opcionesConTexto(nuevoCriterio.opciones)
        if (opciones.length > 0) {
          const { error: e2 } = await supabase.from('criterio_opcion').insert(
            opciones.map((o, i) => ({
              criterio_id: crit.id,
              texto: o.texto.trim(),
              aspecto: o.aspecto || null,
              nivel: o.nivel || null,
              descriptor: o.descriptor || null,
              peso: o.peso !== '' ? parseFloat(o.peso) || 0 : 0,
              orden: o.orden ?? i
            }))
          )
          if (e2) throw e2
        }
      }

      await cargarDatos()
      setNuevoCriterio({ titulo: '', descripcion: '', tipo: 'numerico', peso: 1.0, rango_min: '', rango_max: '', max_selecciones: '', ilimitado: true, opciones: [{ texto: '', peso: 0 }, { texto: '', peso: 1 }], rubricaAspectos: [{ texto: 'Calidad tecnica', peso: 0.5, descriptores: {} }, { texto: 'Presentacion', peso: 0.5, descriptores: {} }] })
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
    // Busca la persona por correo en la tabla 'persona'
    const { data: persona, error: errPersona } = await supabase
      .from('persona')
      .select('id, nombre')
      .eq('correo', correoJuez.trim())
      .single()

    if (errPersona || !persona) {
      toast.error('No existe ningún usuario registrado con ese correo')
      return
    }

    // El organizador no puede ser juez de su propia competición
    if (persona.id === comp.evento.organizador_id) {
      toast.error('El organizador no puede ser juez de su propia competición')
      return
    }

    // Lo asignamos a la competición
    const { error: errComp } = await supabase
      .from('competicion_juez')
      .upsert(
        { competicion_id: Number(id), persona_id: persona.id },
        { ignoreDuplicates: true }
      )

    if (errComp) throw errComp

    let idsEncuestas = encuestasJuez

    // Si no se seleccionó ninguna encuesta manualmente,
    // lo asignamos a todas las encuestas de esta competición
    if (idsEncuestas.length === 0) {
      const { data: encuestasComp, error: errEncuestasComp } = await supabase
        .from('encuesta')
        .select('id')
        .eq('competicion_id', Number(id))

      if (errEncuestasComp) throw errEncuestasComp

      idsEncuestas = (encuestasComp || []).map(e => e.id)
    }

    // Asignación en encuesta_juez
    if (idsEncuestas.length > 0) {
      const { error: errEnc } = await supabase
        .from('encuesta_juez')
        .upsert(
          idsEncuestas.map(eid => ({
            encuesta_id: eid,
            persona_id: persona.id
          })),
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
  // Elimina una encuesta cerrada y todos sus datos asociados
  const eliminarEncuestaCerrada = async (encuesta) => {
    if (encuesta.estado !== 'cerrada') {
      toast.error('Solo se pueden eliminar encuestas cerradas')
      return
    }

    const confirmado = window.confirm(`Se eliminara la encuesta "${encuesta.nombre}" y todos sus votos. Esta accion no se puede deshacer.`)
    if (!confirmado) return

    setEliminandoEncuesta(encuesta.id)
    try {
      const { data: votosJuez, error: errVotosJuez } = await supabase
        .from('voto')
        .select('id')
        .eq('encuesta_id', encuesta.id)
      if (errVotosJuez) throw errVotosJuez

      const idsVotosJuez = (votosJuez || []).map(v => v.id)
      if (idsVotosJuez.length > 0) {
        const { error } = await supabase
          .from('respuesta_criterio')
          .delete()
          .in('voto_id', idsVotosJuez)
        if (error) throw error
      }

      const { data: votosPublico, error: errVotosPublico } = await supabase
        .from('voto_publico')
        .select('id')
        .eq('encuesta_id', encuesta.id)
      if (errVotosPublico) throw errVotosPublico

      const idsVotosPublico = (votosPublico || []).map(v => v.id)
      if (idsVotosPublico.length > 0) {
        const { error } = await supabase
          .from('respuesta_criterio_publico')
          .delete()
          .in('voto_publico_id', idsVotosPublico)
        if (error) throw error
      }

      const borrados = await Promise.all([
        supabase.from('voto').delete().eq('encuesta_id', encuesta.id),
        supabase.from('voto_publico').delete().eq('encuesta_id', encuesta.id),
        supabase.from('publico_registro').delete().eq('encuesta_id', encuesta.id),
        supabase.from('resultado').delete().eq('encuesta_id', encuesta.id),
        supabase.from('encuesta_juez').delete().eq('encuesta_id', encuesta.id),
        supabase.from('encuesta_criterio').delete().eq('encuesta_id', encuesta.id)
      ])

      const fallo = borrados.find(r => r.error)
      if (fallo) throw fallo.error

      const { error: errEncuesta } = await supabase
        .from('encuesta')
        .delete()
        .eq('id', encuesta.id)
      if (errEncuesta) throw errEncuesta

      setEncuestas(prev => prev.filter(e => e.id !== encuesta.id))
      toast.success('Encuesta eliminada')
    } catch (err) {
      toast.error(err.message || 'Error al eliminar encuesta')
    } finally {
      setEliminandoEncuesta(null)
    }
  }

  const eliminarCriterio = async (critId) => {
  try {
    // 1. Comprobar si tiene respuestas de jurado
    const { count: countJuez, error: e1 } = await supabase
      .from('respuesta_criterio')
      .select('*', { count: 'exact', head: true })
      .eq('criterio_id', critId)

    if (e1) throw e1

    // 2. Comprobar si tiene respuestas del público
    const { count: countPublico, error: e2 } = await supabase
      .from('respuesta_criterio_publico')
      .select('*', { count: 'exact', head: true })
      .eq('criterio_id', critId)

    if (e2) throw e2

    // 3. Si se está usando → no borrar
    if ((countJuez || 0) > 0 || (countPublico || 0) > 0) {
      toast.error('No se puede eliminar el criterio porque ya tiene votos asociados')
      return
    }

    // 4. Borrar relaciones (por si acaso)
    await supabase.from('encuesta_criterio').delete().eq('criterio_id', critId)
    await supabase.from('criterio_opcion').delete().eq('criterio_id', critId)

    // 5. Borrar criterio
    const { error } = await supabase
      .from('criterio')
      .delete()
      .eq('id', critId)

    if (error) throw error

    setCriterios(prev => prev.filter(c => c.id !== critId))
    toast.success('Criterio eliminado')
  } catch (err) {
    toast.error(err.message || 'Error al eliminar criterio')
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
                  {TIPOS_CON_OPCIONES.includes(c.tipo) && c.criterio_opcion?.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                      {c.tipo === 'rubrica'
                        ? agruparRubrica(c.criterio_opcion).map(g => (
                            <p key={g.aspecto}>{g.aspecto}</p>
                          ))
                        : ordenarOpciones(c.criterio_opcion).map(o => (
                            <p key={o.id}>
                              {o.texto} ({o.peso ?? 0})
                            </p>
                          ))}
                    </div>
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
                <div className="flex items-center gap-3">
                  {/* Link a los resultados de la encuesta */}
                  <Link to={`/admin/encuestas/${e.id}/resultados`} className="text-sm text-indigo-600 hover:underline">
                    Detalles
                  </Link>
                  {e.estado === 'cerrada' && (
                    <button
                      type="button"
                      onClick={() => eliminarEncuestaCerrada(e)}
                      disabled={eliminandoEncuesta === e.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-50"
                      title="Eliminar encuesta cerrada"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
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
      <Modal open={modalCriterio} onClose={() => setModalCriterio(false)} title="Añadir criterio" maxWidth="max-w-xl">
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
              <select value={nuevoCriterio.tipo} onChange={e => setNuevoCriterio({ ...nuevoCriterio, tipo: e.target.value, opciones: reescalarPesosOpciones(nuevoCriterio.opciones, nuevoCriterio.peso), rubricaAspectos: reescalarPesosOpciones(nuevoCriterio.rubricaAspectos, nuevoCriterio.peso) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="numerico">Numérico</option>
                <option value="radio">Radio</option>
                <option value="checklist">Checklist</option>
                <option value="rubrica">Rubrica</option>
                <option value="comentario">Comentario</option>
              </select>
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso</label>
              <input type="number" step="0.1" min="0.1" value={nuevoCriterio.peso}
                onChange={e => setNuevoCriterio({ ...nuevoCriterio, peso: e.target.value, opciones: reescalarPesosOpciones(nuevoCriterio.opciones, e.target.value), rubricaAspectos: reescalarPesosOpciones(nuevoCriterio.rubricaAspectos, e.target.value) })}
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
          {nuevoCriterio.tipo === 'rubrica' && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-800">Aspectos de la rubrica</label>
                <Button type="button" size="sm" variant="secondary" onClick={() => setNuevoCriterio({ ...nuevoCriterio, rubricaAspectos: reescalarPesosOpciones([...nuevoCriterio.rubricaAspectos, { texto: '', peso: 0, descriptores: {} }], nuevoCriterio.peso) })}>
                  <Plus size={13} /> Aspecto
                </Button>
              </div>
              <div className="space-y-2">
                {nuevoCriterio.rubricaAspectos.map((aspecto, i) => (
                  <div key={i} className="grid grid-cols-[1fr_6rem_auto_auto] gap-2">
                    <input value={aspecto.texto} onChange={e => { const aspectos = [...nuevoCriterio.rubricaAspectos]; aspectos[i].texto = e.target.value; setNuevoCriterio({ ...nuevoCriterio, rubricaAspectos: aspectos }) }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={`Aspecto ${i + 1}`} />
                    <input type="number" step="0.1" min="0" max={nuevoCriterio.peso} value={aspecto.peso ?? 0} onChange={e => setNuevoCriterio({ ...nuevoCriterio, rubricaAspectos: ajustarPesoOpcion(nuevoCriterio.rubricaAspectos, i, e.target.value, nuevoCriterio.peso) })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Peso" />
                    <button type="button" onClick={() => { const aspectos = [...nuevoCriterio.rubricaAspectos]; aspectos[i] = { ...aspectos[i], descriptoresAbiertos: !aspectos[i].descriptoresAbiertos }; setNuevoCriterio({ ...nuevoCriterio, rubricaAspectos: aspectos }) }} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-white">
                      Descriptores
                    </button>
                    <button type="button" onClick={() => setNuevoCriterio({ ...nuevoCriterio, rubricaAspectos: reescalarPesosOpciones(nuevoCriterio.rubricaAspectos.filter((_, j) => j !== i), nuevoCriterio.peso) })} className={`text-red-400 ${nuevoCriterio.rubricaAspectos.length <= 1 ? 'invisible' : ''}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="grid grid-cols-[1.2fr_repeat(4,1fr)] bg-gray-50 text-xs font-semibold text-gray-600">
                  <div className="px-3 py-2">Aspecto</div>
                  {RUBRICA_NIVELES.map(nivel => (
                    <div key={nivel.key} className="px-3 py-2 text-center">{nivel.label}</div>
                  ))}
                </div>
                {nuevoCriterio.rubricaAspectos.filter(a => a.texto.trim()).map((aspecto) => (
                  <div key={aspecto.texto} className="grid grid-cols-[1.2fr_repeat(4,1fr)] border-t border-gray-100 text-xs">
                    <div className="px-3 py-2 font-medium text-gray-700">{aspecto.texto}</div>
                    {RUBRICA_NIVELES.map(nivel => {
                      const aspectoIndex = nuevoCriterio.rubricaAspectos.findIndex(a => a === aspecto)
                      return (
                        <div key={nivel.key} className={`m-1 rounded-md border p-2 ${nivel.color}`}>
                          <div className="text-center font-semibold">
                            {((Number(aspecto.peso) || 0) * nivel.factor).toFixed(2)}
                          </div>
                          {aspecto.descriptoresAbiertos && (
                            <textarea
                              rows={2}
                              value={aspecto.descriptores?.[nivel.key] || ''}
                              onChange={e => {
                                const aspectos = [...nuevoCriterio.rubricaAspectos]
                                aspectos[aspectoIndex] = {
                                  ...aspectos[aspectoIndex],
                                  descriptores: {
                                    ...(aspectos[aspectoIndex].descriptores || {}),
                                    [nivel.key]: e.target.value
                                  }
                                }
                                setNuevoCriterio({ ...nuevoCriterio, rubricaAspectos: aspectos })
                              }}
                              className="mt-1 w-full resize-none rounded border border-white/70 bg-white/70 px-2 py-1 text-[11px] text-gray-700"
                              placeholder="Opcional"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opciones de texto para criterios radio y checklist */}
          {['radio', 'checklist'].includes(nuevoCriterio.tipo) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  {nuevoCriterio.tipo === 'rubrica' ? 'Niveles de rubrica' : 'Opciones'}
                </label>
                <Button type="button" size="sm" variant="secondary" onClick={() => setNuevoCriterio({ ...nuevoCriterio, opciones: [...nuevoCriterio.opciones, { texto: '', peso: 0 }] })}>
                  <Plus size={13} /> Opción
                </Button>
              </div>
              {nuevoCriterio.opciones.map((op, i) => (
                <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2 mb-2">
                  <input value={op.texto} onChange={e => { const ops = [...nuevoCriterio.opciones]; ops[i].texto = e.target.value; setNuevoCriterio({ ...nuevoCriterio, opciones: ops }) }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={`Opción ${i + 1}`} />
                  <input type="number" step="0.1" min="0" max={nuevoCriterio.peso} value={op.peso ?? 0} onChange={e => setNuevoCriterio({ ...nuevoCriterio, opciones: ajustarPesoOpcion(nuevoCriterio.opciones, i, e.target.value, nuevoCriterio.peso) })}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Peso" />
                  <button type="button" onClick={() => setNuevoCriterio({ ...nuevoCriterio, opciones: reescalarPesosOpciones(nuevoCriterio.opciones.filter((_, j) => j !== i), nuevoCriterio.peso) })} className={`text-red-400 ${nuevoCriterio.opciones.length <= 2 ? 'invisible' : ''}`}>
                    <Trash2 size={15} />
                  </button>
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
