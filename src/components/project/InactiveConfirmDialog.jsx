import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

export default function InactiveConfirmDialog({ open, onClose, onConfirm }) {
  const [notes, setNotes] = useState('')

  // Reset notes whenever the dialog opens or closes
  useEffect(() => {
    if (!open) setNotes('')
  }, [open])

  const handleConfirm = () => {
    if (!notes.trim()) return
    onConfirm(notes.trim())
  }

  return (
    <Modal open={open} onClose={onClose} title='Move to "Inactive / Lost"'>
      <p className="text-sm text-gray-600 mb-4">
        Are you sure you want to move this project to{' '}
        <span className="font-medium text-gray-800">"Inactive / Lost"</span>? If so, please
        provide reasoning in the Closing Notes.
      </p>

      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Closing Notes <span className="text-red-500">*</span>
        </label>
        <textarea
          autoFocus
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="provide reasoning for closing this project..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shd-brown resize-none"
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={!notes.trim()}>Confirm</Button>
      </div>
    </Modal>
  )
}
