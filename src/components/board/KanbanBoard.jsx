import { useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import toast from 'react-hot-toast'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import { STAGES } from '../../utils/constants'
import useStore from '../../store/useStore'

export default function KanbanBoard({ onCardClick, onAddCard, searchQuery, typeFilter, loading }) {
  const { projects, moveProject } = useStore()
  const [activeCard, setActiveCard] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Filter projects
  const filtered = projects.filter((p) => {
    const q = searchQuery?.toLowerCase() || ''
    const matchesSearch =
      !q ||
      p.customerName?.toLowerCase().includes(q) ||
      p.projectTitle?.toLowerCase().includes(q)
    const matchesType = !typeFilter || p.projectType === typeFilter
    return matchesSearch && matchesType
  })

  const byStage = (stage) => filtered.filter((p) => p.stage === stage)

  const handleDragStart = ({ active }) => {
    setActiveCard(projects.find((p) => p.projectId === active.id) || null)
  }

  const checkStageRestriction = (project, targetStage) => {
    const hasDeposit = parseFloat(project.depositPaid) > 0
    const hasQuote = parseFloat(project.quotedAmount) > 0
    if (hasDeposit && (targetStage === 'Lead / Inquiry' || targetStage === 'Proposal / Quote')) {
      toast.error(`Remove the deposit paid to move this project back to "${targetStage}"`)
      return false
    }
    if (hasQuote && targetStage === 'Lead / Inquiry') {
      toast.error(`Remove the quoted amount to move this project back to "Lead / Inquiry"`)
      return false
    }
    return true
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveCard(null)
    if (!over) return

    const draggedProject = projects.find((p) => p.projectId === active.id)
    if (!draggedProject) return

    // Dropped on a column (stage)
    if (STAGES.includes(over.id)) {
      if (draggedProject.stage !== over.id) {
        if (!checkStageRestriction(draggedProject, over.id)) return
        try {
          await moveProject(draggedProject.projectId, over.id)
        } catch (e) {
          toast.error(e.message || 'Failed to move card')
        }
      }
      return
    }

    // Dropped on another card — determine target stage
    const targetProject = projects.find((p) => p.projectId === over.id)
    if (targetProject && targetProject.stage !== draggedProject.stage) {
      if (!checkStageRestriction(draggedProject, targetProject.stage)) return
      try {
        await moveProject(draggedProject.projectId, targetProject.stage)
      } catch (e) {
        toast.error(e.message || 'Failed to move card')
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-5 overflow-x-auto pb-6">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            projects={byStage(stage)}
            onCardClick={onCardClick}
            onAddCard={onAddCard}
            loading={loading}
          />
        ))}
      </div>

      <DragOverlay>
        {activeCard && (
          <KanbanCard project={activeCard} onClick={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
