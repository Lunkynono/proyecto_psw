import { VotanteCreator } from './VotanteCreator'
import { VotantePublico } from '../votantes/VotantePublico'

export class VotantePublicoCreator extends VotanteCreator {
  crear() {
    return new VotantePublico(this.supabase)
  }
}