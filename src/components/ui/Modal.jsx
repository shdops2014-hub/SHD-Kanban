import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, wide = false, headerActions }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4 py-8">
      <div
        className={`relative bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} mx-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-shd-dark">{title}</h2>
          <div className="flex items-center gap-2">
            {headerActions}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
      </div>
    </div>
  )
}
