import { useState } from 'react'
import { SUBTASK_STATUSES } from '../../utils/constants'
import Button from '../ui/Button'

export default function SubtaskList({ projectId, subtasks, onSubtasksChange, readOnly = false }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const handleAdd = () => {
    if (!newTitle.trim()) return
    onSubtasksChange([...subtasks, {
      subtaskId: '__temp_' + Date.now(),
      projectId,
      title: newTitle.trim(),
      status: 'To Do',
    }])
    setNewTitle('')
    setAdding(false)
  }

  const handleStatusChange = (subtaskId, status) => {
    onSubtasksChange(subtasks.map(s => s.subtaskId === subtaskId ? { ...s, status } : s))
  }

  const handleDelete = (subtaskId) => {
    onSubtasksChange(subtasks.filter(s => s.subtaskId !== subtaskId))
  }

  const done = subtasks.filter(s => s.status === 'Done').length

  const STATUS_STYLES = {
    'To Do':       'bg-yellow-50 border border-yellow-200',
    'In Progress': 'bg-green-50 border border-green-200',
    'Done':        'bg-blue-50 border border-blue-200',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-shd-dark">
          Subtasks {subtasks.length > 0 && <span className="text-gray-400 font-normal">({done}/{subtasks.length} done)</span>}
        </h3>
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>+ Add</Button>
        )}
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

      {subtasks.length === 0 && readOnly && (
        <p className="text-sm text-gray-400">No subtasks.</p>
      )}

      <div className="flex flex-col gap-2">
        {subtasks.map((s) => {
          const isNew = s.subtaskId.startsWith('__temp_')
          return (
            <div
              key={s.subtaskId}
              className={`flex items-center gap-3 py-2 px-3 rounded-lg group transition-colors ${STATUS_STYLES[s.status] || 'bg-gray-50'} ${isNew ? 'ring-1 ring-shd-brown/30' : ''}`}
            >
              <input
                type="checkbox"
                checked={s.status === 'Done'}
                onChange={(e) => !readOnly && handleStatusChange(s.subtaskId, e.target.checked ? 'Done' : 'To Do')}
                disabled={readOnly}
                className="accent-shd-brown w-4 h-4 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className={`flex-1 text-sm ${s.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {s.title}
                {isNew && <span className="ml-1.5 text-xs text-shd-brown font-medium">unsaved</span>}
              </span>
              {!readOnly && (
                <select
                  value={s.status}
                  onChange={(e) => handleStatusChange(s.subtaskId, e.target.value)}
                  className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                >
                  {SUBTASK_STATUSES.map(st => <option key={st}>{st}</option>)}
                </select>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDelete(s.subtaskId)}
                  className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}

        {!readOnly && adding && (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
                if (e.key === 'Escape') setAdding(false)
              }}
              placeholder="Subtask title..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-shd-brown"
            />
            <Button size="sm" onClick={handleAdd}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  )
}
