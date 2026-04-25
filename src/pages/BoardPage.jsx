import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import Header from '../components/layout/Header'
import FilterBar from '../components/layout/FilterBar'
import KanbanBoard from '../components/board/KanbanBoard'
import ProjectModal from '../components/project/ProjectModal'
import useStore from '../store/useStore'
import { ping } from '../api/sheetsApi'

const WARM_INTERVAL_MS = 4 * 60 * 1000 // 4 minutes

export default function BoardPage() {
  const { loadProjects, loading, error } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [defaultStage, setDefaultStage] = useState(null)

  useEffect(() => {
    // Fire ping immediately to warm the Apps Script before user interacts
    ping().catch(() => {})
    loadProjects()
    // Keep warm every 4 minutes to prevent cold starts
    const interval = setInterval(() => ping().catch(() => {}), WARM_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const openNew = (stage = null) => {
    setActiveProjectId(null)
    setDefaultStage(stage)
    setModalOpen(true)
  }

  const openExisting = (projectId) => {
    setActiveProjectId(projectId)
    setDefaultStage(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setActiveProjectId(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-shd-cream">
      <Toaster position="top-right" />
      <Header onNewProject={() => openNew()} />
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      <main className="flex-1 p-6 overflow-x-auto">
        {error && (
          <div className="text-center py-6 text-red-500 text-sm">
            Failed to load projects. Check your API connection.
          </div>
        )}
        <KanbanBoard
          onCardClick={openExisting}
          onAddCard={openNew}
          searchQuery={searchQuery}
          typeFilter={typeFilter}
          loading={loading}
        />
      </main>

      <ProjectModal
        open={modalOpen}
        projectId={activeProjectId}
        defaultStage={defaultStage}
        onClose={closeModal}
      />
    </div>
  )
}
