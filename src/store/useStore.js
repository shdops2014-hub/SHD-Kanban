import { create } from 'zustand'
import * as api from '../api/sheetsApi'

const useStore = create((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  activeProjectId: null,

  // ── Load ──────────────────────────────────────────────────────────────────
  loadProjects: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.fetchProjects()
      set({ projects: res.data || [], loading: false })
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  // ── Create ────────────────────────────────────────────────────────────────
  addProject: async (data) => {
    const res = await api.createProject(data)
    if (res.success) {
      set((s) => ({ projects: [...s.projects, res.data] }))
      return res.data
    }
    throw new Error(res.error)
  },

  // ── Update ────────────────────────────────────────────────────────────────
  editProject: async (projectId, data) => {
    // optimistic
    set((s) => ({
      projects: s.projects.map((p) =>
        p.projectId === projectId ? { ...p, ...data } : p
      ),
    }))
    const res = await api.updateProject(projectId, data)
    if (!res.success) {
      // revert on failure — reload
      get().loadProjects()
      throw new Error(res.error)
    }
    return res.data
  },

  // ── Move (drag-and-drop stage change) ─────────────────────────────────────
  moveProject: async (projectId, newStage) => {
    const prev = get().projects.find((p) => p.projectId === projectId)
    // optimistic
    set((s) => ({
      projects: s.projects.map((p) =>
        p.projectId === projectId ? { ...p, stage: newStage } : p
      ),
    }))
    try {
      await api.updateProject(projectId, { stage: newStage })
    } catch {
      // revert
      set((s) => ({
        projects: s.projects.map((p) =>
          p.projectId === projectId ? { ...p, stage: prev.stage } : p
        ),
      }))
      throw new Error('Failed to move card. Please try again.')
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  removeProject: async (projectId) => {
    const prev = get().projects
    set((s) => ({ projects: s.projects.filter((p) => p.projectId !== projectId) }))
    const res = await api.deleteProject(projectId)
    if (!res.success) {
      set({ projects: prev })
      throw new Error(res.error)
    }
  },

  // ── Active project (modal) ────────────────────────────────────────────────
  setActiveProjectId: (id) => set({ activeProjectId: id }),
}))

export default useStore
