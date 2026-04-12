import { CriterioBase } from './CriterioBase'

export class CriterioComentario extends CriterioBase {
  construirRespuestaJuez({ votoId, data }) {
    return {
      voto_id: votoId,
      criterio_id: this.criterio.id,
      valor_texto: data[`criterio_${this.criterio.id}`] || null
    }
  }

  construirRespuestaPublico({ votoId, proyectoId, respuestas }) {
    const key = `${proyectoId}_${this.criterio.id}`

    return {
      voto_publico_id: votoId,
      criterio_id: this.criterio.id,
      valor_texto: respuestas[key]?.trim()
        ? respuestas[key].trim()
        : null
    }
  }
}