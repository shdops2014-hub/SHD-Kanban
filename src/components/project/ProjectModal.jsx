import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import SubtaskList from './SubtaskList'
import ImageGallery from './ImageGallery'
import ConfirmDialog from '../ui/ConfirmDialog'
import { STAGES, PROJECT_TYPES } from '../../utils/constants'
import { fetchProject } from '../../api/sheetsApi'
import { formatCurrency } from '../../utils/formatters'
import useStore from '../../store/useStore'

const STAGE_OPTIONS = STAGES.map(s => ({ value: s, label: s }))

export default function ProjectModal({ projectId, open, onClose, defaultStage }) {
  const { addProject, editProject, removeProject, projects } = useStore()

  const isNew = !projectId

  const { register, handleSubmit, watch, reset, getValues, formState: { errors, isDirty } } = useForm()
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [subtasks, setSubtasks] = useState([])
  const [images, setImages] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState(null)

  const quotedAmount = parseFloat(watch('quotedAmount')) || 0
  const depositPaid = parseFloat(watch('depositPaid')) || 0
  const balanceDue = quotedAmount - depositPaid

  const resetFormFromProject = (p) => {
    reset({
      projectTitle: p.projectTitle || '',
      customerName: p.customerName || '',
      phone: p.phone || '',
      email: p.email || '',
      projectType: p.projectType || '',
      stage: p.stage || STAGES[0],
      description: p.description || '',
      notes: p.notes || '',
      quotedAmount: p.quotedAmount || '',
      depositPaid: p.depositPaid || '',
      dateReceived: p.dateReceived || '',
      startDate: p.startDate || '',
      targetDate: p.targetDate || '',
    })
  }

  // Load existing project data
  useEffect(() => {
    if (!open) return
    if (isNew) {
      reset({ stage: defaultStage || STAGES[0] })
      setSubtasks([])
      setImages([])
      setCurrentProjectId(null)
      return
    }

    // 1. Pre-fill form instantly from store cache
    const cached = projects.find(p => p.projectId === projectId)
    if (cached) {
      resetFormFromProject(cached)
      setCurrentProjectId(cached.projectId)
    }

    // 2. Fetch full details in background for subtasks + images
    setDetailsLoading(true)
    setSubtasks([])
    setImages([])
    fetchProject(projectId)
      .then(res => {
        if (res.success) {
          const p = res.data
          resetFormFromProject(p)
          setSubtasks(p.subtasks || [])
          setImages(p.images || [])
          setCurrentProjectId(p.projectId)
        }
      })
      .catch(() => toast.error('Failed to load project details'))
      .finally(() => setDetailsLoading(false))
  }, [open, projectId, isNew])

  const onSubmit = async (data) => {
    setSaving(true)
    if (isNew) {
      // Optimistic create: close immediately, sync in background
      onClose()
      toast.success('Project created!')
      addProject(data).catch((e) => toast.error(e.message || 'Failed to save project'))
      setSaving(false)
    } else {
      try {
        await editProject(currentProjectId, data)
        toast.success('Project saved!')
        onClose()
      } catch (e) {
        toast.error(e.message || 'Save failed')
      }
      setSaving(false)
    }
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
        <form onSubmit={handleSubmit(onSubmit)}>
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
                        const valid = /^[^\s@]+@[^\s@]+\.(com|net|org|edu|gov|io|co|biz|info)$/i.test(v.trim())
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
                  {...register('stage')}
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
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-4">
                {/* Dates */}
                <Input label="Date Received" type="date" {...register('dateReceived')} />
                <Input label="Start Date" type="date" {...register('startDate')} />
                <Input label="Target Completion" type="date" {...register('targetDate')} />

                {/* Financials */}
                <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
                  <h3 className="font-semibold text-sm text-shd-dark">Financials</h3>
                  <Input label="Quoted Amount ($)" type="number" step="0.01" placeholder="0.00" {...register('quotedAmount')} />
                  <Input label="Deposit Paid ($)" type="number" step="0.01" placeholder="0.00" {...register('depositPaid')} />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm font-medium text-gray-600">Balance Due</span>
                    <span className={`text-sm font-semibold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(balanceDue)}
                    </span>
                  </div>
                </div>

                {/* Images — show immediately once we have a projectId */}
                {!isNew && currentProjectId && (
                  <ImageGallery
                    projectId={currentProjectId}
                    images={images}
                    onImagesChange={setImages}
                  />
                )}
              </div>
            </div>

            {/* Subtasks */}
            {!isNew && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                {detailsLoading
                  ? <div className="text-xs text-gray-400 animate-pulse py-2">Loading subtasks…</div>
                  : <SubtaskList
                      projectId={currentProjectId}
                      subtasks={subtasks}
                      onSubtasksChange={setSubtasks}
                    />
                }
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
                <Button type="submit" disabled={saving || (!isNew && !isDirty)}>
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
    </>
  )
}
