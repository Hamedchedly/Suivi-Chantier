import { useState } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

function Modal({ isOpen, title, onClose, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-all flex-shrink-0"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Add Subtask Modal ────────────────────────────────────────────────────────

interface AddSubtaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, dueDate?: string) => void
}

export function AddSubtaskModal({ isOpen, onClose, onSubmit }: AddSubtaskModalProps) {
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name, dueDate || undefined)
      setName('')
      setDueDate('')
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} title="Ajouter une sous-tâche" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Nom de la sous-tâche
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Fenêtre séjour"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Date d'échéance (optionnel)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all shadow-md hover:shadow-lg"
        >
          + Créer
        </button>
      </div>
    </Modal>
  )
}

// ── Add Note Modal ───────────────────────────────────────────────────────────

interface AddNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (date: string, note: string) => void
}

export function AddNoteModal({ isOpen, onClose, onSubmit }: AddNoteModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')

  const handleSubmit = () => {
    if (note.trim()) {
      onSubmit(date, note)
      setNote('')
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} title="Ajouter une note" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Remarques, observations..."
            rows={5}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all shadow-md hover:shadow-lg"
        >
          💾 Enregistrer
        </button>
      </div>
    </Modal>
  )
}

// ── Add Photo Modal ──────────────────────────────────────────────────────────

interface AddPhotoModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (file: File, annotation?: string) => void
}

export function AddPhotoModal({ isOpen, onClose, onSubmit }: AddPhotoModalProps) {
  const [annotation, setAnnotation] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleSubmit = () => {
    if (selectedFile) {
      onSubmit(selectedFile, annotation || undefined)
      setAnnotation('')
      setSelectedFile(null)
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} title="Ajouter une photo" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label htmlFor="photo" className="block">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors bg-slate-50">
              <div className="text-5xl mb-3">📷</div>
              <p className="text-sm text-slate-600 font-medium">
                {selectedFile ? selectedFile.name : 'Appuyez pour ajouter une photo'}
              </p>
            </div>
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Annotation (optionnel)
          </label>
          <input
            type="text"
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            placeholder="Description de la photo"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!selectedFile}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500 active:scale-95 transition-all shadow-md hover:shadow-lg"
        >
          📸 Ajouter
        </button>
      </div>
    </Modal>
  )
}

// ── Edit Task Modal ──────────────────────────────────────────────────────────

interface EditTaskModalProps {
  isOpen: boolean
  taskName: string
  onClose: () => void
  onSubmit: (name: string, isNA: boolean, blockedBy?: string[], blocks?: string[]) => void
}

export function EditTaskModal({ isOpen, taskName, onClose, onSubmit }: EditTaskModalProps) {
  const [name, setName] = useState(taskName)
  const [isNA, setIsNA] = useState(false)

  const handleSubmit = () => {
    onSubmit(name, isNA)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} title="Modifier la tâche" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Nom
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="checkNA"
              checked={isNA}
              onChange={(e) => setIsNA(e.target.checked)}
              className="w-5 h-5 cursor-pointer accent-blue-600 rounded"
            />
            <span className="text-sm font-medium text-slate-700">
              Cette tâche ne s'applique pas à ce logement
            </span>
          </label>
        </div>
        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all shadow-md hover:shadow-lg"
        >
          ✓ Enregistrer
        </button>
      </div>
    </Modal>
  )
}
