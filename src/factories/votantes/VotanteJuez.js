import { VotanteBase } from './VotanteBase'

export class VotanteJuez extends VotanteBase {
  async votar({ encuestaId, proyectoId, voterHash, criterios, data, checklistSeleccionados }) {
    // Revalidar que la encuesta sigue abierta
    const { data: enc, error: encError } = await this.supabase
      .from('encuesta')
      .select('estado')
      .eq('id', encuestaId)
      .single()

    if (encError) throw encError
    if (enc?.estado !== 'abierta') {
      throw new Error('La encuesta ya no está abierta')
    }

    // Insertar voto
    const { data: voto, error: e1 } = await this.supabase
      .from('voto')
      .insert({
        encuesta_id: Number(encuestaId),
        proyecto_id: Number(proyectoId),
        voter_hash: voterHash
      })
      .select()
      .single()

    if (e1) throw e1

    // Construir respuestas según tipos de criterio
    const respuestas = criterios.map(c => {
      const resp = {
        voto_id: voto.id,
        criterio_id: c.id
      }

      if (c.tipo === 'numerico') {
        resp.valor_numerico = parseFloat(data[`criterio_${c.id}`]) || null
      } else if (c.tipo === 'radio') {
        resp.opciones_ids = data[`criterio_${c.id}`]
          ? [Number(data[`criterio_${c.id}`])]
          : null
      } else if (c.tipo === 'checklist') {
        resp.opciones_ids = checklistSeleccionados[c.id]?.length
          ? checklistSeleccionados[c.id]
          : null
      } else if (c.tipo === 'comentario') {
        resp.valor_texto = data[`criterio_${c.id}`] || null
      }

      return resp
    })

    const { error: e2 } = await this.supabase
      .from('respuesta_criterio')
      .insert(respuestas)

    if (e2) throw e2

    return voto
  }
}