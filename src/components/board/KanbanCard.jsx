import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDate } from '../../utils/formatters'
import { STAGE_COLORS } from '../../utils/constants'
import Badge from '../ui/Badge'

export default function KanbanCard({ project, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.projectId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const colors = STAGE_COLORS[project.stage] || STAGE_COLORS['Lead / Inquiry']
  const subtaskCount = project.subtaskCount || 0
  const imageCount = project.imageCount || 0

  const depositOverdue =
    project.stage === 'Deposit Received' &&
    project.lastUpdated &&
    (Date.now() - new Date(project.lastUpdated).getTime()) / 86400000 >= 10

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer select-none"
    >
      {/* Project title */}
      <p className="font-semibold text-shd-dark text-sm leading-snug mb-1 truncate">
        {project.projectTitle || 'Untitled Project'}
      </p>

      {/* Customer name */}
      <p className="text-gray-500 text-xs mb-3 truncate">{project.customerName || '—'}</p>

      {/* Stage badge */}
      <Badge className={`${colors.badge} mb-3`}>{project.stage}</Badge>

      {/* Overdue deposit warning */}
      {depositOverdue && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
          <span>⚠️</span>
          <span>Update Required</span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
        <span>{project.dateReceived ? formatDate(project.dateReceived) : 'No date'}</span>
        <div className="flex items-center gap-2">
          {subtaskCount > 0 && (
            <span title="Subtasks">✓ {subtaskCount}</span>
          )}
          {imageCount > 0 && (
            <span title="Images">🖼 {imageCount}</span>
          )}
        </div>
      </div>
    </div>
  )
}
