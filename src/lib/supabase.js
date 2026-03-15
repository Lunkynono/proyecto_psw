// Cliente de Supabase — instancia única compartida por toda la aplicación
// Las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
// deben estar definidas en el archivo .env (ver README para instrucciones)
import { createClient } from '@supabase/supabase-js'

// createClient inicializa el SDK con la URL del proyecto y la clave pública anónima
// Este cliente maneja auth, consultas a la base de datos y suscripciones Realtime
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,       // URL del proyecto Supabase
  import.meta.env.VITE_SUPABASE_ANON_KEY   // Clave anónima (pública, segura exponer en frontend)
)
