// Página de selección de rol — accesible desde /acceso
// Muestra tres bloques: Administrador, Juez y Participante
// Cada bloque lleva al login correspondiente (admin y juez comparten /login;
// participante abre un modal para inscribirse en un evento y competición)
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { LayoutDashboard, ClipboardList, Users, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'

// Configuración de los tres bloques de acceso
const bloques = [
  {
    icon: LayoutDashboard,
    titulo: 'Administrador',
    descripcion: 'Gestiona eventos, competiciones, equipos y encuestas.',
    color: 'indigo',
    to: '/login',
  },
  {
    icon: ClipboardList,
    titulo: 'Juez',
    descripcion: 'Evalúa los proyectos asignados en las competiciones.',
    color: 'violet',
    to: '/login',
  },
  {
    icon: Users,
    titulo: 'Participante',
    descripcion: 'Inscribe tu equipo o proyecto en una competición.',
    color: 'sky',
    action: 'participante',
  },
]

// Clases Tailwind por color — separadas para poder usar JIT de Tailwind correctamente
const colorMap = {
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: 'bg-indigo-100 text-indigo-600',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: 'bg-violet-100 text-violet-600',
    btn: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  sky: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: 'bg-sky-100 text-sky-600',
    btn: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
}

const estadoInicialFormulario = {
  eventoId: '',
  competicionId: '',
  nombreEquipo: '',
  proyectoNombre: '',
  proyectoDesc: '',
  participantes: [{ nombre: '', correo: '' }],
}

export default function Acceso() {
  const [modalParticipante, setModalParticipante] = useState(false)
  const [eventos, setEventos] = useState([])
  const [competiciones, setCompeticiones] = useState([])
  const [cargandoEventos, setCargandoEventos] = useState(false)
  const [cargandoCompeticiones, setCargandoCompeticiones] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [formParticipante, setFormParticipante] = useState(estadoInicialFormulario)

  const abrirModalParticipante = async () => {
    setModalParticipante(true)

    if (eventos.length > 0) return

    setCargandoEventos(true)
    try {
      const { data, error } = await supabase
        .from('evento')
        .select('id, nombre, imagen_url')
        .order('nombre')

      if (error) throw error
      setEventos(data || [])
    } catch (err) {
      toast.error('No se pudieron cargar los eventos')
    } finally {
      setCargandoEventos(false)
    }
  }

  const cambiarEvento = async (eventoId) => {
    setFormParticipante((prev) => ({
      ...prev,
      eventoId,
      competicionId: '',
    }))
    setCompeticiones([])

    if (!eventoId) return

    setCargandoCompeticiones(true)
    try {
      const { data, error } = await supabase
        .from('competicion')
        .select('id, nombre')
        .eq('evento_id', Number(eventoId))
        .order('nombre')

      if (error) throw error
      setCompeticiones(data || [])
    } catch (err) {
      toast.error('No se pudieron cargar las competiciones')
    } finally {
      setCargandoCompeticiones(false)
    }
  }

  const guardarParticipante = async () => {
    if (!formParticipante.eventoId) {
      return toast.error('Selecciona un evento')
    }

    if (!formParticipante.competicionId) {
      return toast.error('Selecciona una competición')
    }

    if (!formParticipante.nombreEquipo.trim() || !formParticipante.proyectoNombre.trim()) {
      return toast.error('Nombre del equipo y proyecto son obligatorios')
    }

    setGuardando(true)
    try {
      const { data: eq, error: e1 } = await supabase
        .from('equipo')
        .insert({
          competicion_id: Number(formParticipante.competicionId),
          nombre: formParticipante.nombreEquipo.trim(),
        })
        .select()
        .single()

      if (e1) throw e1

      const { error: e2 } = await supabase
        .from('proyecto')
        .insert({
          equipo_id: eq.id,
          nombre: formParticipante.proyectoNombre.trim(),
          descripcion: formParticipante.proyectoDesc || null,
        })

      if (e2) throw e2

      const parts = formParticipante.participantes.filter(
        (p) => p.nombre.trim() && p.correo.trim()
      )

      if (parts.length > 0) {
        const { error: e3 } = await supabase
          .from('participante')
          .insert(
            parts.map((p) => ({
              equipo_id: eq.id,
              nombre: p.nombre.trim(),
              correo: p.correo.trim(),
            }))
          )

        if (e3) throw e3
      }

      toast.success('Equipo inscrito correctamente')
      setFormParticipante(estadoInicialFormulario)
      setCompeticiones([])
      setModalParticipante(false)
    } catch (err) {
      toast.error(err.message || 'Error al inscribirse')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      {/* Cabecera */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Acceder a Votify</h1>
        <p className="text-gray-500 mt-2">Selecciona tu rol para continuar</p>
      </div>

      {/* Grid de 3 bloques de rol — una columna en móvil, tres en escritorio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
        {bloques.map(({ icon: Icon, titulo, descripcion, color, to, action }) => {
          const c = colorMap[color]
          return (
            <div
              key={titulo}
              className={`flex flex-col items-center text-center rounded-2xl border ${c.border} ${c.bg} p-7`}
            >
              {/* Icono del rol */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${c.icon}`}>
                <Icon size={26} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{titulo}</h2>
              <p className="text-sm text-gray-500 mb-6 flex-1">{descripcion}</p>
              {/* Botón de acceso — lleva al login correspondiente */}
              {action === 'participante' ? (
                <button
                  type="button"
                  onClick={abrirModalParticipante}
                  className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors text-center ${c.btn}`}
                >
                  Entrar como participante
                </button>
              ) : (
                <Link
                  to={to}
                  className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors text-center ${c.btn}`}
                >
                  Entrar como {titulo.toLowerCase()}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* Link para volver a la pantalla principal de voto público */}
      <Link to="/" className="mt-8 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        ← Volver al inicio
      </Link>

      <Modal
        open={modalParticipante}
        onClose={() => setModalParticipante(false)}
        title="Inscripción de participante"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {formParticipante.eventoId && eventos.find(e => String(e.id) === String(formParticipante.eventoId))?.imagen_url && (
            <img
              src={eventos.find(e => String(e.id) === String(formParticipante.eventoId)).imagen_url}
              alt={eventos.find(e => String(e.id) === String(formParticipante.eventoId)).nombre}
              className="h-36 w-full rounded-lg object-cover border border-gray-200"
            />
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evento *
            </label>
            <select
              value={formParticipante.eventoId}
              onChange={(e) => cambiarEvento(e.target.value)}
              disabled={cargandoEventos}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
            >
              <option value="">
                {cargandoEventos ? 'Cargando eventos...' : 'Selecciona un evento'}
              </option>
              {eventos.map((evento) => (
                <option key={evento.id} value={evento.id}>
                  {evento.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Competición *
            </label>
            <select
              value={formParticipante.competicionId}
              onChange={(e) =>
                setFormParticipante((prev) => ({
                  ...prev,
                  competicionId: e.target.value,
                }))
              }
              disabled={!formParticipante.eventoId || cargandoCompeticiones}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
            >
              <option value="">
                {!formParticipante.eventoId
                  ? 'Selecciona primero un evento'
                  : cargandoCompeticiones
                    ? 'Cargando competiciones...'
                    : 'Selecciona una competición'}
              </option>
              {competiciones.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del equipo *
            </label>
            <input
              value={formParticipante.nombreEquipo}
              onChange={(e) =>
                setFormParticipante((prev) => ({
                  ...prev,
                  nombreEquipo: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Equipo Alpha"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del proyecto *
            </label>
            <input
              value={formParticipante.proyectoNombre}
              onChange={(e) =>
                setFormParticipante((prev) => ({
                  ...prev,
                  proyectoNombre: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Mi proyecto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción del proyecto
            </label>
            <textarea
              rows={2}
              value={formParticipante.proyectoDesc}
              onChange={(e) =>
                setFormParticipante((prev) => ({
                  ...prev,
                  proyectoDesc: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Participantes</label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setFormParticipante((prev) => ({
                    ...prev,
                    participantes: [...prev.participantes, { nombre: '', correo: '' }],
                  }))
                }
              >
                <Plus size={13} /> Añadir
              </Button>
            </div>

            {formParticipante.participantes.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={p.nombre}
                  onChange={(e) => {
                    const ps = [...formParticipante.participantes]
                    ps[i].nombre = e.target.value
                    setFormParticipante((prev) => ({ ...prev, participantes: ps }))
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Nombre"
                />
                <input
                  value={p.correo}
                  onChange={(e) => {
                    const ps = [...formParticipante.participantes]
                    ps[i].correo = e.target.value
                    setFormParticipante((prev) => ({ ...prev, participantes: ps }))
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Correo"
                />
                {formParticipante.participantes.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormParticipante((prev) => ({
                        ...prev,
                        participantes: prev.participantes.filter((_, j) => j !== i),
                      }))
                    }
                    className="text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalParticipante(false)}>
              Cancelar
            </Button>
            <Button loading={guardando} onClick={guardarParticipante}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
