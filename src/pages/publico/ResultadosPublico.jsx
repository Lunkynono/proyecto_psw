// Imports de React: estado, efecto y useCallback para memorizar la función de cálculo
import { useEffect, useState, useCallback } from 'react'
// Parámetros de URL y enlace declarativo
import { useParams, Link } from 'react-router-dom'
// Iconos: gráfico de tendencia, usuarios conectados e indicador WiFi de conexión realtime
import { TrendingUp, Users, Wifi } from 'lucide-react'
// Cliente de Supabase para consultas y suscripción Realtime
import { supabase } from '../../lib/supabase'
// Spinner de carga mientras se obtienen los resultados iniciales
import Spinner from '../../components/ui/Spinner'

// Página de resultados en tiempo real: muestra el ranking de proyectos actualizado automáticamente
export default function ResultadosPublico() {
  // Código de sala extraído de la URL, ej: /sala/ABC123/resultados
  const { codigo } = useParams()
  // Datos de la encuesta activa (nombre, estado, competición, evento)
  const [encuesta, setEncuesta] = useState(null)
  // Ranking ordenado de proyectos con su puntaje y número de votos
  const [ranking, setRanking] = useState([])
  // Controla si se están cargando los datos iniciales
  const [cargando, setCargando] = useState(true)
  // Indica si la suscripción Realtime está activa (conectado = true)
  const [conectado, setConectado] = useState(false)
  // Suma total de votos emitidos (público + jurado) para mostrar en la cabecera
  const [totalVotos, setTotalVotos] = useState(0)

  // Calcula el ranking de proyectos combinando votos del público y del jurado
  // Se memoriza con useCallback para usarlo como dependencia estable en useEffect
  const calcularRanking = useCallback(async (encuestaId, competicionId) => {
    // Consulta la tabla 'equipo' para obtener todos los proyectos de la competición
    const { data: equipos } = await supabase
      .from('equipo')
      .select('proyecto(*)')
      .eq('competicion_id', competicionId)

    // Aplanamos el array de equipos para obtener directamente la lista de proyectos
    const proyectos = (equipos || []).flatMap(eq => eq.proyecto || [])
    if (proyectos.length === 0) return []

    // Consulta 'encuesta_criterio' para obtener solo los criterios numéricos de esta encuesta
    // Solo los numéricos se usan para calcular puntaje ponderado
    const { data: encCrits } = await supabase
      .from('encuesta_criterio')
      .select('criterio(id, peso, tipo)')
      .eq('encuesta_id', encuestaId)

    // Filtramos solo los criterios de tipo 'numerico' ya que son los que tienen peso
    const criteriosNum = (encCrits || [])
      .map(ec => ec.criterio)
      .filter(c => c?.tipo === 'numerico')
    // Calculamos la suma total de pesos para normalizar el puntaje final
    const sumaPesos = criteriosNum.reduce((s, c) => s + parseFloat(c.peso), 0)

    // Contar votos y calcular puntajes por proyecto (público + juez)
    // Para cada proyecto calculamos su puntaje ponderado y número total de votos
    const resultados = await Promise.all(proyectos.map(async (p) => {
      // Contamos en paralelo los votos públicos y de jurado para este proyecto
      const [{ count: cPub }, { count: cJuez }] = await Promise.all([
        // Cuenta votos del público en 'voto_publico' para este proyecto y encuesta
        supabase.from('voto_publico').select('*', { count: 'exact', head: true })
          .eq('encuesta_id', encuestaId).eq('proyecto_id', p.id),
        // Cuenta votos del jurado en 'voto' para este proyecto y encuesta
        supabase.from('voto').select('*', { count: 'exact', head: true })
          .eq('encuesta_id', encuestaId).eq('proyecto_id', p.id)
      ])
      // Sumamos ambos conteos para obtener el total de votos del proyecto
      const votos = (cPub || 0) + (cJuez || 0)

      let puntaje = 0
      // Solo calculamos puntaje ponderado si hay criterios numéricos con peso definido
      if (criteriosNum.length > 0 && sumaPesos > 0) {
        // Consulta 'respuesta_criterio_publico' para obtener las respuestas numéricas del público
        // Usamos join implícito con 'voto_publico' para filtrar por encuesta y proyecto
        const { data: rPub } = await supabase
          .from('respuesta_criterio_publico')
          .select('criterio_id, valor_numerico, voto_publico!inner(encuesta_id, proyecto_id)')
          .eq('voto_publico.encuesta_id', encuestaId)
          .eq('voto_publico.proyecto_id', p.id)
          // Excluimos las filas donde valor_numerico es NULL
          .not('valor_numerico', 'is', null)

        // Consulta 'respuesta_criterio' para obtener las respuestas numéricas del jurado
        // Usamos join implícito con 'voto' para filtrar por encuesta y proyecto
        const { data: rJuez } = await supabase
          .from('respuesta_criterio')
          .select('criterio_id, valor_numerico, voto!inner(encuesta_id, proyecto_id)')
          .eq('voto.encuesta_id', encuestaId)
          .eq('voto.proyecto_id', p.id)
          // Excluimos las filas donde valor_numerico es NULL
          .not('valor_numerico', 'is', null)

        // Combinamos todas las respuestas numéricas (público + jurado) en un solo array
        const todasResp = [...(rPub || []), ...(rJuez || [])]
        let suma = 0
        // Para cada criterio numérico calculamos la media de todas las respuestas y la ponderamos
        criteriosNum.forEach(c => {
          // Filtramos las respuestas que corresponden a este criterio
          const vals = todasResp.filter(r => r.criterio_id === c.id)
          if (vals.length > 0) {
            // Calculamos la media aritmética de los valores de este criterio
            const media = vals.reduce((s, r) => s + parseFloat(r.valor_numerico), 0) / vals.length
            // Multiplicamos la media por el peso del criterio para obtener su contribución al puntaje
            suma += media * parseFloat(c.peso)
          }
        })
        // Normalizamos dividiendo entre la suma total de pesos para obtener un puntaje en la misma escala
        puntaje = suma / sumaPesos
      } else {
        // Sin criterios numéricos: usar conteo de votos como puntaje
        puntaje = votos
      }

      // Retornamos el proyecto con su puntaje calculado y número de votos
      return { id: p.id, nombre: p.nombre, descripcion: p.descripcion, votos, puntaje }
    }))

    // Ordenamos por puntaje descendente; en caso de empate, por número de votos
    resultados.sort((a, b) => b.puntaje - a.puntaje || b.votos - a.votos)
    return resultados
  }, [])

  // Inicializa la carga de datos y suscribe a cambios en tiempo real de votos
  useEffect(() => {
    // Variable para guardar la referencia al canal Realtime y poder desuscribirse al desmontar
    let channel

    async function init() {
      // Consulta 'encuesta' buscando por código de sala e incluyendo datos de competición y evento
      const { data: enc, error } = await supabase
        .from('encuesta')
        .select('id, nombre, estado, competicion(nombre, id, evento(nombre))')
        .eq('codigo_sala', codigo)
        .single()

      // Si no se encuentra la sala, mostramos el componente vacío
      if (error || !enc) {
        setCargando(false)
        return
      }

      setEncuesta(enc)

      // Calculamos el ranking inicial con los votos existentes
      const r = await calcularRanking(enc.id, enc.competicion.id)
      setRanking(r)
      // Calculamos el total de votos sumando los votos de todos los proyectos
      setTotalVotos(r.reduce((s, p) => s + p.votos, 0))
      setCargando(false)

      // Suscripción Realtime a nuevos votos (público y juez) para actualización automática
      // Creamos un canal con nombre único basado en el ID de la encuesta
      channel = supabase
        .channel(`resultados-publicos-${enc.id}`)
        // Escuchamos INSERTs en 'voto_publico' filtrados por esta encuesta
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'voto_publico',
          // Filtro server-side: solo recibimos eventos de esta encuesta específica
          filter: `encuesta_id=eq.${enc.id}`
        }, async () => {
          // Recalculamos el ranking completo cada vez que llega un nuevo voto público
          const updated = await calcularRanking(enc.id, enc.competicion.id)
          setRanking(updated)
          setTotalVotos(updated.reduce((s, p) => s + p.votos, 0))
        })
        // Escuchamos también INSERTs en 'voto' (votos del jurado) para incluirlos en el ranking
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'voto',
          // Filtro server-side: solo recibimos eventos de esta encuesta específica
          filter: `encuesta_id=eq.${enc.id}`
        }, async () => {
          // Recalculamos el ranking completo cuando un juez emite un nuevo voto
          const updated = await calcularRanking(enc.id, enc.competicion.id)
          setRanking(updated)
          setTotalVotos(updated.reduce((s, p) => s + p.votos, 0))
        })
        // Nos suscribimos al canal y actualizamos el indicador de conexión
        .subscribe((status) => {
          // 'SUBSCRIBED' indica que la conexión Realtime está activa
          setConectado(status === 'SUBSCRIBED')
        })
    }

    init()

    // Limpieza: eliminamos el canal Realtime al desmontar el componente
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [codigo, calcularRanking])

  // Calculamos el puntaje máximo del ranking para normalizar las barras de progreso
  // Math.max con fallback a 1 para evitar división por cero si no hay votos
  const maxPuntaje = Math.max(...ranking.map(p => p.puntaje), 1)

  // Pantalla de carga: fondo oscuro con spinner centrado (tema oscuro de resultados)
  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <Spinner />
    </div>
  )

  // Pantalla de error: sala no encontrada
  if (!encuesta) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <p>Sala no encontrada</p>
    </div>
  )

  // Colores para las medallas de los tres primeros puestos (oro, plata, bronce)
  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600']
  // Colores para las barras de progreso: dorado para el primero, índigo para el resto
  const barColors = ['bg-yellow-400', 'bg-indigo-400', 'bg-indigo-400', 'bg-indigo-400']

  return (
    // Tema oscuro para la pantalla de resultados en vivo
    <div className="min-h-screen bg-gray-900 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Cabecera */}
        {/* Sección superior con nombre de la encuesta, total de votos e indicador de conexión */}
        <div className="flex items-start justify-between mb-8">
          <div>
            {/* Nombre de la competición en pequeño */}
            <p className="text-indigo-400 text-sm font-semibold uppercase tracking-wide">
              {encuesta.competicion?.nombre}
            </p>
            {/* Nombre de la encuesta como título principal */}
            <h1 className="text-2xl font-bold mt-1">{encuesta.nombre}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
              {/* Contador total de votos (público + jurado) */}
              <span className="flex items-center gap-1">
                <Users size={14} />
                {totalVotos} votos
              </span>
              {/* Indicador de conexión Realtime: verde si activa, gris si reconectando */}
              <span className={`flex items-center gap-1 ${conectado ? 'text-green-400' : 'text-gray-500'}`}>
                <Wifi size={14} />
                {conectado ? 'En vivo' : 'Reconectando...'}
              </span>
            </div>
          </div>
          {/* Badge "EN VIVO" con animación de pulso para indicar actualización en tiempo real */}
          <div className="flex items-center gap-1 bg-green-900/40 border border-green-700/50 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">EN VIVO</span>
          </div>
        </div>

        {/* Ranking */}
        {/* Estado vacío si aún no hay votos registrados */}
        {ranking.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <TrendingUp size={48} className="mx-auto mb-3 opacity-30" />
            <p>Aún no hay votos registrados</p>
          </div>
        ) : (
          // Lista de tarjetas del ranking, una por proyecto, ordenadas por puntaje
          <div className="space-y-4">
            {ranking.map((proyecto, idx) => (
              // El fondo y borde de la tarjeta varía según la posición: dorado, plateado, bronce o gris
              <div
                key={proyecto.id}
                className={`rounded-xl p-5 border transition-all ${
                  idx === 0
                    ? 'bg-yellow-500/10 border-yellow-500/40'    // Primer lugar: fondo dorado
                    : idx === 1
                    ? 'bg-gray-700/30 border-gray-600/40'        // Segundo lugar: fondo plateado
                    : idx === 2
                    ? 'bg-amber-700/10 border-amber-700/30'      // Tercer lugar: fondo bronce
                    : 'bg-gray-800/40 border-gray-700/30'        // Resto: fondo gris oscuro
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* Número de posición con el color de medalla correspondiente */}
                    <span className={`text-2xl font-black ${medalColors[idx] ?? 'text-gray-500'}`}>
                      #{idx + 1}
                    </span>
                    <div>
                      {/* Nombre del proyecto */}
                      <p className="font-semibold text-white">{proyecto.nombre}</p>
                      {/* Descripción truncada a una línea si existe */}
                      {proyecto.descripcion && (
                        <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{proyecto.descripcion}</p>
                      )}
                    </div>
                  </div>
                  {/* Puntaje y número de votos a la derecha */}
                  <div className="text-right">
                    {/* Puntaje ponderado con 2 decimales */}
                    <p className="text-xl font-bold text-white">{proyecto.puntaje.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{proyecto.votos} votos</p>
                  </div>
                </div>
                {/* Barra de progreso proporcional al puntaje máximo del ranking */}
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    // Color de la barra según la posición en el ranking
                    className={`${barColors[idx] ?? 'bg-indigo-500'} h-2 rounded-full transition-all duration-700`}
                    // Ancho proporcional: el primer puesto ocupa el 100% y el resto se escala
                    style={{ width: `${(proyecto.puntaje / maxPuntaje) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nota informativa al pie de página */}
        <p className="text-center text-xs text-gray-600 mt-8">
          Los resultados se actualizan automáticamente
        </p>
      </div>
    </div>
  )
}
