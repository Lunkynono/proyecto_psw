// Store global de autenticación usando Zustand
// Mantiene el estado del usuario autenticado accesible desde cualquier componente
// sin necesidad de pasar props manualmente
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  // user: objeto del usuario autenticado de Supabase Auth (contiene id, email, etc.)
  // null si no hay sesión activa
  user: null,

  // perfil: fila de la tabla 'persona' del usuario (contiene nombre, correo)
  // Se carga por separado tras confirmar la sesión
  perfil: null,

  // loading: true mientras se verifica si hay una sesión activa al arrancar la app
  // Evita redirigir al login antes de que Supabase confirme el estado de auth
  loading: true,

  // Actualiza el usuario en el store (llamado desde App.jsx al inicializar auth)
  setUser: (user) => set({ user }),

  // Actualiza el perfil extendido del usuario (nombre, correo desde tabla 'persona')
  setPerfil: (perfil) => set({ perfil }),

  // Actualiza el estado de carga (se pone a false cuando Supabase confirma la sesión)
  setLoading: (loading) => set({ loading }),

  // Cierra sesión: llama a Supabase Auth signOut y limpia el store
  logout: async () => {
    await supabase.auth.signOut()   // Invalida el token en Supabase
    set({ user: null, perfil: null }) // Limpia el estado local
  }
}))
