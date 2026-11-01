import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, User, Download, Paperclip } from 'lucide-react'
import { apiScheduleByDate, apiScheduleByRange, apiScheduleMonth, apiStudentExams } from '../api/endpoints'
import { useI18n } from '../i18n/I18nContext'
import { useAuth } from '../auth/AuthContext'
import { useDeadlines } from '../hooks/useDeadlines'
import { qk } from '../api/queryKeys'
import { Card, Spinner, ErrorBox, Empty, Chip } from '../components/ui'
import { startOfWeek, startOfMonth, endOfMonth, addDays, toISO, todayISO } from '../utils/format'
import { exportScheduleICS } from '../utils/export'

export default function SchedulePage() {
  const { t, locale, fmtShort } = useI18n()
  const { user } = useAuth()
  const [view, setView] = useState('week') // day | week | month
  const [date, setDate] = useState(() => todayISO()) // опорная дата
  const today = todayISO()

  // Диапазон загрузки зависит от вида
  const range = useMemo(() => {
    const d = new Date(date + 'T12:00:00')
    if (view === 'day') return { from: date, to: date }
    if (view === 'week') {
      const ws = startOfWeek(d)
      return { from: toISO(ws), to: toISO(addDays(ws, 6)) }
    }
    return { from: toISO(startOfMonth(d)), to: toISO(endOfMonth(d)) }
  }, [view, date])

  const query = useQuery({
    queryKey: view === 'day' ? qk.scheduleDay(range.from) : ['schedule', view, range.from, range.to],
    queryFn: () => {
      if (view === 'day') return apiScheduleByDate(range.from)
      if (view === 'week') return apiScheduleByRange(range.from, range.to)
      return apiScheduleMonth(range.from)
    },
  })

  // Дедлайны для вида «Месяц»: ДЗ/ЛР из лёгкого запроса + экзамены
  const deadlines = useDeadlines(view === 'month' ? user?.current_group_id : null, {
    enabled: view === 'month', refetch: false,
  })
  const exams = useQuery({
    queryKey: qk.studentExams,
    queryFn: apiStudentExams,
    staleTime: 10 * 60 * 1000,
    enabled: view === 'month',
  })

  // карта «дата → [{type, title}]» для календаря
  const deadlineByDate = useMemo(() => {
    const map = {}
    const put = (iso, entry) => {
      if (!iso) return
      ;(map[iso] ||= []).push(entry)
    }
    // только несданные работы из лёгкого запроса дедлайнов
    for (const it of deadlines.data?.items || []) {
      if (it.homework_stud) continue
      put(it.overdue_time, { type: 'hw', title: `${it.theme} · ${it.name_spec}` })
    }
    for (const e of Array.isArray(exams.data) ? exams.data : []) {
      put(e.date, { type: 'exam', title: `${e.spec || ''} · ${t('gradesExams')}` })
    }
    return map
  }, [deadlines.data, exams.data, t])

  const byDate = useMemo(() => {
    const map = {}
    for (const lesson of query.data || []) {
      ;(map[lesson.date] ||= []).push(lesson)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.lesson - b.lesson)
    }
    return map
  }, [query.data])

  const shift = (dir) => {
    const d = new Date(date + 'T12:00:00')
    if (view === 'day') d.setDate(d.getDate() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setDate(toISO(d))
  }

  const periodLabel = useMemo(() => {
    const d = new Date(date + 'T12:00:00')
    if (view === 'day') {
      return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
    }
    if (view === 'week') {
      return `${fmtShort(range.from)} — ${fmtShort(range.to)}`
    }
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
  }, [view, date, range, locale, fmtShort])

  const openDay = (iso) => {
    setDate(iso)
    setView('day')
  }

  return (
    <main className="page">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="page__title !mb-0">{t('schedTitle')}</h1>
        <div className="flex items-center gap-2">
          <Chip active={view === 'day'} onClick={() => setView('day')}>{t('schedViewDay')}</Chip>
          <Chip active={view === 'week'} onClick={() => setView('week')}>{t('schedViewWeek')}</Chip>
          <Chip active={view === 'month'} onClick={() => setView('month')}>{t('schedViewMonth')}</Chip>
        </div>
      </div>

      {/* Навигация по периоду + произвольная дата + экспорт */}
      <div className="card !py-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button className="icon-btn" onClick={() => shift(-1)} title={t('schedPrev')} aria-label={t('schedPrev')}>
            <ChevronLeft size={18} />
          </button>
          <div className="font-semibold text-sm min-w-[220px] text-center capitalize">{periodLabel}</div>
          <button className="icon-btn" onClick={() => shift(1)} title={t('schedNext')} aria-label={t('schedNext')}>
            <ChevronRight size={18} />
          </button>
          <button className="btn btn--ghost !py-2 text-sm" onClick={() => setDate(today)}>
            {t('today')}
          </button>
          <button
            className="btn btn--ghost !py-2 text-sm"
            onClick={() => exportScheduleICS(query.data || [], `schedule-${range.from}.ics`)}
            disabled={!query.data?.length}
            title={t('expSchedule')}
          >
            <Download size={15} />
            {t('expSchedule')}
          </button>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            {t('schedPickDate')}
            <input
              type="date"
              className="field !w-auto !py-1.5 text-sm"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label={t('schedPickDate')}
            />
          </label>
        </div>
      </div>

      {query.isLoading ? (
        <Spinner />
      ) : query.isError ? (
        <Card><ErrorBox onRetry={() => query.refetch()} /></Card>
      ) : view === 'day' ? (
        <DayView date={date} lessons={byDate[date] || []} today={today} locale={locale} t={t} />
      ) : view === 'week' ? (
        <WeekView days={daysOfWeek(range.from)} byDate={byDate} today={today} locale={locale} t={t} openDay={openDay} />
      ) : (
        <MonthView monthDate={date} byDate={byDate} today={today} locale={locale} t={t} openDay={openDay} deadlineByDate={deadlineByDate} />
      )}
    </main>
  )
}

function daysOfWeek(fromISO) {
  const arr = []
  for (let i = 0; i < 7; i++) arr.push(toISO(addDays(new Date(fromISO + 'T12:00:00'), i)))
  return arr
}

function LessonItem({ l, t }) {
  return (
    <div className="lesson-row">
      <div className="lesson-row__num">{l.lesson}</div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{l.subject_name}</div>
        <div className="text-xs text-muted flex items-center gap-2 truncate">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />{l.room_name}
          </span>
          <span className="inline-flex items-center gap-1 min-w-0">
            <User size={12} />{l.teacher_name}
          </span>
        </div>
      </div>
      <div className="lesson-row__time !min-w-0 text-right">
        {l.started_at}
        <br />
        {l.finished_at}
      </div>
    </div>
  )
}

function DayView({ date, lessons, today, locale, t }) {
  const d = new Date(date + 'T12:00:00')
  const wd = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d)
  return (
    <Card
      title={`${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(d)}`}
      icon={<CalendarDays size={17} />}
      actions={date === today ? <span className="tag tag--current">{t('today')}</span> : null}
    >
      {lessons.length === 0 ? (
        <Empty text={t('schedNoLessons')} icon={CalendarDays} />
      ) : (
        <div className="flex flex-col gap-2">
          {lessons.map((l, i) => <LessonItem key={i} l={l} t={t} />)}
        </div>
      )}
    </Card>
  )
}

function WeekView({ days, byDate, today, locale, t, openDay }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
      {days.map((date) => {
        const list = byDate[date] || []
        const isToday = date === today
        const wd = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(date + 'T12:00:00'))
        const dm = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(date + 'T12:00:00'))
        return (
          <div
            key={date}
            className="card cursor-pointer transition-transform hover:-translate-y-0.5"
            style={isToday ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' } : undefined}
            onClick={() => openDay(date)}
            title={t('schedClickDay')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-sm capitalize">{wd}</div>
                <div className="text-xs text-muted">{dm}</div>
              </div>
              {isToday ? (
                <span className="tag tag--current">{t('today')}</span>
              ) : list.length > 0 ? (
                <span className="tag tag--mark">{t('schedLessonsCount', { n: list.length })}</span>
              ) : null}
            </div>
            {list.length === 0 ? (
              <Empty text={t('schedNoLessons')} icon={CalendarDays} />
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((l, i) => (
                  <div key={i} className="lesson-row !py-2">
                    <div className="lesson-row__time !min-w-[92px]">{l.started_at}–{l.finished_at}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{l.subject_name}</div>
                      <div className="text-xs text-muted truncate">{l.room_name} · {l.teacher_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MonthView({ monthDate, byDate, today, locale, t, openDay, deadlineByDate = {} }) {
  const d = new Date(monthDate + 'T12:00:00')
  // Сетка с понедельника недели, содержащей 1-е число (6 недель)
  const gridStart = startOfWeek(startOfMonth(d))
  const cells = []
  for (let i = 0; i < 42; i++) cells.push(toISO(addDays(gridStart, i)))
  const monthNum = d.getMonth()
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    // 2 октября 2023 — понедельник
    return [2, 3, 4, 5, 6, 7, 8].map((day) => fmt.format(new Date(2023, 9, day)))
  }, [locale])

  return (
    <Card>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {weekdays.map((w, i) => (
          <div key={i} className="text-center text-xs font-bold text-muted uppercase py-1">{w}</div>
        ))}
        {cells.map((iso) => {
          const cd = new Date(iso + 'T12:00:00')
          const inMonth = cd.getMonth() === monthNum
          const list = byDate[iso] || []
          const dl = deadlineByDate[iso] || []
          const isToday = iso === today
          return (
            <button
              key={iso}
              onClick={() => openDay(iso)}
              className="min-h-[72px] rounded-xl border p-1.5 text-left transition-colors flex flex-col gap-1"
              style={{
                borderColor: isToday ? 'var(--accent)' : 'var(--border)',
                background: isToday ? 'var(--accent-soft)' : inMonth ? 'var(--surface)' : 'transparent',
                opacity: inMonth ? 1 : 0.45,
                cursor: 'pointer',
                boxShadow: isToday ? '0 0 0 2px var(--accent-soft)' : undefined,
              }}
              title={[
                ...list.slice(0, 3).map((l) => `${l.started_at} ${l.subject_name}`),
                ...dl.slice(0, 4).map((e) => `${t('calDeadlines')}: ${e.title}`),
              ].join('\n')}
            >
              <div className="text-xs font-bold" style={{ color: isToday ? 'var(--accent)' : 'inherit' }}>
                {cd.getDate()}
              </div>
              {list.length > 0 && (
                <>
                  <div className="flex gap-0.5 flex-wrap">
                    {list.slice(0, 3).map((l, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                    ))}
                  </div>
                  <div className="text-[10px] text-muted leading-tight">
                    {t('schedLessonsCount', { n: list.length })}
                  </div>
                </>
              )}
              {/* Дедлайны: ДЗ/ЛР — скрепка, экзамен — шапочка */}
              {dl.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {dl.slice(0, 3).map((e, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-0.5 rounded-md px-1"
                      style={{
                        background: e.type === 'exam' ? 'var(--info-soft)' : 'var(--warning-soft)',
                        color: e.type === 'exam' ? 'var(--info)' : 'var(--warning)',
                        fontSize: 9,
                        fontWeight: 700,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Paperclip size={8} />
                      {e.type === 'exam' ? t('calExamDeadline') : t('calHwDeadline')}
                    </span>
                  ))}
                  {dl.length > 3 && <span className="text-[9px] text-muted">+{dl.length - 3}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} /> {t('schedLesson')}
        </span>
        <span className="inline-flex items-center gap-1">
          <Paperclip size={10} style={{ color: 'var(--warning)' }} /> {t('calHwDeadline')}/{t('calLabDeadline')}
        </span>
        <span className="inline-flex items-center gap-1">
          <GraduationCapIcon /> {t('calExamDeadline')}
        </span>
      </div>
      <p className="text-xs text-muted mt-2 mb-0 text-center">{t('schedClickDay')}</p>
    </Card>
  )
}

function GraduationCapIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    </svg>
  )
}
