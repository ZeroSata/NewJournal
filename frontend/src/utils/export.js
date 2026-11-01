/**
 * Клиентский экспорт данных: расписание в iCalendar (.ics),
 * оценки в CSV (с BOM, чтобы Excel открывал кириллицу).
 */

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** «2026-10-30» + «09:00» → «20261030T090000» (плавающее локальное время) */
function icsStamp(dateISO, hhmm, fallbackMinutes) {
  const d = dateISO.replace(/-/g, '')
  const t = String(hhmm || '').split(':')
  const h = t[0]?.padStart(2, '0') ?? '00'
  const m = t[1]?.padStart(2, '0') ?? '00'
  return `${d}T${h}${m}00`
}

function icsEscape(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/**
 * Экспорт списка пар (ответы /schedule/operations/*) в .ics.
 * @param {Array} lessons  пары с полями date, started_at, finished_at, subject_name, room_name, teacher_name
 * @param {string} filename имя файла
 */
export function exportScheduleICS(lessons, filename = 'schedule.ics') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Journal React//Schedule//RU',
    'CALSCALE:GREGORIAN',
  ]
  let n = 0
  for (const l of Array.isArray(lessons) ? lessons : []) {
    if (!l?.date || !l?.started_at) continue
    n += 1
    lines.push(
      'BEGIN:VEVENT',
      `UID:journal-react-${l.date}-${l.started_at}-${n}@local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(l.date, l.started_at)}`,
      `DTEND:${icsStamp(l.date, l.finished_at || l.started_at)}`,
      `SUMMARY:${icsEscape(l.subject_name || 'Занятие')}`,
      `LOCATION:${icsEscape(l.room_name || '')}`,
      `DESCRIPTION:${icsEscape(l.teacher_name || '')}`,
      'END:VEVENT'
    )
  }
  lines.push('END:VCALENDAR')
  downloadBlob(lines.join('\r\n'), filename, 'text/calendar;charset=utf-8')
}

function csvEscape(v) {
  const s = String(v ?? '')
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Экспорт оценок в CSV.
 * @param {Array<{date:string, subject:string, theme:string, marks:string}>} rows
 */
export function exportMarksCSV(rows, filename = 'marks.csv') {
  const header = ['Дата', 'Предмет', 'Тема занятия', 'Оценки']
  const body = (Array.isArray(rows) ? rows : []).map((r) =>
    [r.date, r.subject, r.theme, r.marks].map(csvEscape).join(';')
  )
  // BOM — без него Excel показывает кириллицу кракозябрами
  const content = '\uFEFF' + header.map(csvEscape).join(';') + '\n' + body.join('\n')
  downloadBlob(content, filename, 'text/csv;charset=utf-8')
}
