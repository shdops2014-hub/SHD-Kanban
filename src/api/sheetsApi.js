import axios from 'axios'
import { API_URL } from '../utils/constants'

const api = axios.create({ baseURL: API_URL })

const get = (action, params = {}) =>
  api.get('', { params: { action, ...params } }).then(r => r.data)

const post = (action, payload = {}) =>
  api.post('', { action, ...payload }).then(r => r.data)

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
