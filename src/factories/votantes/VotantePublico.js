import { VotanteBase } from './VotanteBase'

export class VotantePublico extends VotanteBase {
  async votar({ encuesta, identidad, proyectos, criterios, respuestas, checklistSel }) {
    if (!encuesta || !identidad) {
      throw new Error('No se han proporcionado datos de votación')
    }

    if (!proyectos || proyectos.length === 0) {
      throw new Error('No hay proyectos disponibles para votar')
    }

    if (!criterios || criterios.length === 0) {
      throw new Error('No hay criterios configurados para votación')
    }

    // Registrar al votante para evitar duplicados
    const { error: regError } = await this.supabase
      .from('publico_registro')
      .insert({
        encuesta_id: encuesta.id,
        correo_votante: identidad.correo
      })

    if (regError) throw regError

    // Crear voto por cada proyecto
    for (const proyecto of proyectos) {
      const { data: voto, error: e1 } = await this.supabase
        .from('voto_publico')
        .insert({
          encuesta_id: encuesta.id,
          proyecto_id: proyecto.id,
          correo_votante: identidad.correo
        })
        .select()
        .single()

      if (e1) throw e1

      const respArray = criterios
        .map(c => {
          const resp = {
            voto_publico_id: voto.id,
            criterio_id: c.id
          }

          const key = `${proyecto.id}_${c.id}`

          if (c.tipo === 'numerico') {
            resp.valor_numerico =
              respuestas[key] !== undefined && respuestas[key] !== ''
                ? parseFloat(respuestas[key])
                : null
          } else if (c.tipo === 'radio') {
            resp.opciones_ids = respuestas[key]
              ? [Number(respuestas[key])]
              : null
          } else if (c.tipo === 'checklist') {
            resp.opciones_ids = checklistSel[key]?.length
              ? checklistSel[key]
              : null
          } else if (c.tipo === 'comentario') {
            resp.valor_texto = respuestas[key]?.trim()
              ? respuestas[key].trim()
              : null
          }

          return resp
        })
        .filter(
          r =>
            r.valor_numerico != null ||
            r.opciones_ids != null ||
            r.valor_texto != null
        )

      if (respArray.length > 0) {
        const { error: e2 } = await this.supabase
          .from('respuesta_criterio_publico')
          .insert(respArray)

        if (e2) throw e2
      }
    }

    return true
  }
}