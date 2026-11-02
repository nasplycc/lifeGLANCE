import {
  differenceInYears,
  differenceInMonths,
  differenceInDays,
  format,
  isPast,
} from 'date-fns'

// Returns the age (in whole years) at a given date, or null if birthday not set
// or the target date precedes the birthday.
export function ageAtDate(birthdayStr, targetDateStr) {
  if (!birthdayStr || !targetDateStr) return null
  const born   = new Date(birthdayStr)
  const target = new Date(targetDateStr)
  if (isNaN(born.getTime()) || isNaN(target.getTime())) return null
  if (target < born) return null
  return differenceInYears(target, born)
}

// Converts a UTC-midnight ISO date string to a local Date at noon on the same
// calendar date, so date-fns comparisons use the intended day regardless of
// the user's UTC offset.
function toLocalNoon(dateStr) {
  const d = new Date(dateStr)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)
}

export function relativeLabel(dateStr, precision = 'day') {
  const date = toLocalNoon(dateStr)
  const now  = new Date()
  const past = isPast(date) && date < now

  if (past) {
    const years  = differenceInYears(now, date)
    const months = differenceInMonths(now, date) % 12
    const days   = differenceInDays(now, date)
    if (years > 0 && months > 0) return `${years}年${months}个月前`
    if (years > 0)               return `${years}年前`
    if (days > 30)               return `${Math.floor(days / 30)}个月前`
    if (days > 0)                return `${days}天前`
    return '今天'
  } else {
    const years  = differenceInYears(date, now)
    const months = differenceInMonths(date, now) % 12
    const days   = differenceInDays(date, now)
    if (years > 0 && months > 0) return `还有${years}年${months}个月`
    if (years > 0)               return `还有${years}年`
    if (days > 30)               return `还有${Math.floor(days / 30)}个月`
    if (days >= 0)               return `还有${days}天`
    return '今天'
  }
}

export function formatDateDisplay(dateStr, precision = 'day') {
  const date = toLocalNoon(dateStr)
  if (precision === 'year')  return format(date, 'yyyy')
  if (precision === 'month') return format(date, 'yyyy年M月')
  return format(date, 'yyyy年M月d日')
}

// Returns { years, months } elapsed/remaining for count-up animation
export function getYearsMonths(dateStr) {
  const date = toLocalNoon(dateStr)
  const now  = new Date()
  const past = date < now
  const a = past ? date : now
  const b = past ? now  : date
  return {
    years:  differenceInYears(b, a),
    months: differenceInMonths(b, a) % 12,
    days:   differenceInDays(b, a),
    past,
  }
}

export function buildDateFromParts(month, year, precision, day) {
  const y = Number(year)
  const m = Number(month) - 1
  if (precision === 'year')  return new Date(Date.UTC(y, 0, 1))
  if (precision === 'day')   return new Date(Date.UTC(y, m, Number(day) || 1))
  return new Date(Date.UTC(y, m, 15)) // month precision — use midpoint
}
