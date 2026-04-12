import { VotanteCreator } from './VotanteCreator'
import { VotanteJuez } from '../votantes/VotanteJuez'

export class VotanteJuezCreator extends VotanteCreator {
  crear() {
    return new VotanteJuez(this.supabase)
  }
}