// Página de creación de evento — ruta /admin/eventos/nuevo
// Permite al admin crear un nuevo evento con nombre, lugar, descripción
// y opcionalmente añadir competiciones directamente en el mismo formulario
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function EventoCrear() {
  // Obtiene el usuario para asignarlo como organizador del evento
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [guardando, setGuardando] = useState(false)
  // Lista de competiciones a crear junto con el evento (al menos una vacía por defecto)
  const [competiciones, setCompeticiones] = useState([{ nombre: '', descripcion: '' }])

  const { register, handleSubmit, formState: { errors } } = useForm()

  // Añade una nueva fila vacía al array de competiciones
  const agregarCompeticion = () => {
    setCompeticiones([...competiciones, { nombre: '', descripcion: '' }])
  }

  // Elimina la competición en la posición idx del array
  const eliminarCompeticion = (idx) => {
    setCompeticiones(competiciones.filter((_, i) => i !== idx))
  }

  // Actualiza un campo específico de una competición del array
  const actualizarCompeticion = (idx, campo, valor) => {
    const nuevas = [...competiciones]
    nuevas[idx][campo] = valor
    setCompeticiones(nuevas)
  }

  // Crea el evento en la BD y, si hay competiciones válidas, las crea también
  const onSubmit = async (data) => {
    // Filtra las competiciones que tienen nombre (las vacías se ignoran)
    const compValidas = competiciones.filter(c => c.nombre.trim())
    setGuardando(true)
    try {
      // PASO 1: Inserta el evento y obtiene el ID generado para usarlo en las competiciones
      const { data: evento, error: errEvento } = await supabase
        .from('evento')
        .insert({
          nombre: data.nombre,
          lugar: data.lugar || null,
          descripcion: data.descripcion || null,
          organizador_id: user.id  // Vincula el evento al admin autenticado
        })
        .select()
        .single()
      if (errEvento) throw errEvento

      // PASO 2: Si hay competiciones válidas, las inserta todas en una sola llamada
      if (compValidas.length > 0) {
        const { error: errComp } = await supabase
          .from('competicion')
          .insert(compValidas.map(c => ({
            evento_id: evento.id,           // Vincula a la competición al evento recién creado
            nombre: c.nombre.trim(),
            descripcion: c.descripcion || null
          })))
        if (errComp) throw errComp
      }

      toast.success('Evento creado correctamente')
      // Redirige directamente a la edición del evento para seguir configurándolo
      navigate(`/admin/eventos/${evento.id}/editar`)
    } catch (err) {
      toast.error(err.message || 'Error al crear el evento')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Crear evento</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Sección de información básica del evento */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">Información del evento</h2>
            <Input
              label="Nombre del evento *"
              placeholder="Hackathon 2025"
              error={errors.nombre?.message}
              {...register('nombre', { required: 'El nombre es obligatorio' })}
            />
            <Input
              label="Lugar"
              placeholder="Ciudad, sede..."
              {...register('lugar')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Descripción del evento..."
                {...register('descripcion')}
              />
            </div>
          </div>

          {/* Sección de competiciones — se pueden añadir varias desde el principio */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Competiciones</h2>
              <Button type="button" variant="secondary" size="sm" onClick={agregarCompeticion}>
                <Plus size={14} />
                Añadir competición
              </Button>
            </div>
            <div className="space-y-4">
              {competiciones.map((comp, idx) => (
                <div key={idx} className="border border-gray-100 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Competición {idx + 1}</span>
                    {/* Botón de eliminar — solo visible si hay más de una competición */}
                    {competiciones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarCompeticion(idx)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {/* Nombre de la competición — controlado por estado local (no react-hook-form) */}
                  <input
                    type="text"
                    placeholder="Nombre de la competición *"
                    value={comp.nombre}
                    onChange={e => actualizarCompeticion(idx, 'nombre', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Descripción (opcional)"
                    value={comp.descripcion}
                    onChange={e => actualizarCompeticion(idx, 'descripcion', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate('/admin')}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando}>
              Crear evento
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
