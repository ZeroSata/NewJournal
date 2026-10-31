export function todayISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toISO(d)
}

export function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Понедельник недели, к которой относится дата */
export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // 0 = понедельник
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Первый день месяца, содержащего дату */
export function startOfMonth(date = new Date()) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Последний день месяца, содержащего дату */
export function endOfMonth(date = new Date()) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

/** Целое число дней от сегодня до указанной даты (отрицательное — в прошлом) */
export function daysUntil(isoDate) {
  if (!isoDate) return null
  const target = new Date(isoDate + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target.getTime() - a.getTime()) / 86400000)
}

/** «Скоро сдавать» — осталось не больше этого числа дней */
export const DUE_SOON_DAYS = 3

/**
 * Итоговый статус ДЗ/ЛР с учётом дедлайна:
 * overdue → dueSoon → current → checking → checked
 */
export function hwBucket(item) {
  if (item.homework_stud) {
    if (item.homework_stud.mark !== null && item.homework_stud.mark !== undefined) {
      return 'checked'
    }
    return 'checking'
  }
  const left = daysUntil(item.overdue_time)
  if (left != null && left < 0) return 'overdue'
  if (left != null && left <= DUE_SOON_DAYS) return 'dueSoon'
  return 'current'
}

/** Порядок секций на странице ДЗ: просрочки → скоро сдавать → текущие → на проверке → проверено */
export const HW_BUCKETS = ['overdue', 'dueSoon', 'current', 'checking', 'checked']

/** Формат суммы в рублях */
export function money(value, locale = 'ru-RU') {
  const n = Number(value)
  if (value == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)
}

/** Статус ДЗ/ЛР для отображения */
export function hwItemStatus(item) {
  const today = todayISO()
  if (item.homework_stud) {
    if (item.homework_stud.mark !== null && item.homework_stud.mark !== undefined) {
      return { key: 'checked' }
    }
    return { key: 'checking' }
  }
  if (item.overdue_time && item.overdue_time < today) return { key: 'overdue' }
  return { key: 'current' }
}

export const HW_STATUS_KEYS = ['current', 'checking', 'checked', 'overdue']

// Серверный status-параметр для каждого статуса
export const HW_STATUS_PARAM = { overdue: 0, checked: 1, checking: 2, current: 3 }

export function uniq(list) {
  return [...new Set(list.filter(Boolean))]
}

export function normalize(s) {
  return String(s ?? '').toLowerCase()
}
