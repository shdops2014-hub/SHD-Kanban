import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from './KanbanCard'
import KanbanCardSkeleton from './KanbanCardSkeleton'
import { STAGE_COLORS } from '../../utils/constants'

const SKELETON_COUNTS = {
  'Lead / Inquiry': 2,
  'Proposal / Quote': 1,
  'Deposit Received': 1,
  'Work in Progress': 2,
  'Completed / Archived': 1,
}

export default function KanbanColumn({ stage, projects, onCardClick, onAddCard, loading }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const colors = STAGE_COLORS[stage] || {}
  const skeletonCount = SKELETON_COUNTS[stage] || 1

  return (
    <div className={`flex flex-col rounded-2xl border-2 ${colors.border} ${colors.bg} min-h-[600px] w-72 flex-shrink-0`}>
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-shd-dark">{stage}</span>
          {!loading && (
            <span className="text-xs text-gray-400 bg-white rounded-full px-2 py-0.5 border">
              {projects.length}
            </span>
          )}
        </div>
        <button
          onClick={() => onAddCard(stage)}
          className="text-gray-400 hover:text-shd-brown text-xl leading-none transition-colors"
          title="Add project"
        >
          +
        </button>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-3 p-3 flex-1 transition-colors ${isOver ? 'bg-white/60' : ''}`}
      >
        {loading ? (
          Array.from({ length: skeletonCount }).map((_, i) => (
            <KanbanCardSkeleton key={i} />
          ))
        ) : (
          <SortableContext items={projects.map(p => p.projectId)} strategy={verticalListSortingStrategy}>
            {projects.map((project) => (
              <KanbanCard
                key={project.projectId}
                project={project}
                onClick={() => onCardClick(project.projectId)}
              />
            ))}
            {projects.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs text-center py-12 px-4">
                No projects here yet —<br />drag one over or click + to create
              </div>
            )}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
