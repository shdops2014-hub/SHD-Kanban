const API_URL = import.meta.env.VITE_API_URL

// GET — simple request, no preflight
const get = async (action, params = {}) => {
  const url = new URL(API_URL)
  url.searchParams.set('action', action)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// POST — string body defaults to text/plain, no preflight triggered
const post = async (action, payload = {}) => {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Projects ──────────────────────────────────────────────────────────────────

export const fetchProjects = () => get('getProjects')

export const fetchProject = (projectId) => get('getProject', { projectId })

export const createProject = (data) => post('createProject', data)

export const updateProject = (projectId, data) =>
  post('updateProject', { projectId, ...data })

export const deleteProject = (projectId) => post('deleteProject', { projectId })

// ── Subtasks ──────────────────────────────────────────────────────────────────

export const createSubtask = (data) => post('createSubtask', data)

export const updateSubtask = (subtaskId, data) =>
  post('updateSubtask', { subtaskId, ...data })

export const deleteSubtask = (subtaskId) => post('deleteSubtask', { subtaskId })

// ── Images ────────────────────────────────────────────────────────────────────

export const uploadImage = async (projectId, file) => {
  const base64Data = await fileToBase64(file)
  return post('uploadImage', {
    projectId,
    fileName: file.name,
    mimeType: file.type,
    base64Data,
  })
}

export const deleteImage = (imageId) => post('deleteImage', { imageId })

// ── Utility ───────────────────────────────────────────────────────────────────

export const ping = () => get('ping')

// ── Helpers ───────────────────────────────────────────────────────────────────

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
