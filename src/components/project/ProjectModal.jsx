import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Badge from '../ui/Badge'
import SubtaskList from './SubtaskList'
import ImageGallery from './ImageGallery'
import ConfirmDialog from '../ui/ConfirmDialog'
import InactiveConfirmDialog from './InactiveConfirmDialog'
import ProjectFormSkeleton from './ProjectFormSkeleton'
import { STAGES, STAGE_ORDER, STAGE_COLORS, PROJECT_TYPES } from '../../utils/constants'
import { fetchProject, createSubtask as createSubtaskApi, updateSubtask as updateSubtaskApi, deleteSubtask as deleteSubtaskApi } from '../../api/sheetsApi'
import { formatCurrency, formatDate, formatPhone, toDateValue } from '../../utils/formatters'
import useStore from '../../store/useStore'

const STAGE_OPTIONS = STAGES.map(s => ({ value: s, label: s }))

// Advance stage based on financials — never moves backward
function autoStage(data, currentStage) {
  const current = STAGE_ORDER[currentStage] ?? 0
  let target = current
  if (parseFloat(data.quotedAmount) > 0) {
    target = Math.max(target, STAGE_ORDER['Proposal / Quote'])
  }
  if (parseFloat(data.depositPaid) > 0) {
    target = Math.max(target, STAGE_ORDER['Deposit Received'])
  }
  if (data.invoiced && parseFloat(data.invoiceAmount) > 0 && data.invoiceNumber?.trim()) {
    target = Math.max(target, STAGE_ORDER['Completed / Archived'])
  }
  return STAGES[target]
}

function daysSince(dateStr) {
  if (!dateStr) return 0
  return (Date.now() - new Date(dateStr).getTime()) / 86400000
}

// Read-only field display used in view mode
function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{children || '—'}</p>
    </div>
  )
}

export default function ProjectModal({ projectId, open, onClose, defaultStage }) {
  const { addProject, editProject, removeProject, projects, projectCache, cacheProjectDetails, patchProject } = useStore()

  const isNew = !projectId

  const { register, handleSubmit, watch, reset, getValues, setValue, formState: { errors, isDirty } } = useForm()
  const [isEditing, setIsEditing] = useState(false)
  const [projectData, setProjectData] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [subtasks, setSubtasks] = useState([])
  const [images, setImages] = useState([])
  const [mediaChanged, setMediaChanged] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [inactiveConfirmOpen, setInactiveConfirmOpen] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState(null)
  // Tracks the DB state of subtasks at open time so we can diff on save
  const originalSubtasksRef = useRef([])
  // Tracks the last confirmed stage so we can revert the dropdown on cancel
  const committedStageRef = useRef(STAGES[0])

  const quotedAmount = parseFloat(watch('quotedAmount')) || 0
  const depositPaid = parseFloat(watch('depositPaid')) || 0
  const balanceDue = quotedAmount - depositPaid
  const invoiced = watch('invoiced')
  const invoiceAmount = parseFloat(watch('invoiceAmount')) || 0
  const isFullyInvoiced = invoiced && invoiceAmount > 0

  const resetFormFromProject = (p) => {
    setProjectData(p)
    const stage = p.stage || STAGES[0]
    committedStageRef.current = stage
    reset({
      projectTitle: p.projectTitle || '',
      customerName: p.customerName || '',
      phone: p.phone || '',
      email: p.email || '',
      projectType: p.projectType || '',
      stage,
      description: p.description || '',
      notes: p.notes || '',
      closingNotes: p.closingNotes || '',
      quotedAmount: p.quotedAmount || '',
      depositPaid: p.depositPaid || '',
      invoiced: p.invoiced === true || p.invoiced === 'TRUE' || false,
      invoiceAmount: p.invoiceAmount || '',
      invoiceNumber: p.invoiceNumber || '',
      dateReceived: toDateValue(p.dateReceived),
      startDate: toDateValue(p.startDate),
      targetDate: toDateValue(p.targetDate),
    })
  }

  // Load existing project data
  useEffect(() => {
    if (!open) return
    if (isNew) {
      setIsEditing(true)
      setProjectData(null)
      committedStageRef.current = defaultStage || STAGES[0]
      reset({
        projectTitle: '',
        customerName: '',
        phone: '',
        email: '',
        projectType: '',
        stage: defaultStage || STAGES[0],
        description: '',
        notes: '',
        closingNotes: '',
        quotedAmount: '',
        depositPaid: '',
        invoiced: false,
        invoiceAmount: '',
        invoiceNumber: '',
        dateReceived: '',
        startDate: '',
        targetDate: '',
      })
      setSubtasks([])
      setImages([])
      setCurrentProjectId(null)
      return
    }

    // Existing project: start in view mode
    setIsEditing(false)

    // 1. Pre-fill form instantly from store summary cache
    const cached = projects.find(p => p.projectId === projectId)
    if (cached) {
      resetFormFromProject(cached)
      setCurrentProjectId(cached.projectId)
    }

    // 2. If detail cache exists (from a previous open or hover-prefetch), show
    //    subtasks + images immediately — no loading state needed.
    const cachedDetail = projectCache[projectId]
    if (cachedDetail) {
      resetFormFromProject(cachedDetail)
      setSubtasks(cachedDetail.subtasks || [])
      setImages(cachedDetail.images || [])
      setCurrentProjectId(cachedDetail.projectId)
      originalSubtasksRef.current = cachedDetail.subtasks || []
    }

    setMediaChanged(false)

    // 3. Always re-fetch in background to stay fresh.
    //    Only show the loading indicator when there is no cached detail yet.
    if (!cachedDetail) {
      setDetailsLoading(true)
      setSubtasks([])
      setImages([])
      originalSubtasksRef.current = []
    }

    fetchProject(projectId)
      .then(res => {
        if (res.success) {
          const p = res.data
          originalSubtasksRef.current = p.subtasks || []
          if (!cachedDetail) {
            resetFormFromProject(p)
            setSubtasks(p.subtasks || [])
            setImages(p.images || [])
          }
          setCurrentProjectId(p.projectId)
          cacheProjectDetails(projectId, p)
        }
      })
      .catch(() => { if (!cachedDetail) toast.error('Failed to load project details') })
      .finally(() => setDetailsLoading(false))
  }, [open, projectId, isNew])

  // Auto-save subtask changes when in view mode (immediate API flush)
  const saveSubtasksNow = async (updated) => {
    const prev = subtasks
    setSubtasks(updated)

    const originals = originalSubtasksRef.current
    const toCreate = updated.filter(s => s.subtaskId.startsWith('__temp_'))
    const toDelete = originals.filter(o => !updated.find(s => s.subtaskId === o.subtaskId))
    const toUpdate = updated.filter(s => {
      if (s.subtaskId.startsWith('__temp_')) return false
      const orig = originals.find(o => o.subtaskId === s.subtaskId)
      return orig && orig.status !== s.status
    })

    if (!toCreate.length && !toDelete.length && !toUpdate.length) return

    try {
      const createResults = await Promise.all(
        toCreate.map(s => createSubtaskApi({ projectId: currentProjectId, title: s.title, status: s.status }))
      )
      await Promise.all([
        ...toDelete.map(s => deleteSubtaskApi(s.subtaskId)),
        ...toUpdate.map(s => updateSubtaskApi(s.subtaskId, { status: s.status })),
      ])
      // Replace temp IDs with real data from the API
      let finalUpdated = [...updated]
      toCreate.forEach((s, i) => {
        if (createResults[i]?.success) {
          finalUpdated = finalUpdated.map(fs => fs.subtaskId === s.subtaskId ? createResults[i].data : fs)
        }
      })
      finalUpdated = finalUpdated.filter(s => !toDelete.find(d => d.subtaskId === s.subtaskId))
      setSubtasks(finalUpdated)
      originalSubtasksRef.current = finalUpdated
      patchProject(currentProjectId, { subtaskCount: finalUpdated.length })
    } catch {
      setSubtasks(prev)
      toast.error('Failed to save subtask')
    }
  }

  const handleCancelEdit = () => {
    const source = projectCache[currentProjectId] || projects.find(p => p.projectId === currentProjectId)
    if (source) resetFormFromProject(source)
    setSubtasks(originalSubtasksRef.current)
    setMediaChanged(false)
    setIsEditing(false)
  }

  const onSubmit = async (data) => {
    // Belt-and-suspenders: if invoiced is checked, invoice # must be present
    if (data.invoiced && !data.invoiceNumber?.trim()) {
      toast.error('Invoice # is required')
      return
    }
    setSaving(true)
    // Auto-advance stage based on financials (never moves backward)
    const resolvedStage = autoStage(data, data.stage || STAGES[0])

    // Invoice number required to archive
    if (resolvedStage === 'Completed / Archived' && !data.invoiceNumber?.trim()) {
      toast.error('An invoice number is required to move to Completed / Archived')
      setSaving(false)
      return
    }

    // All subtasks must be Done before archiving
    if (resolvedStage === 'Completed / Archived' && subtasks.some(s => s.status !== 'Done')) {
      toast.error('All subtasks must be completed before moving to Completed / Archived')
      setSaving(false)
      return
    }

    const payload = { ...data, stage: resolvedStage }

    if (isNew) {
      onClose()
      toast.success('Project created!')
      addProject(payload).catch((e) => toast.error(e.message || 'Failed to save project'))
      setSaving(false)
    } else {
      try {
        await editProject(currentProjectId, payload)

        // Diff local subtask state against DB snapshot and flush pending changes
        const originals = originalSubtasksRef.current
        const toCreate = subtasks.filter(s => s.subtaskId.startsWith('__temp_'))
        const toDelete = originals.filter(o => !subtasks.find(s => s.subtaskId === o.subtaskId))
        const toUpdate = subtasks.filter(s => {
          if (s.subtaskId.startsWith('__temp_')) return false
          const orig = originals.find(o => o.subtaskId === s.subtaskId)
          return orig && orig.status !== s.status
        })

        if (toCreate.length || toDelete.length || toUpdate.length) {
          await Promise.all([
            ...toCreate.map(s => createSubtaskApi({ projectId: currentProjectId, title: s.title, status: s.status })),
            ...toDelete.map(s => deleteSubtaskApi(s.subtaskId)),
            ...toUpdate.map(s => updateSubtaskApi(s.subtaskId, { status: s.status })),
          ])
          patchProject(currentProjectId, { subtaskCount: subtasks.length })
        }

        // Always write the saved payload into the detail cache so the next
        // re-open never shows stale values (e.g. invoiceNumber, stage).
        // Create the cache entry even if one didn't exist before.
        cacheProjectDetails(currentProjectId, {
          ...(projectCache[currentProjectId] || {}),
          ...payload,
        })

        toast.success('Project saved!')
        onClose()
      } catch (e) {
        toast.error(e.message || 'Save failed')
      }
      setSaving(false)
    }
  }

  const handleInactiveConfirm = (closingNotes) => {
    committedStageRef.current = 'Inactive / Lost'
    setValue('stage', 'Inactive / Lost', { shouldDirty: true })
    setValue('closingNotes', closingNotes, { shouldDirty: true })
    setInactiveConfirmOpen(false)
  }

  const handleDelete = async () => {
    try {
      await removeProject(currentProjectId)
      toast.success('Project deleted')
      onClose()
    } catch (e) {
      toast.error(e.message || 'Delete failed')
    }
  }

  // Intercept close attempts while in edit mode with unsaved changes
  const handleClose = () => {
    if (isEditing && (isDirty || mediaChanged)) {
      setConfirmDiscard(true)
    } else {
      onClose()
    }
  }

  const pencilIcon = !isNew && !isEditing ? (
    <button
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1.5 text-gray-400 hover:text-shd-brown transition-colors px-2 py-1 rounded"
      title="Edit project"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
      <span className="text-sm font-medium">Edit</span>
    </button>
  ) : null

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={isNew ? 'New Project' : 'Project Details'}
        wide
        headerActions={pencilIcon}
      >
        <form onSubmit={(e) => e.preventDefault()}>
          {/* Show skeleton until cache pre-fill has run for existing projects */}
          {!isNew && !currentProjectId ? (
            <ProjectFormSkeleton />
          ) : isEditing ? (
            /* ── EDIT MODE ─────────────────────────────────────────────── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="flex flex-col gap-4">
                <Input
                  label="Project Title *"
                  placeholder="e.g. Smith Dining Chair Reupholster"
                  error={errors.projectTitle?.message}
                  {...register('projectTitle', { required: 'Project title is required' })}
                />

                <Input
                  label="Customer Name *"
                  placeholder="Full name"
                  error={errors.customerName?.message}
                  {...register('customerName', { required: 'Customer name is required' })}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Phone *"
                    type="tel"
                    placeholder="(555) 000-0000"
                    error={errors.phone?.message}
                    {...register('phone', {
                      validate: v => {
                        const hasEmail = getValues('email')?.trim()
                        if (!v?.trim() && !hasEmail) return 'Phone or email is required'
                        if (!v?.trim()) return true
                        const digits = v.replace(/\D/g, '')
                        if (digits.length !== 10) return 'Phone must be 10 digits'
                        return true
                      },
                      onChange: (e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                        e.target.value = digits.length === 0 ? '' :
                          digits.length <= 3 ? `(${digits}` :
                          digits.length <= 6 ? `(${digits.slice(0,3)}) ${digits.slice(3)}` :
                          `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
                      }
                    })}
                  />
                  <Input
                    label="Email *"
                    type="email"
                    placeholder="email@example.com"
                    error={errors.email?.message}
                    {...register('email', {
                      validate: v => {
                        const hasPhone = getValues('phone')?.trim()
                        if (!v?.trim() && !hasPhone) return 'Phone or email is required'
                        if (!v?.trim()) return true
                        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v.trim())
                        if (!valid) return 'Enter a valid email address'
                        return true
                      }
                    })}
                  />
                </div>

                <Select
                  label="Project Type"
                  options={PROJECT_TYPES}
                  {...register('projectType')}
                />

                <Select
                  label="Stage"
                  options={STAGE_OPTIONS}
                  {...register('stage', {
                    onChange: (e) => {
                      const targetStage = e.target.value
                      const { quotedAmount, depositPaid } = getValues()
                      const hasDeposit = parseFloat(depositPaid) > 0
                      const hasQuote = parseFloat(quotedAmount) > 0

                      // Block manual move to Completed/Archived if invoice # is missing
                      if (targetStage === 'Completed / Archived' && !getValues('invoiceNumber')?.trim()) {
                        toast.error('An invoice number is required to move to Completed / Archived')
                        setValue('stage', committedStageRef.current, { shouldDirty: true })
                        return
                      }

                      // Block manual move to Completed/Archived if subtasks are unfinished
                      if (targetStage === 'Completed / Archived' && subtasks.some(s => s.status !== 'Done')) {
                        toast.error('All subtasks must be completed before moving to Completed / Archived')
                        setValue('stage', committedStageRef.current, { shouldDirty: true })
                        return
                      }

                      // Inactive / Lost requires confirmation + closing notes
                      if (targetStage === 'Inactive / Lost') {
                        setValue('stage', committedStageRef.current, { shouldDirty: true })
                        setInactiveConfirmOpen(true)
                        return
                      }

                      // Financial stage restrictions
                      if (hasDeposit && (targetStage === 'Lead / Inquiry' || targetStage === 'Proposal / Quote')) {
                        toast.error(`Remove the deposit paid to move this project back to "${targetStage}"`)
                        setValue('stage', 'Deposit Received', { shouldDirty: true })
                        return
                      }
                      if (hasQuote && targetStage === 'Lead / Inquiry') {
                        toast.error(`Remove the quoted amount to move this project back to "Lead / Inquiry"`)
                        setValue('stage', 'Proposal / Quote', { shouldDirty: true })
                        return
                      }

                      committedStageRef.current = targetStage
                    },
                  })}
                />

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Project details..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shd-brown resize-none"
                    {...register('description')}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Internal notes..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shd-brown resize-none"
                    {...register('notes')}
                  />
                </div>

                {watch('stage') === 'Inactive / Lost' && (
                  <div>
                    <label className="text-sm font-medium text-red-600 block mb-1">Closing Notes</label>
                    <textarea
                      rows={3}
                      placeholder="reason for closing this project..."
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none bg-red-50"
                      {...register('closingNotes')}
                    />
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-4">
                <Input
                  label="Date Received"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  error={errors.dateReceived?.message}
                  {...register('dateReceived', {
                    validate: v => !v || v <= new Date().toISOString().split('T')[0] || 'Date received cannot be in the future',
                  })}
                />
                <Input label="Start Date" type="date" {...register('startDate')} />
                <Input label="Target Completion" type="date" {...register('targetDate')} />

                {/* Financials */}
                <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
                  <h3 className="font-semibold text-sm text-shd-dark">Financials</h3>
                  <Input label="Quoted Amount ($)" type="number" step="0.01" placeholder="0.00" {...register('quotedAmount')} />
                  <Input label="Deposit Paid ($)" type="number" step="0.01" placeholder="0.00" {...register('depositPaid')} />
                  {!isFullyInvoiced && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Balance Due</span>
                      <span className={`text-sm font-semibold ${quotedAmount === 0 && depositPaid === 0 ? 'text-gray-400' : balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {quotedAmount === 0 && depositPaid === 0 ? '—' : formatCurrency(balanceDue)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                    <input
                      type="checkbox"
                      id="invoiced"
                      className="accent-shd-brown w-4 h-4 cursor-pointer"
                      {...register('invoiced', {
                        onChange: (e) => {
                          if (!e.target.checked) {
                            const currentStage = getValues('stage')
                            if (currentStage === 'Completed / Archived') {
                              setValue('stage', 'Work in Progress', { shouldDirty: true })
                              committedStageRef.current = 'Work in Progress'
                            }
                          }
                        },
                      })}
                    />
                    <label htmlFor="invoiced" className="text-sm font-medium text-gray-600 cursor-pointer select-none">
                      Invoiced
                    </label>
                  </div>

                  {/* Always mounted so react-hook-form retains values; hidden via CSS when not invoiced */}
                  <div style={{ display: invoiced ? 'flex' : 'none' }} className="flex-col gap-3">
                    <Input
                      label="Final Invoice Amount ($)"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      onKeyDown={(e) => {
                        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', '.']
                        if (!allowed.includes(e.key) && !e.metaKey && !e.ctrlKey && !/^\d$/.test(e.key)) {
                          e.preventDefault()
                        }
                      }}
                      {...register('invoiceAmount', {
                        min: { value: 0, message: 'Amount must be positive' },
                      })}
                    />
                    <Input
                      label="Invoice # *"
                      placeholder="e.g. INV-001"
                      error={errors.invoiceNumber?.message}
                      {...register('invoiceNumber', {
                        required: 'Invoice # is required',
                      })}
                    />
                  </div>
                </div>

                {/* Images */}
                {!isNew && currentProjectId && (() => {
                  const cachedCount = projects.find(p => p.projectId === currentProjectId)?.imageCount ?? 0
                  if (detailsLoading && cachedCount > 0) {
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm text-shd-dark">Images <span className="text-gray-400 font-normal">({cachedCount})</span></h3>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {Array.from({ length: Math.min(cachedCount, 6) }).map((_, i) => (
                            <div key={i} className="aspect-square rounded-lg bg-gray-100 animate-pulse" />
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <ImageGallery
                      projectId={currentProjectId}
                      images={images}
                      onImagesChange={(imgs) => {
                        setImages(imgs)
                        setMediaChanged(true)
                        patchProject(currentProjectId, { imageCount: imgs.length })
                      }}
                    />
                  )
                })()}
              </div>
            </div>
          ) : (
            /* ── VIEW MODE ─────────────────────────────────────────────── */
            projectData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="flex flex-col gap-4">
                  <Field label="Project Title">{projectData.projectTitle}</Field>
                  <Field label="Customer Name">{projectData.customerName}</Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone">{formatPhone(projectData.phone)}</Field>
                    <Field label="Email">{projectData.email}</Field>
                  </div>

                  {projectData.projectType && <Field label="Project Type">{projectData.projectType}</Field>}

                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Stage</p>
                    <Badge className={STAGE_COLORS[projectData.stage]?.badge || ''}>{projectData.stage}</Badge>
                  </div>

                  {projectData.description && <Field label="Description">{projectData.description}</Field>}
                  {projectData.notes && <Field label="Notes">{projectData.notes}</Field>}
                  {projectData.stage === 'Inactive / Lost' && projectData.closingNotes && (
                    <div>
                      <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-0.5">Closing Notes</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{projectData.closingNotes}</p>
                    </div>
                  )}
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date Received">{formatDate(projectData.dateReceived)}</Field>
                    <Field label="Start Date">{formatDate(projectData.startDate)}</Field>
                  </div>
                  <Field label="Target Completion">{formatDate(projectData.targetDate)}</Field>

                  {/* Financials */}
                  <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="font-semibold text-sm text-shd-dark">Financials</h3>
                    <Field label="Quoted Amount">{projectData.quotedAmount > 0 ? formatCurrency(projectData.quotedAmount) : null}</Field>
                    <Field label="Deposit Paid">{projectData.depositPaid > 0 ? formatCurrency(projectData.depositPaid) : null}</Field>
                    {(projectData.quotedAmount > 0 || projectData.depositPaid > 0) && (() => {
                      const settled = projectData.invoiced && parseFloat(projectData.invoiceAmount) > 0
                      const balance = projectData.quotedAmount - projectData.depositPaid
                      return (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <span className="text-sm font-medium text-gray-600">Balance Due</span>
                          <span className={`text-sm font-semibold ${settled ? 'text-gray-400' : balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {settled ? '—' : formatCurrency(balance)}
                          </span>
                        </div>
                      )
                    })()}
                    {projectData.invoiced && (
                      <div className="pt-2 border-t border-gray-200 flex flex-col gap-2">
                        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 self-start">✓ Invoiced</span>
                        <Field label="Final Invoice Amount">{projectData.invoiceAmount > 0 ? formatCurrency(projectData.invoiceAmount) : null}</Field>
                        <Field label="Invoice #">{projectData.invoiceNumber}</Field>
                      </div>
                    )}
                  </div>

                  {/* Images — read-only in view mode */}
                  {currentProjectId && (
                    <ImageGallery
                      projectId={currentProjectId}
                      images={images}
                      onImagesChange={() => {}}
                      readOnly
                    />
                  )}
                </div>
              </div>
            )
          )}

          {/* Subtasks — always interactive regardless of mode */}
          {!isNew && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              {detailsLoading
                ? <div className="text-xs text-gray-400 animate-pulse py-2">Loading subtasks…</div>
                : <SubtaskList
                    projectId={currentProjectId}
                    subtasks={subtasks}
                    onSubtasksChange={isEditing
                      ? (updated) => { setSubtasks(updated); setMediaChanged(true) }
                      : saveSubtasksNow
                    }
                  />
              }
            </div>
          )}

          {/* Deposit overdue warning */}
          {!isNew && watch('stage') === 'Deposit Received' && daysSince(projects.find(p => p.projectId === currentProjectId)?.lastUpdated) >= 10 && (
            <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
              <span className="text-lg leading-none">⚠️</span>
              <span>This project had a deposit received over 10 days ago. Please provide an update.</span>
            </div>
          )}

          {/* Actions — only shown in edit mode (or for new projects) */}
          {(isNew || isEditing) && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <div>
                {!isNew && (
                  <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                    Delete Project
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={isNew ? handleClose : handleCancelEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit(onSubmit)} disabled={saving || (!isNew && !isDirty && !mediaChanged)}>
                  {saving ? 'Saving…' : isNew ? 'Create Project' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message="This will permanently delete the project, all subtasks, and all attached images. This cannot be undone."
      />

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={onClose}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        confirmLabel="Close Without Saving"
        confirmVariant="danger"
        cancelLabel="Return to Edit"
      />

      <InactiveConfirmDialog
        open={inactiveConfirmOpen}
        onClose={() => setInactiveConfirmOpen(false)}
        onConfirm={handleInactiveConfirm}
      />
    </>
  )
}
