
// Permite al admin:
// - Ver el estado de la encuesta (borrador/abierta/cerrada) y cambiarlo
// - Calcular el ranking de proyectos a partir de los votos registrados

// - Ver los comentarios cualitativos agrupados por proyecto
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calculator, Edit2, Check, X, Clock, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import { TIPOS_PUNTUABLES, calcularPuntajePonderado } from '../../utils/scoring'
import { DATETIME_INPUT_CLASS, datetimeLocalMasMinutos, datetimeLocalToIso, etiquetaApertura, etiquetaCierre, formatFechaLocal, isoToDatetimeLocal, limitarDatetimeLocal, nowDatetimeLocal, validarHorarioEncuesta } from '../../utils/dateTime'
import { procesarEncuestasProgramadas } from '../../utils/scheduledSurveys'


const TABS = ['Ranking', 'Comentarios', 'Asignaciones']

export default function Resultados() {
  const { id: encuestaId } = useParams()  // ID de la encuesta desde la URL
  const [encuesta, setEncuesta] = useState(null)
  const [resultados, setResultados] = useState([])   // Ranking calculado de proyectos
  const [comentarios, setComentarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [tab, setTab] = useState(0)
  const [editando, setEditando] = useState(null)
  const [valorManual, setValorManual] = useState('')  // Valor introducido manualmente
  const [estado, setEstado] = useState('')            // Estado actual de la encuesta
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [modalAbrir, setModalAbrir] = useState(false)
  const [horaApertura, setHoraApertura] = useState('')
  const [horaCierre, setHoraCierre] = useState('')
  const [equiposDisponibles, setEquiposDisponibles] = useState([])
  const [juecesDisponibles, setJuecesDisponibles] = useState([])
  const [equiposAsignados, setEquiposAsignados] = useState([])
  const [juecesAsignados, setJuecesAsignados] = useState([])
  const [guardandoAsignaciones, setGuardandoAsignaciones] = useState(false)

  useEffect(() => { cargarDatos() }, [encuestaId])

  useEffect(() => {
    const interval = setInterval(async () => {
      await procesarEncuestasProgramadas({ encuestaId })
      const { data } = await supabase
        .from('encuesta')
        .select('*, competicion(nombre, evento(organizador_id, nombre, id))')
        .eq('id', encuestaId)
        .single()
      if (data) {
        setEncuesta(data)
        setEstado(data.estado)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [encuestaId])

    // Carga la encuesta, el ranking almacenado y los comentarios cualitativos
  async function cargarDatos() {
    await procesarEncuestasProgramadas({ encuestaId })
    try {

      const { data: enc, error: e1 } = await supabase
        .from('encuesta')
        .select('*, competicion(nombre, evento(organizador_id, nombre, id))')
        .eq('id', encuestaId)
        .single()
      if (e1) throw e1

      setEncuesta(enc)
      setEstado(enc.estado)

      const [{ data: equiposComp }, { data: juecesComp }, { data: equiposEnc }, { data: juecesEnc }] = await Promise.all([
        supabase.from('equipo').select('id, nombre, proyecto(id, nombre)').eq('competicion_id', enc.competicion_id),
        supabase.from('competicion_juez').select('persona_id, persona(nombre, correo)').eq('competicion_id', enc.competicion_id),
        supabase.from('encuesta_equipo').select('equipo_id').eq('encuesta_id', encuestaId),
        supabase.from('encuesta_juez').select('persona_id').eq('encuesta_id', encuestaId)
      ])
      setEquiposDisponibles(equiposComp || [])
      setJuecesDisponibles(juecesComp || [])
      setEquiposAsignados((equiposEnc || []).map(e => e.equipo_id))
      setJuecesAsignados((juecesEnc || []).map(j => j.persona_id))

      // Trae el ranking calculado (tabla 'resultado'), ordenado de mayor a menor puntaje
      const { data: res, error: resError } = await supabase
        .from('resultado')
        .select('*, proyecto(nombre, equipo(nombre))')
        .eq('encuesta_id', encuestaId)
        .order('puntaje_manual', { ascending: false, nullsFirst: false })
        .order('puntaje_calculado', { ascending: false })
        .order('posicion_final', { ascending: true })

      if (resError) throw resError

      setResultados(res || [])


      const { data: comsPub } = await supabase
        .from('respuesta_criterio_publico')
        .select('valor_texto, criterio(tipo, titulo), voto_publico!inner(encuesta_id, proyecto(nombre))')
        .eq('voto_publico.encuesta_id', encuestaId)

      // Comentarios del jurado (tabla respuesta_criterio con join a voto)
      const { data: comsJuez } = await supabase
        .from('respuesta_criterio')
        .select('valor_texto, criterio(tipo, titulo), voto!inner(encuesta_id, proyecto(nombre))')
        .eq('voto.encuesta_id', encuestaId)

      // Filtra solo los criterios de tipo comentario que tienen texto
      const pubFiltrados = (comsPub || []).filter(c => c.criterio?.tipo === 'comentario' && c.valor_texto)
      const juezFiltrados = (comsJuez || []).filter(c => c.criterio?.tipo === 'comentario' && c.valor_texto)
      // Combina comentarios de ambas fuentes con su origen etiquetado
      setComentarios([
        ...pubFiltrados.map(c => ({ ...c, origen: 'Público', proyecto: c.voto_publico?.proyecto?.nombre })),
        ...juezFiltrados.map(c => ({ ...c, origen: 'Jurado', proyecto: c.voto?.proyecto?.nombre }))
      ])
    } catch {
      toast.error('Error al cargar resultados')
    } finally {
      setCargando(false)
    }
  }

  const toggleEquipoAsignado = (equipoId) => {
    setEquiposAsignados(prev => prev.includes(equipoId) ? prev.filter(id => id !== equipoId) : [...prev, equipoId])
  }

  const toggleJuezAsignado = (personaId) => {
    setJuecesAsignados(prev => prev.includes(personaId) ? prev.filter(id => id !== personaId) : [...prev, personaId])
  }

  const asignarTodosEquipos = () => {
    setEquiposAsignados(equiposDisponibles.map(eq => eq.id))
  }

  const asignarTodosJueces = () => {
    setJuecesAsignados(juecesDisponibles.map(j => j.persona_id))
  }

  const guardarAsignaciones = async () => {
    if (equiposAsignados.length === 0) return toast.error('La encuesta debe tener al menos un equipo asignado')
    if (['juez', 'ambos'].includes(encuesta.tipo_votante) && juecesAsignados.length === 0) {
      return toast.error('La encuesta debe tener al menos un jurado asignado')
    }

    setGuardandoAsignaciones(true)
    try {
      const borrados = await Promise.all([
        supabase.from('encuesta_equipo').delete().eq('encuesta_id', encuestaId),
        supabase.from('encuesta_juez').delete().eq('encuesta_id', encuestaId)
      ])
      const falloBorrado = borrados.find(r => r.error)
      if (falloBorrado) throw falloBorrado.error

      const inserciones = []
      if (equiposAsignados.length > 0) {
        inserciones.push(supabase.from('encuesta_equipo').insert(
          equiposAsignados.map(equipo_id => ({ encuesta_id: Number(encuestaId), equipo_id }))
        ))
      }
      if (juecesAsignados.length > 0) {
        inserciones.push(supabase.from('encuesta_juez').insert(
          juecesAsignados.map(persona_id => ({ encuesta_id: Number(encuestaId), persona_id }))
        ))
      }

      const resultadosInsercion = await Promise.all(inserciones)
      const falloInsercion = resultadosInsercion.find(r => r.error)
      if (falloInsercion) throw falloInsercion.error

      toast.success('Asignaciones actualizadas')
    } catch (err) {
      toast.error(err.message || 'Error al guardar asignaciones')
    } finally {
      setGuardandoAsignaciones(false)
    }
  }

    // Calcula el ranking de proyectos a partir de los votos registrados

  // Almacena los resultados en la tabla 'resultado' con upsert
  const calcularResultados = async () => {
    setCalculando(true)
    try {

      const { data: equipos, error: equiposError } = await supabase
        .from('encuesta_equipo')
        .select('equipo(proyecto(*))')
        .eq('encuesta_id', encuestaId)

      if (equiposError) throw equiposError

      const proyectos = (equipos || []).flatMap(eq => eq.equipo?.proyecto || [])

      if (proyectos.length === 0) {
        throw new Error('No hay proyectos en esta competición')
      }


      const { data: encCriterios, error: critError } = await supabase
        .from('encuesta_criterio')
        .select('criterio(id, peso, tipo, criterio_opcion(*))')
        .eq('encuesta_id', encuestaId)

      if (critError) throw critError

      const criteriosPuntuables = (encCriterios || [])
        .map(ec => ec.criterio)
        .filter(c => TIPOS_PUNTUABLES.includes(c?.tipo))

      // Suma total de pesos para normalizar los puntajes
      const sumaPesos = criteriosPuntuables.reduce((s, c) => s + parseFloat(c.peso), 0)

      // Calcula el puntaje proyecto a proyecto
      const puntajes = await Promise.all(
        proyectos.map(async (proyecto) => {

          const [{ count: votosPublico }, { count: votosJuez }] = await Promise.all([
            supabase
              .from('voto_publico')
              .select('*', { count: 'exact', head: true })
              .eq('encuesta_id', encuestaId)
              .eq('proyecto_id', proyecto.id),

            supabase
              .from('voto')
              .select('*', { count: 'exact', head: true })
              .eq('encuesta_id', encuestaId)
              .eq('proyecto_id', proyecto.id)
          ])

          const votosTotales = (votosPublico || 0) + (votosJuez || 0)

          let puntaje = 0


          if (criteriosPuntuables.length > 0 && sumaPesos > 0) {
            const [{ data: respuestasPublico }, { data: respuestasJuez }] = await Promise.all([
              supabase
                .from('respuesta_criterio_publico')
                .select('criterio_id, valor_numerico, opciones_ids, voto_publico!inner(encuesta_id, proyecto_id)')
                .eq('voto_publico.encuesta_id', encuestaId)
                .eq('voto_publico.proyecto_id', proyecto.id),

              supabase
                .from('respuesta_criterio')
                .select('criterio_id, valor_numerico, opciones_ids, voto!inner(encuesta_id, proyecto_id)')
                .eq('voto.encuesta_id', encuestaId)
                .eq('voto.proyecto_id', proyecto.id)
            ])

            const todasLasRespuestas = [
              ...(respuestasPublico || []),
              ...(respuestasJuez || [])
            ]

            puntaje = calcularPuntajePonderado(criteriosPuntuables, todasLasRespuestas) ?? 0
          } else {

            puntaje = votosTotales
          }

          return {
            proyecto_id: proyecto.id,
            puntaje
          }
        })
      )

      // Ordena de mayor a menor puntaje
      puntajes.sort((a, b) => b.puntaje - a.puntaje)

      // Guarda o actualiza los resultados en la tabla 'resultado'
      for (let i = 0; i < puntajes.length; i++) {
        const { error } = await supabase.from('resultado').upsert({
          encuesta_id: Number(encuestaId),
          proyecto_id: puntajes[i].proyecto_id,
          puntaje_calculado: puntajes[i].puntaje,
          posicion_final: i + 1,
          calculado_en: new Date().toISOString()
        }, { onConflict: 'encuesta_id,proyecto_id' })

        if (error) throw error
      }

      await cargarDatos()
      toast.success('Resultados calculados')
    } catch (err) {
      toast.error(err.message || 'Error al calcular resultados')
    } finally {
      setCalculando(false)
    }
  }



  const guardarManual = async (resId) => {
    try {
      const { error } = await supabase.from('resultado').update({
        puntaje_manual: valorManual !== '' ? parseFloat(valorManual) : null  // null = elimina el manual
      }).eq('id', resId)
      if (error) throw error
      setEditando(null)
      await cargarDatos()
      toast.success('Puntaje manual guardado')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const cambiarEstado = async (nuevoEstado) => {
    if (nuevoEstado === 'cerrada' && encuesta?.hora_cierre && new Date(encuesta.hora_cierre) > new Date()) {
      const ok = window.confirm('Esta encuesta tiene un cierre automático programado. ¿Cerrarla ahora de todas formas?')
      if (!ok) return
    }
    setCambiandoEstado(true)
    try {
      const cambioReal = new Date().toISOString()
      const payload = nuevoEstado === 'cerrada'
        ? { estado: nuevoEstado, hora_cierre: cambioReal }
        : nuevoEstado === 'abierta'
          ? { estado: nuevoEstado, hora_apertura: cambioReal, hora_cierre: null }
          : { estado: nuevoEstado }
      const { error } = await supabase.from('encuesta').update(payload).eq('id', encuestaId)
      if (error) throw error
      setEstado(nuevoEstado)
      setEncuesta(prev => ({ ...prev, ...payload }))
      toast.success(`Encuesta ${nuevoEstado}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  const confirmarAbrir = async () => {
    const errorHorario = validarHorarioEncuesta({
      apertura: horaApertura,
      cierre: horaCierre,
      editarApertura: estado !== 'abierta'
    })
    if (errorHorario) {
      toast.error(errorHorario)
      return
    }
    setCambiandoEstado(true)
    try {
      let payload
      if (estado === 'abierta') {
        // Encuesta ya abierta: solo actualizar hora de cierre, sin tocar estado ni apertura
        payload = { hora_cierre: datetimeLocalToIso(horaCierre) }
      } else {
        const horaAperturaIso = datetimeLocalToIso(horaApertura)
        const horaCierreIso = datetimeLocalToIso(horaCierre)
        const aperturaFutura = horaAperturaIso && new Date(horaAperturaIso) > new Date()
        payload = aperturaFutura
          ? { estado: 'programada', hora_apertura: horaAperturaIso, hora_cierre: horaCierreIso }
          : { estado: 'abierta', hora_apertura: new Date().toISOString(), hora_cierre: horaCierreIso }
      }
      const { error } = await supabase.from('encuesta').update(payload).eq('id', encuestaId)
      if (error) throw error
      if (payload.estado) setEstado(payload.estado)
      setEncuesta(prev => ({ ...prev, ...payload }))
      setModalAbrir(false)
      setHoraApertura('')
      setHoraCierre('')
      toast.success(payload.estado === 'programada' ? 'Encuesta programada' : 'Guardado')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  const reabrir = async () => {
    setCambiandoEstado(true)
    try {
      const reaperturaReal = new Date().toISOString()
      const payload = { estado: 'abierta', hora_apertura: reaperturaReal, hora_reapertura: reaperturaReal, hora_cierre: null }

      if (encuesta?.hora_cierre && new Date(encuesta.hora_cierre) <= new Date()) {
        payload.hora_cierre = null
      }
      const { error } = await supabase.from('encuesta').update(payload).eq('id', encuestaId)
      if (error) throw error
      setEstado('abierta')
      setEncuesta(prev => ({ ...prev, ...payload }))
      toast.success('Encuesta reabierta')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  const abrirModalHorario = () => {

    if (estado !== 'abierta') {
      setHoraApertura(isoToDatetimeLocal(encuesta?.hora_apertura))
    } else {
      setHoraApertura('')
    }
    setHoraCierre(isoToDatetimeLocal(encuesta?.hora_cierre))
    setModalAbrir(true)
  }

  if (cargando) return <Layout><div className="flex justify-center py-12"><Spinner /></div></Layout>

  // El proyecto con mayor puntaje se usa como referencia para las barras de progreso
  const maxPuntaje = Math.max(...resultados.map(r => parseFloat(r.puntaje_manual ?? r.puntaje_calculado ?? 0)), 1)
  const errorHorarioModal = validarHorarioEncuesta({
    apertura: horaApertura,
    cierre: horaCierre,
    editarApertura: estado !== 'abierta'
  })

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">

        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{encuesta?.nombre}</h1>
            <p className="text-sm text-gray-500">{encuesta?.competicion?.nombre} - {encuesta?.competicion?.evento?.nombre}</p>
            {(encuesta?.hora_reapertura || encuesta?.hora_apertura || encuesta?.hora_cierre) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {encuesta.hora_reapertura ? <span>Reabierta: {formatFechaLocal(encuesta.hora_reapertura)}</span> : encuesta.hora_apertura && <span>{etiquetaApertura(encuesta.hora_apertura)}: {formatFechaLocal(encuesta.hora_apertura)}</span>}
                {(encuesta.hora_reapertura || encuesta.hora_apertura) && encuesta.hora_cierre && <span> · </span>}
                {encuesta.hora_cierre && <span>{etiquetaCierre(encuesta.hora_cierre)}: {formatFechaLocal(encuesta.hora_cierre)}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge color={estado === 'abierta' ? 'green' : estado === 'cerrada' ? 'red' : estado === 'programada' ? 'yellow' : 'gray'}>{estado}</Badge>
            {estado === 'borrador' && (
              <Button size="sm" onClick={abrirModalHorario}>Abrir</Button>
            )}
            {estado === 'abierta' && (<>
              <button onClick={abrirModalHorario} title="Programar cierre automático"
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 transition-colors">
                <Clock size={14} />
              </button>
              <Button size="sm" variant="danger" loading={cambiandoEstado} onClick={() => cambiarEstado('cerrada')}>Cerrar</Button>
            </>)}
            {estado === 'programada' && (
              <button onClick={abrirModalHorario}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                <Pencil size={13} /> Editar horario
              </button>
            )}
            {estado === 'cerrada' && (
              <Button size="sm" variant="secondary" loading={cambiandoEstado} onClick={reabrir}>Reabrir</Button>
            )}
          </div>
        </div>

        {tab === -1 && <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-gray-800">Asignaciones</h2>
              <p className="text-xs text-gray-500">Equipos y jurado incluidos en esta encuesta.</p>
            </div>
            <Button size="sm" loading={guardandoAsignaciones} onClick={guardarAsignaciones}>Guardar</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Equipos</p>
              <div className="space-y-1.5">
                {equiposDisponibles.map(eq => (
                  <label key={eq.id} className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={equiposAsignados.includes(eq.id)} onChange={() => toggleEquipoAsignado(eq.id)} />
                    <span>
                      {eq.nombre}
                      {eq.proyecto?.[0]?.nombre && <span className="block text-xs text-gray-400">{eq.proyecto[0].nombre}</span>}
                    </span>
                  </label>
                ))}
                {equiposDisponibles.length === 0 && <p className="text-sm text-gray-400">No hay equipos en la competición</p>}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Jurado</p>
              <div className="space-y-1.5">
                {juecesDisponibles.map(j => (
                  <label key={j.persona_id} className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={juecesAsignados.includes(j.persona_id)} onChange={() => toggleJuezAsignado(j.persona_id)} />
                    <span>
                      {j.persona?.nombre || '(sin nombre)'}
                      <span className="block text-xs text-gray-400">{j.persona?.correo}</span>
                    </span>
                  </label>
                ))}
                {juecesDisponibles.length === 0 && <p className="text-sm text-gray-400">No hay jurado asignado a la competición</p>}
              </div>
            </div>
          </div>
        </div>}

        {/* Tabs: Ranking, Comentarios y Asignaciones */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>


        {tab === 0 && (
          <div>
            <div className="flex justify-end mb-4">

              <Button onClick={calcularResultados} loading={calculando}>
                <Calculator size={16} /> Calcular resultados
              </Button>
            </div>
            {resultados.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No hay resultados aún. Haz clic en "Calcular resultados".</p>
            ) : (
              <div className="space-y-3">
                {[...resultados]
                    .sort((a, b) => {
                      const puntajeA = parseFloat(a.puntaje_manual ?? a.puntaje_calculado ?? 0)
                      const puntajeB = parseFloat(b.puntaje_manual ?? b.puntaje_calculado ?? 0)
                      return puntajeB - puntajeA
                    })
                    .map(r => {
                  // Usa el puntaje manual si existe, si no usa el calculado
                  const puntaje = parseFloat(r.puntaje_manual ?? r.puntaje_calculado ?? 0)
                  const esManual = r.puntaje_manual != null
                  return (
                    <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">

                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center">
                            {r.posicion_final}
                          </span>
                          <div>
                            <p className="font-medium text-gray-800">{r.proyecto?.nombre}</p>
                            <p className="text-xs text-gray-500">{r.proyecto?.equipo?.nombre}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Badge amarillo si el puntaje fue modificado manualmente */}
                          {esManual && <Badge color="yellow">manual</Badge>}

                          {editando === r.id ? (
                            <div className="flex items-center gap-1">
                              <input type="number" step="0.01" value={valorManual} onChange={e => setValorManual(e.target.value)}
                                className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" autoFocus />
                              <button onClick={() => guardarManual(r.id)} className="text-green-600"><Check size={16} /></button>
                              <button onClick={() => setEditando(null)} className="text-gray-400"><X size={16} /></button>
                            </div>
                          ) : (
                            <>
                              <span className="font-bold text-gray-700">{puntaje.toFixed(2)}</span>

                              <button onClick={() => { setEditando(r.id); setValorManual(r.puntaje_manual ?? '') }} className="text-gray-400 hover:text-indigo-600">
                                <Edit2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${(puntaje / maxPuntaje) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}


        {tab === 1 && (
          <div className="space-y-4">
            {comentarios.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No hay comentarios aún</p>
            ) : (
              // Agrupa los comentarios por nombre de proyecto usando reduce
              Object.entries(
                comentarios.reduce((acc, c) => {
                  const k = c.proyecto || 'Sin proyecto'
                  if (!acc[k]) acc[k] = []
                  acc[k].push(c)
                  return acc
                }, {})
              ).map(([proyecto, coms]) => (
                <div key={proyecto} className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">{proyecto}</h3>
                  <div className="space-y-2">
                    {coms.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">

                        <Badge color={c.origen === 'Público' ? 'blue' : 'purple'}>{c.origen}</Badge>
                        <p className="text-sm text-gray-600">{c.valor_texto}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Asignaciones</h2>
                <p className="text-sm text-gray-500">Elige que equipos participan y que jurados pueden votar.</p>
              </div>
              <Button size="sm" loading={guardandoAsignaciones} onClick={guardarAsignaciones}>Guardar</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Equipos</h3>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={asignarTodosEquipos} disabled={equiposDisponibles.length === 0}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-gray-300">
                      Asignar todos
                    </button>
                    <Badge color="gray">{equiposAsignados.length}/{equiposDisponibles.length}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  {equiposDisponibles.map(eq => {
                    const activo = equiposAsignados.includes(eq.id)
                    return (
                      <label key={eq.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${activo ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <input type="checkbox" className="mt-1" checked={activo} onChange={() => toggleEquipoAsignado(eq.id)} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-800">{eq.nombre}</span>
                          {eq.proyecto?.[0]?.nombre && <span className="block text-xs text-gray-500 truncate">{eq.proyecto[0].nombre}</span>}
                        </span>
                      </label>
                    )
                  })}
                  {equiposDisponibles.length === 0 && <p className="text-sm text-gray-500 py-3">No hay equipos en la competicion</p>}
                </div>
              </section>

              <section className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Jurado</h3>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={asignarTodosJueces} disabled={juecesDisponibles.length === 0}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-gray-300">
                      Asignar todos
                    </button>
                    <Badge color="gray">{juecesAsignados.length}/{juecesDisponibles.length}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  {juecesDisponibles.map(j => {
                    const activo = juecesAsignados.includes(j.persona_id)
                    return (
                      <label key={j.persona_id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${activo ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <input type="checkbox" className="mt-1" checked={activo} onChange={() => toggleJuezAsignado(j.persona_id)} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-800">{j.persona?.nombre || '(sin nombre)'}</span>
                          <span className="block text-xs text-gray-500 truncate">{j.persona?.correo}</span>
                        </span>
                      </label>
                    )
                  })}
                  {juecesDisponibles.length === 0 && <p className="text-sm text-gray-500 py-3">No hay jurado asignado a la competicion</p>}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={modalAbrir}
        onClose={() => { setModalAbrir(false); setHoraApertura(''); setHoraCierre('') }}
        title={estado === 'abierta' ? 'Cierre automático' : estado === 'programada' ? 'Editar horario' : 'Abrir encuesta'}
      >
        <div className="space-y-3">
          <div className={estado !== 'abierta' ? 'grid grid-cols-2 gap-3' : ''}>
            {estado !== 'abierta' && (
              <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  Apertura
                </div>
                <input
                  type="datetime-local"
                  value={horaApertura}
                  min={nowDatetimeLocal()}
                  onChange={e => {
                    const apertura = limitarDatetimeLocal(e.target.value, nowDatetimeLocal())
                    setHoraApertura(apertura)
                    if (horaCierre) setHoraCierre(limitarDatetimeLocal(horaCierre, datetimeLocalMasMinutos(apertura)))
                  }}
                  className={DATETIME_INPUT_CLASS}
                />
                {horaApertura && (
                  <button onClick={() => setHoraApertura('')} className="text-xs text-gray-400 hover:text-gray-600">
                    Quitar
                  </button>
                )}
              </div>
            )}
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                Cierre
              </div>
              <input
                type="datetime-local"
                value={horaCierre}
                min={horaApertura ? datetimeLocalMasMinutos(horaApertura) : nowDatetimeLocal()}
                onChange={e => setHoraCierre(limitarDatetimeLocal(e.target.value, horaApertura ? datetimeLocalMasMinutos(horaApertura) : nowDatetimeLocal()))}
                className={DATETIME_INPUT_CLASS}
              />
              {horaCierre && (
                <button onClick={() => setHoraCierre('')} className="text-xs text-gray-400 hover:text-gray-600">
                  Quitar
                </button>
              )}
            </div>
          </div>
          {estado !== 'abierta' && (
            <p className="text-xs text-gray-400">
              Deja vacío para abrir ahora sin cierre automático. Con apertura futura, queda programada hasta esa hora.
            </p>
          )}

          {errorHorarioModal && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {errorHorarioModal}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { setModalAbrir(false); setHoraApertura(''); setHoraCierre('') }}>
              Cancelar
            </Button>
            <Button
              loading={cambiandoEstado}
              onClick={confirmarAbrir}
              disabled={!!errorHorarioModal}
            >
              {estado !== 'abierta' && horaApertura && new Date(horaApertura) > new Date() ? 'Programar' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
