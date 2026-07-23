import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

const CLOSURE_REASONS = ['Price / Budget', 'No Response', 'Project Cancelled', 'Other']

export default function InactiveConfirmDialog({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) { setReason(''); setNotes('') }
  }, [open])

  const handleConfirm = () => {
    if (!reason || !notes.trim()) return
    onConfirm(`${reason}: ${notes.trim()}`)
  }

  return (
    <Modal open={open} onClose={onClose} title='Move to "Inactive / Lost"'>
      <p className="text-sm text-gray-600 mb-4">
        Are you sure you want to move this project to{' '}
        <span className="font-medium text-gray-800">"Inactive / Lost"</span>? If so, please
        provide reasoning in the Closing Notes.
      </p>

      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Reason <span className="text-red-500">*</span>
        </label>
        <select
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-shd-brown"
        >
          <option value="">Select a reason...</option>
          {CLOSURE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Closing Notes <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Provide additional detail..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shd-brown resize-none"
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={!reason || !notes.trim()}>Confirm</Button>
      </div>
    </Modal>
  )
}
