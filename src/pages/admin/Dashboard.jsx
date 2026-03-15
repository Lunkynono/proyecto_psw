// Dashboard del administrador — ruta /admin
// Muestra la lista de eventos que el usuario autenticado ha creado como organizador
// Cada evento es un enlace que lleva a su página de edición
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Calendar, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

export default function AdminDashboard() {
  // Obtiene el usuario autenticado del store para filtrar sus eventos
  const { user } = useAuthStore()
  const [eventos, setEventos] = useState([])
  const [cargando, setCargando] = useState(true)

  // Carga los eventos al montar el componente o cuando cambia el usuario
  useEffect(() => {
    cargarEventos()
  }, [user])

  // Consulta la tabla 'evento' filtrando por el organizador actual
  // También trae el conteo de competiciones de cada evento (para mostrarlo en la tarjeta)
  async function cargarEventos() {
    try {
      const { data, error } = await supabase
        .from('evento')
        .select('*, competicion(count)')          // Incluye conteo de competiciones relacionadas
        .eq('organizador_id', user.id)            // Solo los eventos del admin actual
        .order('created_at', { ascending: false }) // Los más recientes primero
      if (error) throw error
      setEventos(data || [])
    } catch (err) {
      toast.error('Error al cargar eventos')
    } finally {
      setCargando(false)
    }
  }

  return (
    <Layout>
      {/* Cabecera con título y botón para crear nuevo evento */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis eventos</h1>
        <Link to="/admin/eventos/nuevo">
          <Button>
            <Plus size={16} />
            Nuevo evento
          </Button>
        </Link>
      </div>

      {/* Estado de carga */}
      {cargando ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : eventos.length === 0 ? (
        // Estado vacío: primer uso, sin eventos creados
        <div className="text-center py-16 text-gray-500">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tienes eventos aún</p>
          <p className="text-sm mt-1">Crea tu primer evento para empezar</p>
        </div>
      ) : (
        // Grid de tarjetas de eventos — 1 columna en móvil, 2 en tablet, 3 en escritorio
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map(evento => (
            // Cada tarjeta es un link a la edición del evento
            <Link
              key={evento.id}
              to={`/admin/eventos/${evento.id}/editar`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <h2 className="font-semibold text-gray-900 mb-2">{evento.nombre}</h2>
              {/* Lugar del evento (opcional) */}
              {evento.lugar && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mb-1">
                  <MapPin size={14} />
                  {evento.lugar}
                </p>
              )}
              {/* Descripción recortada a 2 líneas */}
              {evento.descripcion && (
                <p className="text-sm text-gray-500 line-clamp-2 mt-2">{evento.descripcion}</p>
              )}
              {/* Fecha de creación formateada en español */}
              <p className="text-xs text-gray-400 mt-3">
                {new Date(evento.created_at).toLocaleDateString('es-ES')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  )
}
