import { create } from 'zustand'
import * as api from '../api/sheetsApi'

const useStore = create((set, get) => ({
  projects: [],
  projectCache: {}, // { [projectId]: { ...fullData, subtasks, images, cachedAt } }
  loading: false,
  error: null,
  activeProjectId: null,

  // ── Load ──────────────────────────────────────────────────────────────────
  loadProjects: async () => {
    const hasCache = get().projects.length > 0
    // Only show loading skeleton on first load; subsequent refreshes are silent
    if (!hasCache) set({ loading: true, error: null })
    try {
      const res = await api.fetchProjects()
      set({ projects: res.data || [], loading: false, error: null })
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  // ── Create ────────────────────────────────────────────────────────────────
  addProject: async (data) => {
    // Optimistic: add a placeholder card immediately so the modal can close
    const tempId = '__temp_' + Date.now()
    const tempProject = {
      projectId: tempId,
      stage: data.stage || 'Lead / Inquiry',
      customerName: data.customerName || '',
      projectTitle: data.projectTitle || '',
      phone: data.phone || '',
      email: data.email || '',
      projectType: data.projectType || '',
      description: data.description || '',
      notes: data.notes || '',
      quotedAmount: parseFloat(data.quotedAmount) || 0,
      depositPaid: parseFloat(data.depositPaid) || 0,
      balanceDue: (parseFloat(data.quotedAmount) || 0) - (parseFloat(data.depositPaid) || 0),
      dateReceived: data.dateReceived || '',
      startDate: data.startDate || '',
      targetDate: data.targetDate || '',
      assignee: data.assignee || '',
      sortOrder: 0,
      subtaskCount: 0,
      imageCount: 0,
      _optimistic: true,
    }
    set((s) => ({ projects: [...s.projects, tempProject] }))
    try {
      const res = await api.createProject(data)
      if (res.success) {
        // Replace temp card with real data
        set((s) => ({
          projects: s.projects.map((p) => p.projectId === tempId ? { ...res.data, subtaskCount: 0, imageCount: 0 } : p),
        }))
        return res.data
      }
      throw new Error(res.error)
    } catch (e) {
      // Remove temp card on failure
      set((s) => ({ projects: s.projects.filter((p) => p.projectId !== tempId) }))
      throw e
    }
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

  // ── Detail cache ──────────────────────────────────────────────────────────
  // Stores full project data (including subtasks + images) keyed by projectId.
  // Used to show content instantly on modal open while a background refresh runs.
  cacheProjectDetails: (projectId, data) => {
    set((s) => ({
      projectCache: {
        ...s.projectCache,
        [projectId]: { ...data, cachedAt: Date.now() },
      },
    }))
  },

  // Prefetch a project's full details so the modal opens instantly.
  // Skips the network call if the cache is fresh (< 30 s old).
  prefetchProject: async (projectId) => {
    const cached = get().projectCache[projectId]
    if (cached && Date.now() - cached.cachedAt < 30_000) return
    try {
      const res = await api.fetchProject(projectId)
      if (res.success) {
        set((s) => ({
          projectCache: {
            ...s.projectCache,
            [projectId]: { ...res.data, cachedAt: Date.now() },
          },
        }))
      }
    } catch { /* prefetch is best-effort — silent failure is fine */ }
  },

  // ── Active project (modal) ────────────────────────────────────────────────
  setActiveProjectId: (id) => set({ activeProjectId: id }),
}))

export default useStore
