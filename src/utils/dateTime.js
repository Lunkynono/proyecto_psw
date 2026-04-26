const pad = (value) => String(value).padStart(2, '0')

export const isoToDatetimeLocal = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const nowDatetimeLocal = () => {
  const date = new Date()
  date.setSeconds(0, 0)
  date.setMinutes(date.getMinutes() + 1)
  return isoToDatetimeLocal(date.toISOString())
}

export const datetimeLocalMasMinutos = (value, minutes = 1) => {
  if (!value) return nowDatetimeLocal()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return nowDatetimeLocal()
  date.setMinutes(date.getMinutes() + minutes)
  return isoToDatetimeLocal(date.toISOString())
}

export const limitarDatetimeLocal = (value, min) => {
  if (!value) return ''
  if (!min) return value
  return value < min ? min : value
}

export const DATETIME_INPUT_CLASS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 invalid:text-gray-400 invalid:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export const datetimeLocalToIso = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const validarHorarioEncuesta = ({ apertura, cierre, editarApertura = true }) => {
  const ahora = new Date()
  const aperturaDate = apertura ? new Date(apertura) : null
  const cierreDate = cierre ? new Date(cierre) : null

  if (apertura && Number.isNaN(aperturaDate.getTime())) {
    return 'La hora de apertura no es valida.'
  }

  if (cierre && Number.isNaN(cierreDate.getTime())) {
    return 'La hora de cierre no es valida.'
  }

  if (editarApertura && aperturaDate && aperturaDate <= ahora) {
    return 'La hora de apertura debe ser futura. Dejala vacia si quieres abrir ahora.'
  }

  if (cierreDate && cierreDate <= ahora) {
    return 'La hora de cierre debe ser futura.'
  }

  if (editarApertura && aperturaDate && cierreDate && cierreDate <= aperturaDate) {
    return 'El cierre debe ser posterior a la apertura.'
  }

  return ''
}

export const formatFechaLocal = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const etiquetaApertura = (iso) => {
  if (!iso) return ''
  return new Date(iso) <= new Date() ? 'Abierta' : 'Abre'
}

export const etiquetaCierre = (iso) => {
  if (!iso) return ''
  return new Date(iso) <= new Date() ? 'Cerrada' : 'Cierra'
}
