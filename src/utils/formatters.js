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

export const formatPhone = (val) => {
  if (!val) return '—'
  const digits = val.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return val
}
