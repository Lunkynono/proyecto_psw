import { CriterioBase } from './CriterioBase'

export class CriterioNumerico extends CriterioBase {
  construirRespuestaJuez({ votoId, data }) {
    return {
      voto_id: votoId,
      criterio_id: this.criterio.id,
      valor_numerico: parseFloat(data[`criterio_${this.criterio.id}`]) || null
    }
  }

  construirRespuestaPublico({ votoId, proyectoId, respuestas }) {
    const key = `${proyectoId}_${this.criterio.id}`

    return {
      voto_publico_id: votoId,
      criterio_id: this.criterio.id,
      valor_numerico:
        respuestas[key] !== undefined && respuestas[key] !== ''
          ? parseFloat(respuestas[key])
          : null
    }
  }
}