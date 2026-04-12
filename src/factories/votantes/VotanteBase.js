export class VotanteBase {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
  }

  async votar() {
    throw new Error('Método votar() debe implementarse en la subclase')
  }
}