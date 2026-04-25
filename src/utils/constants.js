export const STAGES = [
  'Lead / Inquiry',
  'Proposal / Quote',
  'Deposit Received',
  'Work in Progress',
  'Completed / Archived',
]

// Index-based ordering for auto-stage advancement
export const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i]))

export const STAGE_COLORS = {
  'Lead / Inquiry':       { bg: 'bg-gray-50',   border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-600' },
  'Proposal / Quote':     { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  'Deposit Received':     { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700' },
  'Work in Progress':     { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700' },
  'Completed / Archived': { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
}

export const PROJECT_TYPES = [
  { value: 'upholstery',       label: 'Upholstery' },
  { value: 'custom_furniture', label: 'Custom Furniture' },
  { value: 'wallpaper',        label: 'Wallpaper' },
  { value: 'fabric',           label: 'Fabric' },
  { value: 'lighting_decor',   label: 'Lighting & Decor' },
  { value: 'other',            label: 'Other' },
]

export const SUBTASK_STATUSES = ['To Do', 'In Progress', 'Done']

export const API_URL = import.meta.env.VITE_API_URL || ''
