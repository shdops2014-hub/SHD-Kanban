import dayjs from 'dayjs'

export const formatCurrency = (val) => {
  const num = parseFloat(val)
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

export const formatDate = (val) => {
  if (!val) return '—'
  return dayjs(val).format('MMM D, YYYY')
}

// Normalize any date value to YYYY-MM-DD for use in <input type="date">.
// Handles ISO strings ("2026-04-25T00:00:00.000Z"), plain strings, and Date objects.
export const toDateValue = (val) => {
  if (!val) return ''
  const s = String(val)
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

export const formatPhone = (val) => {
  if (!val) return '—'
  const digits = val.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return val
}
