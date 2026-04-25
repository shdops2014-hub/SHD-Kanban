import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import Header from '../components/layout/Header'
import FilterBar from '../components/layout/FilterBar'
import KanbanBoard from '../components/board/KanbanBoard'
import ProjectModal from '../components/project/ProjectModal'
import Spinner from '../components/ui/Spinner'
import useStore from '../store/useStore'

export default function BoardPage() {
  const { loadProjects, loading, error } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [defaultStage, setDefaultStage] = useState(null)

  useEffect(() => { loadProjects() }, [])

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
    loadProjects() // refresh after any changes
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
        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
            <Spinner className="w-6 h-6" />
            <span>Loading projects…</span>
          </div>
        )}
        {error && (
          <div className="text-center py-24 text-red-500">
            Failed to load projects. Check your API connection.
          </div>
        )}
        {!loading && !error && (
          <KanbanBoard
            onCardClick={openExisting}
            onAddCard={openNew}
            searchQuery={searchQuery}
            typeFilter={typeFilter}
          />
        )}
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
