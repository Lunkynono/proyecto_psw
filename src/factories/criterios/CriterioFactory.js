import { CriterioNumerico } from './CriterioNumerico'
import { CriterioRadio } from './CriterioRadio'
import { CriterioChecklist } from './CriterioChecklist'
import { CriterioComentario } from './CriterioComentario'

export class CriterioFactory {
  static crear(criterio) {
    if (criterio.tipo === 'numerico') return new CriterioNumerico(criterio)
    if (criterio.tipo === 'radio' || criterio.tipo === 'rubrica') return new CriterioRadio(criterio)
    if (criterio.tipo === 'checklist') return new CriterioChecklist(criterio)
    if (criterio.tipo === 'comentario') return new CriterioComentario(criterio)

    throw new Error('Tipo de criterio no válido: ' + criterio.tipo)
  }
}
