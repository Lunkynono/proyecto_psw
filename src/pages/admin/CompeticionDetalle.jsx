


import { useEffect, useMemo, useState } from 'react'
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
import { DATETIME_INPUT_CLASS, datetimeLocalMasMinutos, datetimeLocalToIso, etiquetaApertura, etiquetaCierre, formatFechaLocal, limitarDatetimeLocal, nowDatetimeLocal, validarHorarioEncuesta } from '../../utils/dateTime'
import { procesarEncuestasProgramadas } from '../../utils/scheduledSurveys'

// Etiquetas y colores para los tipos de criterio en los badges
const TIPO_LABELS = { numerico: 'Numerico', radio: 'Radio', checklist: 'Checklist', rubrica: 'Rubrica', comentario: 'Comentario' }
const TIPO_COLORS = { numerico: 'blue', radio: 'purple', checklist: 'green', rubrica: 'blue', comentario: 'yellow' }
const ORDEN_ESTADO_ENCUESTA = { borrador: 0, programada: 1, abierta: 2, cerrada: 3 }
const criterioInicial = {
  titulo: '', descripcion: '', tipo: 'numerico', peso: 1.0,
  rango_min: '', rango_max: '', max_selecciones: '', ilimitado: true,
  opciones: [{ texto: '', peso: 0 }, { texto: '', peso: 1 }],
  rubricaAspectos: [{ texto: 'Calidad tecnica', peso: 0.5, descriptores: {} }, { texto: 'Presentacion', peso: 0.5, descriptores: {} }]
}

export default function CompeticionDetalle() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const navigate = useNavigate()


  const [comp, setComp] = useState(null)
  const [equipos, setEquipos] = useState([])    // Equipos con proyectos y participantes
  const [criterios, setCriterios] = useState([])
  const [encuestas, setEncuestas] = useState([])
  const [jueces, setJueces] = useState([])
  const [cargando, setCargando] = useState(true)

  // Control de apertura de modales
  const [modalEquipo, setModalEquipo] = useState(false)
  const [modalEditarEquipo, setModalEditarEquipo] = useState(false)
  const [modalCriterio, setModalCriterio] = useState(false)
  const [modalJuez, setModalJuez] = useState(false)
  const [equipoEditando, setEquipoEditando] = useState(null)
  const [criterioEditando, setCriterioEditando] = useState(null)
  const [criterioConRespuestas, setCriterioConRespuestas] = useState(false)

  // Estado del formulario del modal de nuevo equipo
  const [nuevoEquipo, setNuevoEquipo] = useState({
    nombre: '', proyectoNombre: '', proyectoDesc: '',
    participantes: [{ nombre: '', correo: '', rol: '' }]
  })

  // Estado del formulario del modal de nuevo criterio
  const [nuevoCriterio, setNuevoCriterio] = useState(criterioInicial)


  const [correoJuez, setCorreoJuez] = useState('')
  const [encuestasJuez, setEncuestasJuez] = useState([])  // Encuestas opcionales a asignar al juez


  const [guardandoEquipo, setGuardandoEquipo] = useState(false)
  const [guardandoEdicionEquipo, setGuardandoEdicionEquipo] = useState(false)
  const [guardandoCriterio, setGuardandoCriterio] = useState(false)
  const [guardandoJuez, setGuardandoJuez] = useState(false)
  const [eliminandoEncuesta, setEliminandoEncuesta] = useState(null)
  const [modalAbrirEnc, setModalAbrirEnc] = useState(false)
  const [encuestaAbrirEnc, setEncuestaAbrirEnc] = useState(null)
  const [hap, setHap] = useState('')
  const [hci, setHci] = useState('')
  const [guardandoApertura, setGuardandoApertura] = useState(false)

  useEffect(() => { cargarDatos() }, [id])

  useEffect(() => {
    const interval = setInterval(async () => {
      await procesarEncuestasProgramadas({ competicionId: id })
      const { data } = await supabase.from('encuesta').select('*').eq('competicion_id', id).order('created_at')
      if (data) setEncuestas(data)
    }, 5000)
    return () => clearInterval(interval)
  }, [id])


  async function cargarDatos() {
    await procesarEncuestasProgramadas({ competicionId: id })
    try {

      const { data: competicion, error: errComp } = await supabase
        .from('competicion').select('*, evento(organizador_id, nombre, id)').eq('id', id).single()

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

        supabase.from('encuesta').select('*').eq('competicion_id', id).order('created_at'),
      ])
      setEquipos(eqs || [])
      setCriterios(crits || [])
      setEncuestas(encs || [])


      // Usa join con 'persona' para obtener nombre y correo del juez
      const { data: compJueces } = await supabase
        .from('competicion_juez')
        .select('persona_id, persona(nombre, correo)')
        .eq('competicion_id', id)
      setJueces(compJueces || [])
    } catch {
      toast.error('Error al cargar')
    } finally {
      setCargando(false)
    }
  }

  const validarEquipo = (equipo) => {
    if (!equipo.nombre.trim() || !equipo.proyectoNombre.trim()) {
      toast.error('Nombre del equipo y proyecto son obligatorios')
      return null
    }

    const parts = equipo.participantes.filter(p => p.nombre.trim() || p.correo.trim() || p.rol?.trim())
    if (parts.length === 0) {
      toast.error('Añade al menos un participante')
      return null
    }
    if (parts.some(p => !p.nombre.trim() || !p.correo.trim() || !p.rol?.trim())) {
      toast.error('Nombre, correo y rol son obligatorios para cada participante')
      return null
    }

    return parts
  }

  const abrirEditarEquipo = (equipo) => {
    setEquipoEditando({
      id: equipo.id,
      nombre: equipo.nombre || '',
      proyectoId: equipo.proyecto?.[0]?.id || null,
      proyectoNombre: equipo.proyecto?.[0]?.nombre || '',
      proyectoDesc: equipo.proyecto?.[0]?.descripcion || '',
      participantes: (equipo.participante?.length ? equipo.participante : [{ nombre: '', correo: '', rol: '' }])
        .map(p => ({ id: p.id, nombre: p.nombre || '', correo: p.correo || '', rol: p.rol || '' }))
    })
    setModalEditarEquipo(true)
  }

  const criterioATipoFormulario = (criterio) => {
    const opcionesOrdenadas = ordenarOpciones(criterio.criterio_opcion || [])
    const rubricaAspectos = criterio.tipo === 'rubrica'
      ? agruparRubrica(opcionesOrdenadas).map(g => ({
          texto: g.aspecto,
          peso: Math.max(...g.opciones.map(o => Number(o.peso) || 0)),
          descriptores: g.opciones.reduce((acc, op) => ({ ...acc, [op.nivel]: op.descriptor || '' }), {})
        }))
      : criterioInicial.rubricaAspectos

    return {
      id: criterio.id,
      titulo: criterio.titulo || '',
      descripcion: criterio.descripcion || '',
      tipo: criterio.tipo || 'numerico',
      peso: criterio.peso ?? 1.0,
      rango_min: criterio.rango_min ?? '',
      rango_max: criterio.rango_max ?? '',
      max_selecciones: criterio.max_selecciones ?? '',
      ilimitado: criterio.max_selecciones == null,
      opciones: ['radio', 'checklist'].includes(criterio.tipo)
        ? (opcionesOrdenadas.length ? opcionesOrdenadas.map(o => ({ id: o.id, texto: o.texto || '', peso: o.peso ?? 0 })) : criterioInicial.opciones)
        : criterioInicial.opciones,
      rubricaAspectos
    }
  }

  const criterioTieneRespuestas = async (criterioId) => {
    const [{ count: countJuez, error: e1 }, { count: countPublico, error: e2 }] = await Promise.all([
      supabase.from('respuesta_criterio').select('*', { count: 'exact', head: true }).eq('criterio_id', criterioId),
      supabase.from('respuesta_criterio_publico').select('*', { count: 'exact', head: true }).eq('criterio_id', criterioId)
    ])
    if (e1) throw e1
    if (e2) throw e2
    return (countJuez || 0) > 0 || (countPublico || 0) > 0
  }

  const abrirCrearCriterio = () => {
    setCriterioEditando(null)
    setCriterioConRespuestas(false)
    setNuevoCriterio(criterioInicial)
    setModalCriterio(true)
  }

  const abrirEditarCriterio = async (criterio) => {
    try {
      setCriterioEditando(criterio)
      setNuevoCriterio(criterioATipoFormulario(criterio))
      setCriterioConRespuestas(await criterioTieneRespuestas(criterio.id))
      setModalCriterio(true)
    } catch (err) {
      toast.error(err.message || 'Error al abrir criterio')
    }
  }

  // Crea un nuevo equipo con su proyecto y participantes
  const guardarEquipo = async () => {
    const parts = validarEquipo(nuevoEquipo)
    if (!parts) return
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
      if (parts.length > 0) {
        const { error: e3 } = await supabase.from('participante').insert(
          parts.map(p => ({ equipo_id: eq.id, nombre: p.nombre.trim(), correo: p.correo.trim(), rol: p.rol.trim() }))
        )
        if (e3) throw e3
      }

      // Recarga todos los datos para reflejar el nuevo equipo
      await cargarDatos()
      setNuevoEquipo({ nombre: '', proyectoNombre: '', proyectoDesc: '', participantes: [{ nombre: '', correo: '', rol: '' }] })
      setModalEquipo(false)
      toast.success('Equipo añadido')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardandoEquipo(false)
    }
  }

  const guardarEdicionEquipo = async () => {
    const parts = validarEquipo(equipoEditando)
    if (!parts) return

    setGuardandoEdicionEquipo(true)
    try {
      const { error: e1 } = await supabase
        .from('equipo')
        .update({ nombre: equipoEditando.nombre.trim() })
        .eq('id', equipoEditando.id)
      if (e1) throw e1

      if (equipoEditando.proyectoId) {
        const { error: e2 } = await supabase
          .from('proyecto')
          .update({
            nombre: equipoEditando.proyectoNombre.trim(),
            descripcion: equipoEditando.proyectoDesc || null
          })
          .eq('id', equipoEditando.proyectoId)
        if (e2) throw e2
      } else {
        const { error: e2 } = await supabase.from('proyecto').insert({
          equipo_id: equipoEditando.id,
          nombre: equipoEditando.proyectoNombre.trim(),
          descripcion: equipoEditando.proyectoDesc || null
        })
        if (e2) throw e2
      }

      const { data: actuales, error: actualesError } = await supabase
        .from('participante')
        .select('id')
        .eq('equipo_id', equipoEditando.id)
      if (actualesError) throw actualesError

      const idsConservados = new Set(parts.filter(p => p.id).map(p => p.id))
      const idsEliminar = (actuales || []).map(p => p.id).filter(pid => !idsConservados.has(pid))
      if (idsEliminar.length > 0) {
        const { error: eDel } = await supabase.from('participante').delete().in('id', idsEliminar)
        if (eDel) throw eDel
      }

      const nuevos = parts.filter(p => !p.id)
      const existentes = parts.filter(p => p.id)
      const actualizaciones = await Promise.all(existentes.map(p => supabase
        .from('participante')
        .update({ nombre: p.nombre.trim(), correo: p.correo.trim(), rol: p.rol.trim() })
        .eq('id', p.id)
      ))
      const fallo = actualizaciones.find(r => r.error)
      if (fallo) throw fallo.error

      if (nuevos.length > 0) {
        const { error: eIns } = await supabase.from('participante').insert(
          nuevos.map(p => ({ equipo_id: equipoEditando.id, nombre: p.nombre.trim(), correo: p.correo.trim(), rol: p.rol.trim() }))
        )
        if (eIns) throw eIns
      }

      await cargarDatos()
      setModalEditarEquipo(false)
      setEquipoEditando(null)
      toast.success('Equipo actualizado')
    } catch (err) {
      toast.error(err.message || 'Error al actualizar equipo')
    } finally {
      setGuardandoEdicionEquipo(false)
    }
  }

  const eliminarEquipo = async () => {
    if (!equipoEditando) return
    const ok = window.confirm(`¿Seguro que quieres eliminar "${equipoEditando.nombre}" de la competición? Esta acción no se puede deshacer.`)
    if (!ok) return

    setGuardandoEdicionEquipo(true)
    try {
      const { data: proyectosEquipo, error: proyectosError } = await supabase
        .from('proyecto')
        .select('id')
        .eq('equipo_id', equipoEditando.id)
      if (proyectosError) throw proyectosError

      const proyectoIds = (proyectosEquipo || []).map(p => p.id)
      if (proyectoIds.length > 0) {
        const [{ count: votosJuez }, { count: votosPublico }] = await Promise.all([
          supabase.from('voto').select('*', { count: 'exact', head: true }).in('proyecto_id', proyectoIds),
          supabase.from('voto_publico').select('*', { count: 'exact', head: true }).in('proyecto_id', proyectoIds)
        ])
        if ((votosJuez || 0) > 0 || (votosPublico || 0) > 0) {
          toast.error('No se puede eliminar un equipo que ya tiene votos asociados')
          return
        }
      }

      await supabase.from('encuesta_equipo').delete().eq('equipo_id', equipoEditando.id)
      const { error } = await supabase.from('equipo').delete().eq('id', equipoEditando.id)
      if (error) throw error

      await cargarDatos()
      setModalEditarEquipo(false)
      setEquipoEditando(null)
      toast.success('Equipo eliminado')
    } catch (err) {
      toast.error(err.message || 'Error al eliminar equipo')
    } finally {
      setGuardandoEdicionEquipo(false)
    }
  }


  const guardarCriterio = async () => {
    if (nuevoCriterio.id) return guardarEdicionCriterio()
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
        orden: criterios.length
      }

      if (nuevoCriterio.tipo === 'numerico') {
        payload.rango_min = nuevoCriterio.rango_min !== '' ? parseFloat(nuevoCriterio.rango_min) : null
        payload.rango_max = nuevoCriterio.rango_max !== '' ? parseFloat(nuevoCriterio.rango_max) : null
      }

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
      setNuevoCriterio(criterioInicial)
      setModalCriterio(false)
      toast.success('Criterio añadido')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardandoCriterio(false)
    }
  }

  const guardarEdicionCriterio = async () => {
    if (!nuevoCriterio.titulo.trim()) return toast.error('El título es obligatorio')
    const criterioId = criterioEditando?.id || nuevoCriterio.id
    if (!criterioId) return
    if (!criterioConRespuestas) {
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
    }

    setGuardandoCriterio(true)
    try {
      const payload = {
        titulo: nuevoCriterio.titulo.trim(),
        descripcion: nuevoCriterio.descripcion || null,
        peso: parseFloat(nuevoCriterio.peso) || 1.0
      }

      if (!criterioConRespuestas) {
        payload.tipo = nuevoCriterio.tipo
        payload.rango_min = nuevoCriterio.tipo === 'numerico' && nuevoCriterio.rango_min !== '' ? parseFloat(nuevoCriterio.rango_min) : null
        payload.rango_max = nuevoCriterio.tipo === 'numerico' && nuevoCriterio.rango_max !== '' ? parseFloat(nuevoCriterio.rango_max) : null
        payload.max_selecciones = nuevoCriterio.tipo === 'checklist'
          ? (nuevoCriterio.ilimitado ? null : parseInt(nuevoCriterio.max_selecciones) || null)
          : null
      }

      const { error } = await supabase.from('criterio').update(payload).eq('id', criterioId)
      if (error) throw error

      if (!criterioConRespuestas) {
        const { error: eDel } = await supabase.from('criterio_opcion').delete().eq('criterio_id', criterioId)
        if (eDel) throw eDel

        if (TIPOS_CON_OPCIONES.includes(nuevoCriterio.tipo)) {
          const opciones = nuevoCriterio.tipo === 'rubrica'
            ? construirOpcionesRubrica(nuevoCriterio.rubricaAspectos, nuevoCriterio.peso)
            : opcionesConTexto(nuevoCriterio.opciones)

          if (opciones.length > 0) {
            const { error: eIns } = await supabase.from('criterio_opcion').insert(
              opciones.map((o, i) => ({
                criterio_id: criterioId,
                texto: o.texto.trim(),
                aspecto: o.aspecto || null,
                nivel: o.nivel || null,
                descriptor: o.descriptor || null,
                peso: o.peso !== '' ? parseFloat(o.peso) || 0 : 0,
                orden: o.orden ?? i
              }))
            )
            if (eIns) throw eIns
          }
        }
      }

      await cargarDatos()
      setNuevoCriterio(criterioInicial)
      setCriterioEditando(null)
      setCriterioConRespuestas(false)
      setModalCriterio(false)
      toast.success('Criterio actualizado')
    } catch (err) {
      toast.error(err.message || 'Error al actualizar criterio')
    } finally {
      setGuardandoCriterio(false)
    }
  }


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


    if (persona.id === comp.evento.organizador_id) {
      toast.error('El organizador no puede ser juez de su propia competición')
      return
    }


    const { error: errComp } = await supabase
      .from('competicion_juez')
      .upsert(
        { competicion_id: Number(id), persona_id: persona.id },
        { ignoreDuplicates: true }
      )

    if (errComp) throw errComp

    let idsEncuestas = encuestasJuez



    if (idsEncuestas.length === 0) {
      const { data: encuestasComp, error: errEncuestasComp } = await supabase
        .from('encuesta')
        .select('id')
        .eq('competicion_id', Number(id))

      if (errEncuestasComp) throw errEncuestasComp

      idsEncuestas = (encuestasComp || []).map(e => e.id)
    }


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


  const eliminarJuez = async (personaId) => {
    try {
      const { error } = await supabase
        .from('competicion_juez')
        .delete()
        .eq('competicion_id', Number(id))
        .eq('persona_id', personaId)
      if (error) throw error

      setJueces(jueces.filter(j => j.persona_id !== personaId))
      toast.success('Juez eliminado')
    } catch (err) {
      toast.error(err.message)
    }
  }


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
        supabase.from('encuesta_equipo').delete().eq('encuesta_id', encuesta.id),
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

  const abrirConHorario = async () => {
    const errorHorario = validarHorarioEncuesta({ apertura: hap, cierre: hci })
    if (errorHorario) {
      toast.error(errorHorario)
      return
    }
    setGuardandoApertura(true)
    try {
      const horaAperturaIso = datetimeLocalToIso(hap)
      const horaCierreIso = datetimeLocalToIso(hci)
      const aperturaFutura = horaAperturaIso && new Date(horaAperturaIso) > new Date()
      const payload = aperturaFutura
        ? { estado: 'programada', hora_apertura: horaAperturaIso, hora_cierre: horaCierreIso }
        : { estado: 'abierta', hora_apertura: new Date().toISOString(), hora_cierre: horaCierreIso }
      const { error } = await supabase.from('encuesta').update(payload).eq('id', encuestaAbrirEnc.id)
      if (error) throw error
      setEncuestas(prev => prev.map(e => e.id === encuestaAbrirEnc.id ? { ...e, ...payload } : e))
      setModalAbrirEnc(false)
      toast.success(payload.estado === 'programada' ? 'Encuesta programada' : 'Encuesta abierta')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardandoApertura(false)
    }
  }

  const errorHorarioAbrir = validarHorarioEncuesta({ apertura: hap, cierre: hci })
  const encuestasOrdenadas = useMemo(() => {
    return [...encuestas].sort((a, b) => {
      const estadoA = ORDEN_ESTADO_ENCUESTA[a.estado] ?? 99
      const estadoB = ORDEN_ESTADO_ENCUESTA[b.estado] ?? 99
      if (estadoA !== estadoB) return estadoA - estadoB

      const fechaA = a.hora_cierre || a.hora_apertura || a.created_at
      const fechaB = b.hora_cierre || b.hora_apertura || b.created_at
      return (fechaA ? new Date(fechaA).getTime() : Number.POSITIVE_INFINITY) -
        (fechaB ? new Date(fechaB).getTime() : Number.POSITIVE_INFINITY)
    })
  }, [encuestas])

  const cerrarEncuesta = async (encuestaId) => {
    const enc = encuestas.find(e => e.id === encuestaId)
    if (enc?.hora_cierre && new Date(enc.hora_cierre) > new Date()) {
      const ok = window.confirm('Esta encuesta tiene un cierre automático programado. ¿Cerrarla ahora de todas formas?')
      if (!ok) return
    }
    try {
      const cierreReal = new Date().toISOString()
      const { error } = await supabase.from('encuesta').update({ estado: 'cerrada', hora_cierre: cierreReal }).eq('id', encuestaId)
      if (error) throw error
      setEncuestas(prev => prev.map(e => e.id === encuestaId ? { ...e, estado: 'cerrada', hora_cierre: cierreReal } : e))
      toast.success('Encuesta cerrada')
    } catch (err) {
      toast.error(err.message)
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


    const { count: countPublico, error: e2 } = await supabase
      .from('respuesta_criterio_publico')
      .select('*', { count: 'exact', head: true })
      .eq('criterio_id', critId)

    if (e2) throw e2


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

        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link to="/admin" className="hover:text-indigo-600">Mis eventos</Link>
          <ChevronRight size={14} />
          <Link to={`/admin/eventos/${comp?.evento_id}/editar`} className="hover:text-indigo-600">{comp?.evento?.nombre}</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium">{comp?.nombre}</span>
        </div>


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
              <button key={eq.id} type="button" onClick={() => abrirEditarEquipo(eq)}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                <p className="font-semibold text-gray-800">{eq.nombre}</p>
                {/* Nombre del primer proyecto del equipo (normalmente solo hay uno) */}
                {eq.proyecto?.[0] && (
                  <p className="text-sm text-indigo-600 mt-1">{eq.proyecto[0].nombre}</p>
                )}
                {/* Lista de participantes del equipo */}
                <div className="mt-2 space-y-0.5">
                  {eq.participante?.map(p => (
                    <p key={p.id} className="text-xs text-gray-500">
                      {p.nombre} - {p.correo}{p.rol ? ` - ${p.rol}` : ''}
                    </p>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {equipos.length === 0 && <p className="text-sm text-gray-500 py-4">No hay equipos aún</p>}
        </section>


        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Criterios</h2>
            <Button size="sm" onClick={abrirCrearCriterio}>
              <Plus size={14} /> Añadir criterio
            </Button>
          </div>
          <div className="space-y-2">
            {criterios.map(c => (
              <div key={c.id} role="button" tabIndex={0} onClick={() => abrirEditarCriterio(c)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') abrirEditarCriterio(c) }} className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-800">{c.titulo}</span>
                    {/* Badge de tipo y peso del criterio */}
                    <Badge color={TIPO_COLORS[c.tipo]}>{TIPO_LABELS[c.tipo]}</Badge>
                    <Badge color="gray">peso: {c.peso}</Badge>
                  </div>
                  {c.tipo === 'numerico' && (c.rango_min != null || c.rango_max != null) && (
                    <p className="text-xs text-gray-400 mt-1">Rango: {c.rango_min ?? '-'} - {c.rango_max ?? '-'}</p>
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
                <button type="button" onClick={(e) => { e.stopPropagation(); eliminarCriterio(c.id) }} className="text-red-400 hover:text-red-600 ml-3">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          {criterios.length === 0 && <p className="text-sm text-gray-500 py-4">No hay criterios aún</p>}
        </section>


        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Encuestas</h2>

            <Link to={`/admin/competiciones/${id}/encuesta/nueva`}>
              <Button size="sm"><Plus size={14} /> Nueva encuesta</Button>
            </Link>
          </div>
          <div className="space-y-2">
            {encuestasOrdenadas.map(e => (
              <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{e.nombre}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge color={e.estado === 'abierta' ? 'green' : e.estado === 'cerrada' ? 'red' : e.estado === 'programada' ? 'yellow' : 'gray'}>
                        {e.estado}
                      </Badge>
                      <Badge color="blue">{e.tipo_votante}</Badge>
                      {e.codigo_sala && <Badge color="purple">Sala: {e.codigo_sala}</Badge>}
                    </div>
                    {(e.hora_reapertura || e.hora_apertura || e.hora_cierre) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {e.hora_reapertura ? <span>Reabierta: {formatFechaLocal(e.hora_reapertura)}</span> : e.hora_apertura && <span>{etiquetaApertura(e.hora_apertura)}: {formatFechaLocal(e.hora_apertura)}</span>}
                        {(e.hora_reapertura || e.hora_apertura) && e.hora_cierre && <span> - </span>}
                        {e.hora_cierre && <span>{etiquetaCierre(e.hora_cierre)}: {formatFechaLocal(e.hora_cierre)}</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {e.estado === 'borrador' && (
                      <button type="button"
                        onClick={() => { setEncuestaAbrirEnc(e); setHap(''); setHci(''); setModalAbrirEnc(true) }}
                        className="text-sm font-medium text-green-600 hover:text-green-800">
                        Abrir
                      </button>
                    )}
                    {e.estado === 'abierta' && (
                      <button type="button" onClick={() => cerrarEncuesta(e.id)}
                        className="text-sm font-medium text-red-500 hover:text-red-700">
                        Cerrar
                      </button>
                    )}
                    <Link to={`/admin/encuestas/${e.id}/resultados`}
                      className="text-sm text-indigo-600 hover:underline whitespace-nowrap">
                      Detalles
                    </Link>
                    {e.estado === 'cerrada' && (
                      <button type="button" onClick={() => eliminarEncuestaCerrada(e)}
                        disabled={eliminandoEncuesta === e.id}
                        className="text-red-400 hover:text-red-600 disabled:opacity-50"
                        title="Eliminar encuesta cerrada">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {encuestas.length === 0 && <p className="text-sm text-gray-500 py-4">No hay encuestas aún</p>}
        </section>


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
              <label className="text-sm font-medium text-gray-700">Participantes *</label>

              <Button type="button" size="sm" variant="secondary" onClick={() => setNuevoEquipo({ ...nuevoEquipo, participantes: [...nuevoEquipo.participantes, { nombre: '', correo: '', rol: '' }] })}>
                <Plus size={13} /> Añadir
              </Button>
            </div>
            {nuevoEquipo.participantes.map((p, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-2">
                <input value={p.nombre} onChange={e => { const ps = [...nuevoEquipo.participantes]; ps[i].nombre = e.target.value; setNuevoEquipo({ ...nuevoEquipo, participantes: ps }) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre *" />
                <input value={p.correo} onChange={e => { const ps = [...nuevoEquipo.participantes]; ps[i].correo = e.target.value; setNuevoEquipo({ ...nuevoEquipo, participantes: ps }) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Correo *" />
                <input value={p.rol || ''} onChange={e => { const ps = [...nuevoEquipo.participantes]; ps[i].rol = e.target.value; setNuevoEquipo({ ...nuevoEquipo, participantes: ps }) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rol *" />

                {nuevoEquipo.participantes.length > 1 && (
                  <button type="button" onClick={() => setNuevoEquipo({ ...nuevoEquipo, participantes: nuevoEquipo.participantes.filter((_, j) => j !== i) })} className="text-red-400 sm:self-center">
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


      <Modal open={modalEditarEquipo} onClose={() => { setModalEditarEquipo(false); setEquipoEditando(null) }} title="Editar equipo" maxWidth="max-w-xl">
        {equipoEditando && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del equipo *</label>
              <input value={equipoEditando.nombre} onChange={e => setEquipoEditando({ ...equipoEditando, nombre: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del proyecto *</label>
              <input value={equipoEditando.proyectoNombre} onChange={e => setEquipoEditando({ ...equipoEditando, proyectoNombre: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del proyecto</label>
              <textarea rows={2} value={equipoEditando.proyectoDesc} onChange={e => setEquipoEditando({ ...equipoEditando, proyectoDesc: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Participantes *</label>
                <Button type="button" size="sm" variant="secondary" onClick={() => setEquipoEditando({ ...equipoEditando, participantes: [...equipoEditando.participantes, { nombre: '', correo: '', rol: '' }] })}>
                  <Plus size={13} /> Añadir
                </Button>
              </div>
              {equipoEditando.participantes.map((p, i) => (
                <div key={p.id || i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-2">
                  <input value={p.nombre} onChange={e => { const ps = [...equipoEditando.participantes]; ps[i].nombre = e.target.value; setEquipoEditando({ ...equipoEditando, participantes: ps }) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre *" />
                  <input value={p.correo} onChange={e => { const ps = [...equipoEditando.participantes]; ps[i].correo = e.target.value; setEquipoEditando({ ...equipoEditando, participantes: ps }) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Correo *" />
                  <input value={p.rol || ''} onChange={e => { const ps = [...equipoEditando.participantes]; ps[i].rol = e.target.value; setEquipoEditando({ ...equipoEditando, participantes: ps }) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rol *" />
                  {equipoEditando.participantes.length > 1 && (
                    <button type="button" onClick={() => setEquipoEditando({ ...equipoEditando, participantes: equipoEditando.participantes.filter((_, j) => j !== i) })} className="text-red-400 sm:self-center">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="danger" loading={guardandoEdicionEquipo} onClick={eliminarEquipo}>Eliminar equipo</Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setModalEditarEquipo(false); setEquipoEditando(null) }}>Cancelar</Button>
                <Button loading={guardandoEdicionEquipo} onClick={guardarEdicionEquipo}>Guardar cambios</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modalCriterio} onClose={() => { setModalCriterio(false); setCriterioEditando(null); setCriterioConRespuestas(false); setNuevoCriterio(criterioInicial) }} title={criterioEditando ? 'Editar criterio' : 'Añadir criterio'} maxWidth="max-w-xl">
        <div className="space-y-4">
          {criterioEditando && criterioConRespuestas && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Este criterio ya tiene respuestas. Solo se pueden editar título, descripción y peso.
            </div>
          )}
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
              <select value={nuevoCriterio.tipo} disabled={criterioEditando && criterioConRespuestas} onChange={e => setNuevoCriterio({ ...nuevoCriterio, tipo: e.target.value, opciones: reescalarPesosOpciones(nuevoCriterio.opciones, nuevoCriterio.peso), rubricaAspectos: reescalarPesosOpciones(nuevoCriterio.rubricaAspectos, nuevoCriterio.peso) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
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

          {nuevoCriterio.tipo === 'numerico' && !criterioConRespuestas && (
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
          {nuevoCriterio.tipo === 'rubrica' && !criterioConRespuestas && (
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
          {['radio', 'checklist'].includes(nuevoCriterio.tipo) && !criterioConRespuestas && (
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

          {nuevoCriterio.tipo === 'checklist' && !criterioConRespuestas && (
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
            <Button variant="secondary" onClick={() => { setModalCriterio(false); setCriterioEditando(null); setCriterioConRespuestas(false); setNuevoCriterio(criterioInicial) }}>Cancelar</Button>
            <Button loading={guardandoCriterio} onClick={nuevoCriterio.id ? guardarEdicionCriterio : guardarCriterio}>
              {nuevoCriterio.id ? 'Guardar cambios' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>



      <Modal open={modalJuez} onClose={() => { setModalJuez(false); setCorreoJuez(''); setEncuestasJuez([]) }} title="Añadir juez">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo del juez</label>
            {/* El juez debe estar registrado previamente en el sistema */}
            <input type="email" value={correoJuez} onChange={e => setCorreoJuez(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="juez@ejemplo.com" />
          </div>

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

      {/* MODAL: ABRIR ENCUESTA (horas opcionales) */}
      <Modal open={modalAbrirEnc} onClose={() => setModalAbrirEnc(false)} title="Abrir encuesta">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                Apertura
              </div>
              <input
                type="datetime-local"
                value={hap}
                min={nowDatetimeLocal()}
                onChange={e => {
                  const apertura = limitarDatetimeLocal(e.target.value, nowDatetimeLocal())
                  setHap(apertura)
                  if (hci) setHci(limitarDatetimeLocal(hci, datetimeLocalMasMinutos(apertura)))
                }}
                className={DATETIME_INPUT_CLASS}
              />
              {hap && <button onClick={() => setHap('')} className="text-xs text-gray-400 hover:text-gray-600">Quitar</button>}
            </div>
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                Cierre
              </div>
              <input
                type="datetime-local"
                value={hci}
                min={hap ? datetimeLocalMasMinutos(hap) : nowDatetimeLocal()}
                onChange={e => setHci(limitarDatetimeLocal(e.target.value, hap ? datetimeLocalMasMinutos(hap) : nowDatetimeLocal()))}
                className={DATETIME_INPUT_CLASS}
              />
              {hci && <button onClick={() => setHci('')} className="text-xs text-gray-400 hover:text-gray-600">Quitar</button>}
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Deja vacío para abrir ahora sin cierre automático.
          </p>
          {errorHorarioAbrir && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {errorHorarioAbrir}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalAbrirEnc(false)}>Cancelar</Button>
            <Button
              loading={guardandoApertura}
              onClick={abrirConHorario}
              disabled={!!errorHorarioAbrir}
            >
              {hap && new Date(hap) > new Date() ? 'Programar' : 'Abrir ahora'}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
