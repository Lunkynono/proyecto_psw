import { supabase } from '../lib/supabase'

export const procesarEncuestasProgramadas = async (scope = {}) => {
  const ahora = new Date().toISOString()
  let procesado = false

  const { error } = await supabase.rpc('procesar_encuestas_programadas')
  if (!error) {
    procesado = true
  } else {
    console.warn('No se pudo ejecutar la funcion de encuestas programadas, usando fallback', error)
  }

  const aplicarScope = (query) => {
    if (scope.encuestaId) return query.eq('id', scope.encuestaId)
    if (scope.competicionId) return query.eq('competicion_id', scope.competicionId)
    return query
  }

  const abrirQuery = aplicarScope(
    supabase
      .from('encuesta')
      .update({ estado: 'abierta', hora_apertura: ahora })
      .eq('estado', 'programada')
      .not('hora_apertura', 'is', null)
      .lte('hora_apertura', ahora)
  )
  const { error: abrirError } = await abrirQuery

  const cerrarQuery = aplicarScope(
    supabase
      .from('encuesta')
      .update({ estado: 'cerrada', hora_cierre: ahora })
      .in('estado', ['abierta', 'programada'])
      .not('hora_cierre', 'is', null)
      .lte('hora_cierre', ahora)
  )
  const { error: cerrarError } = await cerrarQuery

  if (abrirError || cerrarError) {
    console.warn('No se pudo aplicar el fallback de encuestas programadas', abrirError || cerrarError)
  } else {
    procesado = true
  }

  return procesado
}
