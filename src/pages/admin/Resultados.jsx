// Página de resultados de encuesta — ruta /admin/encuestas/:id/resultados
// Permite al admin:
// - Ver el estado de la encuesta (borrador/abierta/cerrada) y cambiarlo
// - Calcular el ranking de proyectos a partir de los votos registrados
// - Editar manualmente el puntaje de cualquier proyecto (intervención manual)
// - Ver los comentarios cualitativos agrupados por proyecto
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calculator, Edit2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

// Las dos pestañas de la página
const TABS = ['Ranking', 'Comentarios']

export default function Resultados() {
  const { id: encuestaId } = useParams()  // ID de la encuesta desde la URL
  const { user } = useAuthStore()
  const [encuesta, setEncuesta] = useState(null)
  const [resultados, setResultados] = useState([])   // Ranking calculado de proyectos
  const [comentarios, setComentarios] = useState([]) // Comentarios de público y jurado
  const [cargando, setCargando] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [tab, setTab] = useState(0)
  const [editando, setEditando] = useState(null)      // ID del resultado que se está editando manualmente
  const [valorManual, setValorManual] = useState('')  // Valor introducido manualmente
  const [estado, setEstado] = useState('')            // Estado actual de la encuesta
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  useEffect(() => { cargarDatos() }, [encuestaId])

  // Carga la encuesta, el ranking almacenado y los comentarios cualitativos
  async function cargarDatos() {
    try {
      // Trae la encuesta con su competición y evento para el breadcrumb y control de acceso
      const { data: enc, error: e1 } = await supabase
        .from('encuesta')
        .select('*, competicion(nombre, evento(organizador_id, nombre, id))')
        .eq('id', encuestaId)
        .single()
      if (e1) throw e1

      setEncuesta(enc)
      setEstado(enc.estado)

      // Trae el ranking calculado (tabla 'resultado'), ordenado por posición
      const { data: res } = await supabase
        .from('resultado')
        .select('*, proyecto(nombre, equipo(nombre))')
        .eq('encuesta_id', encuestaId)
        .order('posicion_final')

      setResultados(res || [])

      // Comentarios del público (tabla respuesta_criterio_publico con join a voto_publico)
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
    } catch (err) {
      toast.error('Error al cargar resultados')
    } finally {
      setCargando(false)
    }
  }

  // Calcula el ranking de proyectos a partir de los votos registrados
  // Fórmula: para cada proyecto, promedia los valores numéricos por criterio y los pondera
  // Almacena los resultados en la tabla 'resultado' con upsert
  const calcularResultados = async () => {
    setCalculando(true)
    try {
      // Obtiene los criterios numéricos de la encuesta con sus pesos
      const { data: encCriterios } = await supabase
        .from('encuesta_criterio')
        .select('criterio(id, peso, tipo)')
        .eq('encuesta_id', encuestaId)

      const criteriosNumericos = (encCriterios || [])
        .map(ec => ec.criterio)
        .filter(c => c.tipo === 'numerico')
      // Suma total de pesos para normalizar los puntajes
      const sumaPesos = criteriosNumericos.reduce((s, c) => s + parseFloat(c.peso), 0)

      // Obtiene todos los votos del jurado para esta encuesta con sus respuestas numéricas
      const { data: votos } = await supabase
        .from('voto')
        .select('proyecto_id, respuesta_criterio(criterio_id, valor_numerico)')
        .eq('encuesta_id', encuestaId)

      // Obtiene los votos del público para esta encuesta
      const votosPub = await supabase
        .from('voto_publico')
        .select('proyecto_id, respuesta_criterio_publico(criterio_id, valor_numerico)')
        .eq('encuesta_id', encuestaId)

      // Agrupa todas las respuestas por proyecto
      const proyectoMap = {}
      const procesarVotos = (vs, keyResp) => {
        ;(vs || []).forEach(v => {
          if (!proyectoMap[v.proyecto_id]) proyectoMap[v.proyecto_id] = []
          proyectoMap[v.proyecto_id].push(...(v[keyResp] || []))
        })
      }
      procesarVotos(votos, 'respuesta_criterio')
      procesarVotos(votosPub.data, 'respuesta_criterio_publico')

      // Calcula el puntaje ponderado para cada proyecto
      const puntajes = Object.entries(proyectoMap).map(([proyId, respuestas]) => {
        let suma = 0
        criteriosNumericos.forEach(c => {
          // Toma todas las respuestas para este criterio y proyecto
          const vals = respuestas.filter(r => r.criterio_id === c.id && r.valor_numerico != null)
          if (vals.length > 0) {
            // Media aritmética de los valores × peso del criterio
            const media = vals.reduce((s, r) => s + parseFloat(r.valor_numerico), 0) / vals.length
            suma += media * parseFloat(c.peso)
          }
        })
        // Normaliza dividiendo por la suma de pesos
        const puntaje = sumaPesos > 0 ? suma / sumaPesos : 0
        return { proyecto_id: Number(proyId), puntaje }
      })

      // Ordena de mayor a menor puntaje
      puntajes.sort((a, b) => b.puntaje - a.puntaje)

      // Guarda o actualiza los resultados en la tabla 'resultado'
      for (let i = 0; i < puntajes.length; i++) {
        await supabase.from('resultado').upsert({
          encuesta_id: Number(encuestaId),
          proyecto_id: puntajes[i].proyecto_id,
          puntaje_calculado: puntajes[i].puntaje,
          posicion_final: i + 1,               // Posición en el ranking (1 = primero)
          calculado_en: new Date().toISOString()
        }, { onConflict: 'encuesta_id,proyecto_id' })  // Actualiza si ya existe para ese proyecto
      }

      await cargarDatos()
      toast.success('Resultados calculados')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCalculando(false)
    }
  }

  // Guarda un puntaje manual para un resultado (intervención del admin)
  // El puntaje manual tiene prioridad sobre el calculado en la visualización
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

  // Cambia el estado de la encuesta: borrador → abierta → cerrada
  const cambiarEstado = async (nuevoEstado) => {
    setCambiandoEstado(true)
    try {
      const { error } = await supabase.from('encuesta').update({ estado: nuevoEstado }).eq('id', encuestaId)
      if (error) throw error
      setEstado(nuevoEstado)
      toast.success(`Encuesta ${nuevoEstado}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  if (cargando) return <Layout><div className="flex justify-center py-12"><Spinner /></div></Layout>

  // El proyecto con mayor puntaje se usa como referencia para las barras de progreso
  const maxPuntaje = Math.max(...resultados.map(r => parseFloat(r.puntaje_manual ?? r.puntaje_calculado ?? 0)), 1)

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Cabecera: nombre de la encuesta, competición, evento y controles de estado */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{encuesta?.nombre}</h1>
            <p className="text-sm text-gray-500">{encuesta?.competicion?.nombre} · {encuesta?.competicion?.evento?.nombre}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge de estado coloreado según el valor */}
            <Badge color={estado === 'abierta' ? 'green' : estado === 'cerrada' ? 'red' : 'gray'}>{estado}</Badge>
            {/* Botón para abrir la encuesta (solo visible si está en borrador) */}
            {estado === 'borrador' && (
              <Button size="sm" loading={cambiandoEstado} onClick={() => cambiarEstado('abierta')}>Abrir</Button>
            )}
            {/* Botón para cerrar la encuesta (solo visible si está abierta) */}
            {estado === 'abierta' && (
              <Button size="sm" variant="danger" loading={cambiandoEstado} onClick={() => cambiarEstado('cerrada')}>Cerrar</Button>
            )}
          </div>
        </div>

        {/* Tabs: Ranking y Comentarios */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* PESTAÑA 0: Ranking de proyectos */}
        {tab === 0 && (
          <div>
            <div className="flex justify-end mb-4">
              {/* Botón para recalcular el ranking a partir de los votos actuales */}
              <Button onClick={calcularResultados} loading={calculando}>
                <Calculator size={16} /> Calcular resultados
              </Button>
            </div>
            {resultados.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No hay resultados aún. Haz clic en "Calcular resultados".</p>
            ) : (
              <div className="space-y-3">
                {resultados.map(r => {
                  // Usa el puntaje manual si existe, si no usa el calculado
                  const puntaje = parseFloat(r.puntaje_manual ?? r.puntaje_calculado ?? 0)
                  const esManual = r.puntaje_manual != null
                  return (
                    <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {/* Número de posición en el ranking */}
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
                          {/* Modo edición de puntaje manual */}
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
                              {/* Botón para activar el modo de edición manual */}
                              <button onClick={() => { setEditando(r.id); setValorManual(r.puntaje_manual ?? '') }} className="text-gray-400 hover:text-indigo-600">
                                <Edit2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Barra de progreso proporcional al máximo puntaje */}
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

        {/* PESTAÑA 1: Comentarios cualitativos agrupados por proyecto */}
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
                        {/* Badge azul para comentarios del público, morado para los del jurado */}
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
      </div>
    </Layout>
  )
}
