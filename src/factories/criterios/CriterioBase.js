export class CriterioBase {
  constructor(criterio) {
    this.criterio = criterio
  }

  construirRespuestaJuez() {
    throw new Error('Método construirRespuestaJuez() debe implementarse en subclase')
  }

  construirRespuestaPublico() {
    throw new Error('Método construirRespuestaPublico() debe implementarse en subclase')
  }
}