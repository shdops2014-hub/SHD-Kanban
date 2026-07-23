import { useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import toast from 'react-hot-toast'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import { STAGES, BOARD_STAGES } from '../../utils/constants'
import useStore from '../../store/useStore'

export default function KanbanBoard({ onCardClick, onAddCard, searchQuery, typeFilter, stageFilter, loading }) {
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
    const matchesStage = !stageFilter || p.stage === stageFilter
    return matchesSearch && matchesType && matchesStage
  })

  const THIRTY_DAYS_MS         = 30  * 24 * 60 * 60 * 1000
  const HUNDRED_TWENTY_DAYS_MS = 120 * 24 * 60 * 60 * 1000
  const byStage = (stage) => filtered.filter((p) => {
    if (p.stage !== stage) return false
    // Hide Completed/Archived cards older than 30 days unless that stage is explicitly selected
    if (stage === 'Completed / Archived' && p.completedAt && stageFilter !== 'Completed / Archived') {
      return Date.now() - new Date(p.completedAt).getTime() < THIRTY_DAYS_MS
    }
    // Hide Lead/Inquiry cards older than 120 days unless that stage is explicitly selected
    if (stage === 'Lead / Inquiry' && p.dateReceived && stageFilter !== 'Lead / Inquiry') {
      return Date.now() - new Date(p.dateReceived).getTime() < HUNDRED_TWENTY_DAYS_MS
    }
    return true
  })

  // Show the Inactive/Lost column only when that stage is explicitly selected
  const stagesToRender = stageFilter === 'Inactive / Lost'
    ? [...BOARD_STAGES, 'Inactive / Lost']
    : BOARD_STAGES

  const handleDragStart = ({ active }) => {
    setActiveCard(projects.find((p) => p.projectId === active.id) || null)
  }

  const checkStageRestriction = (project, targetStage) => {
    const hasDeposit = parseFloat(project.depositPaid) > 0
    const hasQuote = parseFloat(project.quotedAmount) > 0
    if (targetStage === 'Completed / Archived' && !project.invoiceNumber?.trim()) {
      toast.error('An invoice number is required to move to Completed / Archived')
      return false
    }
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
        {stagesToRender.map((stage) => (
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
