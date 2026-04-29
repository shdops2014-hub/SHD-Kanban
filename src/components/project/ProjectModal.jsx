import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import SubtaskList from './SubtaskList'
import ImageGallery from './ImageGallery'
import ConfirmDialog from '../ui/ConfirmDialog'
import InactiveConfirmDialog from './InactiveConfirmDialog'
import ProjectFormSkeleton from './ProjectFormSkeleton'
import { STAGES, STAGE_ORDER, PROJECT_TYPES } from '../../utils/constants'
import { fetchProject, createSubtask as createSubtaskApi, updateSubtask as updateSubtaskApi, deleteSubtask as deleteSubtaskApi } from '../../api/sheetsApi'
import { formatCurrency, toDateValue } from '../../utils/formatters'
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

export default function ProjectModal({ projectId, open, onClose, defaultStage }) {
  const { addProject, editProject, removeProject, projects, projectCache, cacheProjectDetails, patchProject } = useStore()

  const isNew = !projectId

  const { register, handleSubmit, watch, reset, getValues, setValue, formState: { errors, isDirty } } = useForm()
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [subtasks, setSubtasks] = useState([])
  const [images, setImages] = useState([])
  const [mediaChanged, setMediaChanged] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  const resetFormFromProject = (p) => {
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
          // Always update the original ref with fresh DB state for diffing on save.
          // Only update displayed data when there was no cache — with a cache the
          // user may have already started editing and we must not override their changes.
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

  const onSubmit = async (data) => {
    // Belt-and-suspenders: if invoiced is checked, invoice # must be present
    if (data.invoiced && !data.invoiceNumber?.trim()) {
      toast.error('Invoice # is required when Invoiced is checked')
      return
    }
    setSaving(true)
    // Auto-advance stage based on financials (never moves backward)
    const resolvedStage = autoStage(data, data.stage || STAGES[0])
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

        // Merge saved payload into the detail cache so the next re-open doesn't
        // show stale values (e.g. invoiceNumber, stage) from a pre-save prefetch.
        const existingCache = projectCache[currentProjectId]
        if (existingCache) {
          cacheProjectDetails(currentProjectId, { ...existingCache, ...payload })
        }

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

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isNew ? 'New Project' : 'Project Details'}
        wide
      >
        <form onSubmit={(e) => e.preventDefault()}>
            {/* Show skeleton until cache pre-fill has run for existing projects */}
            {!isNew && !currentProjectId ? (
              <ProjectFormSkeleton />
            ) : (
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
                        // Strip non-numeric characters as user types
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
                {/* Dates */}
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
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm font-medium text-gray-600">Balance Due</span>
                    <span className={`text-sm font-semibold ${quotedAmount === 0 && depositPaid === 0 ? 'text-gray-400' : balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {quotedAmount === 0 && depositPaid === 0 ? '—' : formatCurrency(balanceDue)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                    <input
                      type="checkbox"
                      id="invoiced"
                      className="accent-shd-brown w-4 h-4 cursor-pointer"
                      {...register('invoiced')}
                    />
                    <label htmlFor="invoiced" className="text-sm font-medium text-gray-600 cursor-pointer select-none">
                      Invoiced
                    </label>
                  </div>

                  {invoiced && (
                    <>
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
                          required: 'Invoice # is required when invoiced',
                        })}
                      />
                    </>
                  )}
                </div>

                {/* Images */}
                {!isNew && currentProjectId && (() => {
                  const cachedCount = projects.find(p => p.projectId === currentProjectId)?.imageCount ?? 0
                  // Only show skeleton if we know images exist — otherwise go straight to empty upload state
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
            )} {/* end skeleton conditional */}

            {/* Subtasks */}
            {!isNew && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                {detailsLoading
                  ? <div className="text-xs text-gray-400 animate-pulse py-2">Loading subtasks…</div>
                  : <SubtaskList
                      projectId={currentProjectId}
                      subtasks={subtasks}
                      onSubtasksChange={(updated) => { setSubtasks(updated); setMediaChanged(true) }}
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

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <div>
                {!isNew && (
                  <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                    Delete Project
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit(onSubmit)} disabled={saving || (!isNew && !isDirty && !mediaChanged)}>
                  {saving ? 'Saving…' : isNew ? 'Create Project' : 'Save Changes'}
                </Button>
              </div>
            </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message="This will permanently delete the project, all subtasks, and all attached images. This cannot be undone."
      />

      <InactiveConfirmDialog
        open={inactiveConfirmOpen}
        onClose={() => setInactiveConfirmOpen(false)}
        onConfirm={handleInactiveConfirm}
      />
    </>
  )
}
