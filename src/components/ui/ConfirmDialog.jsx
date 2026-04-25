import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  return (
    <Modal open={open} onClose={onClose} title={title || 'Are you sure?'}>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={() => { onConfirm(); onClose() }}>Delete</Button>
      </div>
    </Modal>
  )
}
