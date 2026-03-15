// Utilidad para generar el voter_hash: identificador anónimo de cada voto
// Permite detectar votos duplicados sin almacenar datos personales en la tabla de votos
//
// Uso: hash = SHA-256(personaId + encuestaId)
// - Si el mismo votante intenta votar dos veces en la misma encuesta, generará
//   el mismo hash, y la restricción UNIQUE de la BD rechazará el duplicado
// - La identidad del votante no es recuperable a partir del hash (función de sentido único)

/**
 * Genera un hash SHA-256 a partir del ID del votante y el ID de la encuesta.
 * @param {string} personaId - UUID del usuario autenticado (juez) o correo del público
 * @param {number|string} encuestaId - ID de la encuesta que se está votando
 * @returns {Promise<string>} - Hash hexadecimal de 64 caracteres
 */
export async function generarVoterHash(personaId, encuestaId) {
  // Codifica la concatenación de los dos IDs a bytes UTF-8
  const data = new TextEncoder().encode(`${personaId}${encuestaId}`)

  // Calcula el hash SHA-256 usando la Web Crypto API del navegador (nativa, sin librerías)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // Convierte el ArrayBuffer resultante a un array de bytes
  const hashArray = Array.from(new Uint8Array(hashBuffer))

  // Convierte cada byte a hexadecimal de 2 dígitos y une todo en un string
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
