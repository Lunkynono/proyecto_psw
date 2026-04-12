import { CriterioBase } from './CriterioBase'

export class CriterioChecklist extends CriterioBase {
  construirRespuestaJuez({ votoId, checklistSeleccionados }) {
    return {
      voto_id: votoId,
      criterio_id: this.criterio.id,
      opciones_ids: checklistSeleccionados[this.criterio.id]?.length
        ? checklistSeleccionados[this.criterio.id]
        : null
    }
  }

  construirRespuestaPublico({ votoId, proyectoId, checklistSel }) {
    const key = `${proyectoId}_${this.criterio.id}`

    return {
      voto_publico_id: votoId,
      criterio_id: this.criterio.id,
      opciones_ids: checklistSel[key]?.length
        ? checklistSel[key]
        : null
    }
  }
}