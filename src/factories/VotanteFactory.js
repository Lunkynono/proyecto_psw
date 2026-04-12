import { supabase } from '../lib/supabase'
import { CriterioFactory } from './criterios/CriterioFactory'

class VotanteBase {
  constructor(supabaseClient) { //Guarda cliente supabase
    this.supabase = supabaseClient
  }

  async votar() {//Lanza error si no está sobreescrito (contrato técnico, patrón)
    throw new Error('Método votar() debe implementarse en subclase')
  }
}

class VotanteJuez extends VotanteBase {//Extiende votante base e implementa votar con la lógica competa usada antes en la página
  async votar({ encuestaId, proyectoId, voterHash, criterios, data, checklistSeleccionados }) {
    // Re-validar la encuesta antes del voto
    //Consulta estado de la encuesta
    const { data: enc, error: encError } = await this.supabase
      .from('encuesta')
      .select('estado')
      .eq('id', encuestaId)
      .single()
    if (encError) throw encError
    //Lanza error si no está abierta
    if (enc?.estado !== 'abierta') throw new Error('La encuesta ya no está abierta')

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
      const criterio = CriterioFactory.crear(c)
      return criterio.construirRespuestaJuez({
        votoId: voto.id,
        data,
        checklistSeleccionados
      })
    })
    //Inserta respuestas en respuesta_criterio
    const { error: e2 } = await this.supabase.from('respuesta_criterio').insert(respuestas)
    if (e2) throw e2

    return voto
  }
}

class VotantePublico extends VotanteBase {//Similar al juez
  async votar({ encuesta, identidad, proyectos, criterios, respuestas, checklistSel }) {
    //Valida que encusta, identidad, proyectos y criterios existan
    if (!encuesta || !identidad) {
      throw new Error('No se han proporcionado datos de votación')
    }

    if (!proyectos || proyectos.length === 0) {
      throw new Error('No hay proyectos disponibles para votar')
    }

    if (!criterios || criterios.length === 0) {
      throw new Error('No hay criterios configurados para votación')
    }

    // Registrar al votante en publico_registro para evitar duplicados
    const { error: regError } = await this.supabase.from('publico_registro').insert({
      encuesta_id: encuesta.id,
      correo_votante: identidad.correo
    })
    if (regError) throw regError

    //Por cada proyecto: crea voto_publico y respuestas_criterio_publico, guarda solo respuestas con valor, filtra campos nulos
    for (const proyecto of proyectos) {
      const { data: voto, error: e1 } = await this.supabase.from('voto_publico').insert({
        encuesta_id: encuesta.id,
        proyecto_id: proyecto.id,
        correo_votante: identidad.correo
      }).select().single()
      if (e1) throw e1

      const respArray = criterios.map(c => {
        const criterio = CriterioFactory.crear(c)
        return criterio.construirRespuestaPublico({
          votoId: voto.id,
          proyectoId: proyecto.id,
          respuestas,
          checklistSel
        })
      }).filter(r => r.valor_numerico != null || r.opciones_ids != null || r.valor_texto != null)

      if (respArray.length > 0) {
        const { error: e2 } = await this.supabase.from('respuesta_criterio_publico').insert(respArray)
        if (e2) throw e2
      }
    }

    // Todo OK
    return true
  }
}

export class VotanteFactory {// aplica el patrón: tipo = 'juez' o 'publico', devuelve instancia correspondiente
  static crear(tipo, supabaseClient = supabase) {
    if (tipo === 'juez') return new VotanteJuez(supabaseClient) //supabaseClient por defecto = cliente global
    if (tipo === 'publico') return new VotantePublico(supabaseClient)
    throw new Error('Tipo de votante no válido: ' + tipo)
  }
}