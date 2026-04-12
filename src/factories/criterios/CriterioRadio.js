import { CriterioBase } from './CriterioBase'

export class CriterioRadio extends CriterioBase {
  construirRespuestaJuez({ votoId, data }) {
    return {
      voto_id: votoId,
      criterio_id: this.criterio.id,
      opciones_ids: data[`criterio_${this.criterio.id}`]
        ? [Number(data[`criterio_${this.criterio.id}`])]
        : null
    }
  }

  construirRespuestaPublico({ votoId, proyectoId, respuestas }) {
    const key = `${proyectoId}_${this.criterio.id}`

    return {
      voto_publico_id: votoId,
      criterio_id: this.criterio.id,
      opciones_ids: respuestas[key] ? [Number(respuestas[key])] : null
    }
  }
}