// Página de edición de evento — ruta /admin/eventos/:id/editar
// Permite al admin modificar la información del evento y gestionar sus competiciones
// Organizada en dos pestañas: "Información" y "Competiciones"
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { subirImagenEvento } from '../../utils/eventImages'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

// Etiquetas de las pestañas de navegación
const TABS = ['Información', 'Competiciones']

export default function EventoEditar() {
  const { id } = useParams()        // ID del evento desde la URL
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0) // Pestaña activa (0 = Información, 1 = Competiciones)
  const [evento, setEvento] = useState(null)
  const [competiciones, setCompeticiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [imagen, setImagen] = useState(null)
  const [modalCompeticion, setModalCompeticion] = useState(false)
  // Estado del formulario del modal de nueva competición
  const [nuevaComp, setNuevaComp] = useState({ nombre: '', descripcion: '' })

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  // Carga los datos al montar el componente o cuando cambia el ID del evento
  useEffect(() => { cargarDatos() }, [id])

  // Carga el evento y sus competiciones en paralelo
  // Verifica que el usuario autenticado es el organizador del evento
  async function cargarDatos() {
    try {
      const [{ data: ev }, { data: comps }] = await Promise.all([
        supabase.from('evento').select('*').eq('id', id).single(),
        // Carga las competiciones del evento ordenadas por fecha de creación
        supabase.from('competicion').select('*').eq('evento_id', id).order('created_at'),
      ])
      // Control de acceso: si el evento no existe o no pertenece al usuario → redirige
      if (!ev || ev.organizador_id !== user.id) {
        toast.error('Sin acceso')
        return navigate('/admin')
      }
      setEvento(ev)
      setCompeticiones(comps || [])
      // Rellena el formulario con los datos actuales del evento
      reset({ nombre: ev.nombre, lugar: ev.lugar || '', descripcion: ev.descripcion || '' })
      setImagen(null)
    } catch (err) {
      toast.error('Error al cargar el evento')
    } finally {
      setCargando(false)
    }
  }

  // Guarda los cambios de la pestaña "Información" en la tabla 'evento'
  const guardarInfo = async (data) => {
    setGuardando(true)
    try {
      const imagenUrl = imagen ? await subirImagenEvento(supabase, imagen, user.id) : evento?.imagen_url
      const { error } = await supabase
        .from('evento')
        .update({ nombre: data.nombre, lugar: data.lugar || null, descripcion: data.descripcion || null, imagen_url: imagenUrl || null })
        .eq('id', id)
      if (error) throw error
      setEvento(prev => ({ ...prev, nombre: data.nombre, lugar: data.lugar || null, descripcion: data.descripcion || null, imagen_url: imagenUrl || null }))
      setImagen(null)
      toast.success('Evento actualizado')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Crea una nueva competición vinculada a este evento
  const agregarCompeticion = async () => {
    if (!nuevaComp.nombre.trim()) return toast.error('El nombre es obligatorio')
    try {
      const { data, error } = await supabase
        .from('competicion')
        .insert({ evento_id: id, nombre: nuevaComp.nombre.trim(), descripcion: nuevaComp.descripcion || null })
        .select().single()
      if (error) throw error
      // Añade la nueva competición al array local sin recargar toda la página
      setCompeticiones([...competiciones, data])
      setNuevaComp({ nombre: '', descripcion: '' })
      setModalCompeticion(false)
      toast.success('Competición añadida')
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Guarda los cambios de nombre/descripción de una competición existente
  // Se llama al perder el foco (onBlur) en los inputs de la lista
  const guardarCompeticion = async (comp) => {
    try {
      const { error } = await supabase
        .from('competicion')
        .update({ nombre: comp.nombre, descripcion: comp.descripcion || null })
        .eq('id', comp.id)
      if (error) throw error
      toast.success('Guardado')
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Muestra spinner mientras cargan los datos iniciales
  if (cargando) return (
    <Layout>
      <div className="flex justify-center py-12"><Spinner /></div>
    </Layout>
  )

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb de navegación: Mis eventos → nombre del evento */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link to="/admin" className="hover:text-indigo-600">Mis eventos</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium">{evento?.nombre}</span>
        </div>

        {/* Tabs de navegación entre secciones */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === i
                  ? 'border-indigo-600 text-indigo-600'      // Pestaña activa
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* PESTAÑA 0: Información básica del evento */}
        {tab === 0 && (
          <form onSubmit={handleSubmit(guardarInfo)} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <Input label="Nombre *" error={errors.nombre?.message} {...register('nombre', { required: 'Obligatorio' })} />
            <Input label="Lugar" {...register('lugar')} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('descripcion')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del evento</label>
              {(imagen || evento?.imagen_url) && (
                <img
                  src={imagen ? URL.createObjectURL(imagen) : evento.imagen_url}
                  alt={evento?.nombre || 'Evento'}
                  className="mb-3 h-40 w-full rounded-lg object-cover border border-gray-200"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={e => setImagen(e.target.files?.[0] || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={guardando}>Guardar cambios</Button>
            </div>
          </form>
        )}

        {/* PESTAÑA 1: Lista de competiciones del evento */}
        {tab === 1 && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setModalCompeticion(true)}>
                <Plus size={16} /> Añadir competición
              </Button>
            </div>
            {competiciones.map(comp => (
              <div key={comp.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    {/* Input de nombre: se guarda al perder el foco */}
                    <input
                      defaultValue={comp.nombre}
                      onBlur={e => guardarCompeticion({ ...comp, nombre: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Nombre"
                    />
                    {/* Input de descripción: se guarda al perder el foco */}
                    <input
                      defaultValue={comp.descripcion || ''}
                      onBlur={e => guardarCompeticion({ ...comp, descripcion: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Descripción (opcional)"
                    />
                  </div>
                  {/* Link al detalle completo de la competición (equipos, criterios, encuestas, jurado) */}
                  <Link
                    to={`/admin/competiciones/${comp.id}`}
                    className="ml-3 flex items-center gap-1 text-sm text-indigo-600 hover:underline whitespace-nowrap"
                  >
                    Ver detalle <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
            {competiciones.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No hay competiciones aún</p>
            )}
          </div>
        )}

      </div>

      {/* Modal para añadir nueva competición */}
      <Modal open={modalCompeticion} onClose={() => setModalCompeticion(false)} title="Nueva competición">
        <div className="space-y-4">
          <input
            placeholder="Nombre de la competición *"
            value={nuevaComp.nombre}
            onChange={e => setNuevaComp({ ...nuevaComp, nombre: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="Descripción (opcional)"
            value={nuevaComp.descripcion}
            onChange={e => setNuevaComp({ ...nuevaComp, descripcion: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalCompeticion(false)}>Cancelar</Button>
            <Button onClick={agregarCompeticion}>Añadir</Button>
          </div>
        </div>
      </Modal>

    </Layout>
  )
}
