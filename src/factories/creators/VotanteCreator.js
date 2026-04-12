export class VotanteCreator {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
  }

  crear() {
    throw new Error('Método crear() debe implementarse en la subclase')
  }
}