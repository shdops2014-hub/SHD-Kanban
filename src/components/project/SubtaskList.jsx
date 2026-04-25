import { useState } from 'react'
import toast from 'react-hot-toast'
import { SUBTASK_STATUSES } from '../../utils/constants'
import { createSubtask, updateSubtask, deleteSubtask } from '../../api/sheetsApi'
import Button from '../ui/Button'

export default function SubtaskList({ projectId, subtasks, onSubtasksChange }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const res = await createSubtask({ projectId, title: newTitle.trim(), status: 'To Do' })
      if (res.success) {
        onSubtasksChange([...subtasks, res.data])
        setNewTitle('')
        setAdding(false)
        toast.success('Subtask added')
      }
    } catch { toast.error('Failed to add subtask') }
    setSaving(false)
  }

  const handleStatusChange = async (subtaskId, status) => {
    try {
      const res = await updateSubtask(subtaskId, { status })
      if (res.success) {
        onSubtasksChange(subtasks.map(s => s.subtaskId === subtaskId ? { ...s, status } : s))
      }
    } catch { toast.error('Failed to update subtask') }
  }

  const handleDelete = async (subtaskId) => {
    try {
      await deleteSubtask(subtaskId)
      onSubtasksChange(subtasks.filter(s => s.subtaskId !== subtaskId))
      toast.success('Subtask removed')
    } catch { toast.error('Failed to delete subtask') }
  }

  const done = subtasks.filter(s => s.status === 'Done').length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-shd-dark">
          Subtasks {subtasks.length > 0 && <span className="text-gray-400 font-normal">({done}/{subtasks.length} done)</span>}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>+ Add</Button>
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
          <div
            className="bg-shd-brown h-1.5 rounded-full transition-all"
            style={{ width: `${(done / subtasks.length) * 100}%` }}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {subtasks.map((s) => (
          <div key={s.subtaskId} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg group">
            <input
              type="checkbox"
              checked={s.status === 'Done'}
              onChange={(e) => handleStatusChange(s.subtaskId, e.target.checked ? 'Done' : 'To Do')}
              className="accent-shd-brown w-4 h-4 flex-shrink-0"
            />
            <span className={`flex-1 text-sm ${s.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {s.title}
            </span>
            <select
              value={s.status}
              onChange={(e) => handleStatusChange(s.subtaskId, e.target.value)}
              className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
            >
              {SUBTASK_STATUSES.map(st => <option key={st}>{st}</option>)}
            </select>
            <button
              onClick={() => handleDelete(s.subtaskId)}
              className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
            >
              ✕
            </button>
          </div>
        ))}

        {adding && (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } if (e.key === 'Escape') setAdding(false) }}
              placeholder="Subtask title..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-shd-brown"
            />
            <Button size="sm" onClick={handleAdd} disabled={saving}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  )
}
