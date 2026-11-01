import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck2, CheckCircle2, XCircle, AlarmClock, ListChecks } from 'lucide-react'
import {
  apiAttendanceStatistic, apiAttendanceChart, apiStudentVisits,
} from '../api/endpoints'
import { MARK_FIELDS } from '../api/constants'
import { qk } from '../api/queryKeys'
import { useI18n } from '../i18n/I18nContext'
import { Card, StatCard, Spinner, ErrorBox, Empty, Chip, SearchInput, MarkPill, CardSkeleton } from '../components/ui'
import { AttendanceTrendChart } from '../components/charts'

/**
 * Посещаемость — отдельная вкладка (v1.2).
 * Данные: /dashboard/progress/attendance-statistic (проценты),
 * /dashboard/chart/attendance (линейный график по месяцам),
 * /progress/operations/student-visits (полная история занятий).
 *
 * status_was: 1 = был, 0 = не был, 2 = опоздание, null = нет отметки.
 * Формула процента сверена с оригинальным сайтом (2026-11-01):
 * опоздание считается как «был», процент = (был + опоздание) / все занятия.
 * По этой формуле API даёт statTotal = 94% (1519+16 из 1629 = 94.23%),
 * тогда как «был / все» даёт 93% — расхождение с оригиналом.
 */
export default function AttendancePage() {
  const { t, locale } = useI18n()

  const stat = useQuery({ queryKey: qk.attendanceStatistic, queryFn: apiAttendanceStatistic })
  const chart = useQuery({ queryKey: qk.chartAttendance, queryFn: apiAttendanceChart, staleTime: 10 * 60 * 1000 })
  const visits = useQuery({ queryKey: qk.studentVisits, queryFn: apiStudentVisits, staleTime: 10 * 60 * 1000 })

  const [subject, setSubject] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(60)

  const rows = useMemo(() => (Array.isArray(visits.data) ? visits.data : []), [visits.data])

  // Занятия с проставленной посещаемостью (без null — это будущие/без отметки)
  const marked = useMemo(() => rows.filter((r) => r.status_was != null), [rows])

  const totals = useMemo(() => {
    const c = { was: 0, absent: 0, late: 0 }
    for (const r of marked) {
      if (r.status_was === 1) c.was += 1
      else if (r.status_was === 0) c.absent += 1
      else if (r.status_was === 2) c.late += 1
    }
    c.total = c.was + c.absent + c.late
    // как на оригинальном сайте: опоздание приравнивается к «был»
    c.percent = c.total ? Math.round(((c.was + c.late) / c.total) * 100) : null
    return c
  }, [marked])

  // доля занятия в процентах (для карточек «Не был»/«Опоздание»)
  const share = (n) => (totals.total ? Math.round((n / totals.total) * 100) : 0)

  // График по месяцам — формат как у AttendanceTrendChart: [{label, value}]
  // Месяцы без данных (points = null: каникулы, текущий месяц) убираем,
  // иначе линия графика обрывается задолго до конца оси
  const chartData = useMemo(() => {
    const list = Array.isArray(chart.data) ? chart.data : []
    return list
      .filter((d) => d.points != null)
      .map((d) => ({
        label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(d.date + 'T12:00:00')),
        value: d.points,
      }))
  }, [chart.data, locale])

  // Сводка по предметам
  const bySubject = useMemo(() => {
    const map = new Map()
    for (const r of marked) {
      const key = r.spec_name || '—'
      if (!map.has(key)) map.set(key, { name: key, was: 0, absent: 0, late: 0 })
      const s = map.get(key)
      if (r.status_was === 1) s.was += 1
      else if (r.status_was === 0) s.absent += 1
      else if (r.status_was === 2) s.late += 1
    }
    return [...map.values()]
      .map((s) => ({ ...s, total: s.was + s.absent + s.late, percent: Math.round(((s.was + s.late) / (s.was + s.absent + s.late)) * 100) }))
      .sort((a, b) => b.percent - a.percent)
  }, [marked])

  // Список предметов для фильтра (по алфавиту)
  const subjectNames = useMemo(
    () => bySubject.map((s) => s.name).sort((a, b) => a.localeCompare(b)),
    [bySubject]
  )

  // История с фильтрами
  const history = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (subject !== 'all' && (r.spec_name || '—') !== subject) return false
        if (statusFilter === 'was' && r.status_was !== 1) return false
        if (statusFilter === 'absent' && r.status_was !== 0) return false
        if (statusFilter === 'late' && r.status_was !== 2) return false
        if (q && !(`${r.spec_name} ${r.lesson_theme} ${r.teacher_name}`.toLowerCase().includes(q))) return false
        return true
      })
      .slice()
      .sort((a, b) => String(b.date_visit).localeCompare(String(a.date_visit)) || (a.lesson_number ?? 0) - (b.lesson_number ?? 0))
  }, [rows, subject, statusFilter, search])

  const statusTag = (sw) =>
    sw === 1 ? { label: t('attWas'), cls: 'tag--checked' }
      : sw === 0 ? { label: t('attAbsent'), cls: 'tag--overdue' }
        : { label: t('attLate'), cls: 'tag--checking' }

  return (
    <main className="page">
      <h1 className="page__title">{t('attTitle')}</h1>
      <p className="page__subtitle">{t('attSubtitle')}</p>

      {/* Итоги */}
      <div className="stats-grid mb-4">
        <StatCard
          icon={<CalendarCheck2 size={19} style={{ color: 'var(--info)' }} />}
          tone="info"
          value={visits.isLoading ? '—' : totals.percent != null ? `${totals.percent}%` : '—'}
          label={t('dashAttendance')}
          delta={stat.data ? `${stat.data.statWeek}% ${t('dashAttendanceWeek')} · ${stat.data.statMonth}% ${t('dashAttendanceMonth')}` : ''}
        />
        <StatCard
          icon={<CheckCircle2 size={19} style={{ color: 'var(--success)' }} />}
          tone="success"
          value={visits.isLoading ? '—' : totals.was}
          label={t('attWas')}
          delta={`${t('attTotal')}: ${visits.isLoading ? '—' : totals.total}`}
        />
        <StatCard
          icon={<XCircle size={19} style={{ color: 'var(--danger)' }} />}
          tone="danger"
          value={visits.isLoading ? '—' : totals.absent}
          label={t('attAbsent')}
          delta={`${share(totals.absent)}% ${t('attOfLessons')}`}
        />
        <StatCard
          icon={<AlarmClock size={19} style={{ color: 'var(--warning)' }} />}
          tone="warning"
          value={visits.isLoading ? '—' : totals.late}
          label={t('attLate')}
          delta={`${share(totals.late)}% ${t('attOfLessons')}`}
        />
      </div>

      {/* График по месяцам */}
      <Card title={t('dashTrendAttendance')} icon={<CalendarCheck2 size={17} />} className="mb-4">
        {chart.isLoading ? (
          <CardSkeleton />
        ) : chart.isError ? (
          <ErrorBox onRetry={() => chart.refetch()} />
        ) : chartData.length ? (
          <AttendanceTrendChart data={chartData} />
        ) : (
          <Empty text={t('noData')} />
        )}
      </Card>

      {/* По предметам */}
      <Card title={t('attBySubject')} icon={<ListChecks size={17} />} className="mb-4">
        {visits.isLoading ? (
          <CardSkeleton />
        ) : visits.isError ? (
          <ErrorBox onRetry={() => visits.refetch()} />
        ) : bySubject.length === 0 ? (
          <Empty text={t('attNoEvents')} icon={CalendarCheck2} />
        ) : (
          <div className="table-scroll">
            <table className="marks-table">
              <thead>
                <tr>
                  <th>{t('attSubject')}</th>
                  <th>{t('attWas')}</th>
                  <th>{t('attAbsent')}</th>
                  <th>{t('attLate')}</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {bySubject.map((s) => (
                  <tr key={s.name}>
                    <td className="font-semibold">{s.name}</td>
                    <td style={{ color: 'var(--success)' }}>{s.was}</td>
                    <td style={{ color: 'var(--danger)' }}>{s.absent}</td>
                    <td style={{ color: 'var(--warning)' }}>{s.late}</td>
                    <td>
                      <span
                        className="tag"
                        style={{
                          background: s.percent >= 80 ? 'var(--success-soft)' : s.percent >= 60 ? 'var(--warning-soft)' : 'var(--danger-soft)',
                          color: s.percent >= 80 ? 'var(--success)' : s.percent >= 60 ? 'var(--warning)' : 'var(--danger)',
                        }}
                      >
                        {s.percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* История занятий */}
      <Card title={t('attHistory')} icon={<CalendarCheck2 size={17} />}>
        <div className="flex flex-col gap-3 mb-3">
          <SearchInput value={search} onChange={setSearch} placeholder={t('attSearchPh')} />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="field !w-auto !py-1.5 text-sm"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setLimit(60) }}
              aria-label={t('attSubject')}
            >
              <option value="all">{t('attAllSubjects')}</option>
              {subjectNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <Chip active={statusFilter === 'all'} onClick={() => { setStatusFilter('all'); setLimit(60) }}>{t('attAllStatuses')}</Chip>
            <Chip active={statusFilter === 'was'} onClick={() => { setStatusFilter('was'); setLimit(60) }}>{t('attWas')}</Chip>
            <Chip active={statusFilter === 'absent'} onClick={() => { setStatusFilter('absent'); setLimit(60) }}>{t('attAbsent')}</Chip>
            <Chip active={statusFilter === 'late'} onClick={() => { setStatusFilter('late'); setLimit(60) }}>{t('attLate')}</Chip>
          </div>
        </div>

        {visits.isLoading ? (
          <Spinner />
        ) : visits.isError ? (
          <ErrorBox onRetry={() => visits.refetch()} />
        ) : history.length === 0 ? (
          <Empty text={t('attNoEvents')} icon={CalendarCheck2} />
        ) : (
          <>
            <div className="text-xs text-muted mb-2">
              {t('hwShown')} <b>{Math.min(limit, history.length)}</b> {t('hwOfLoaded')} {history.length}
            </div>
            <div className="flex flex-col gap-2">
              {history.slice(0, limit).map((r, i) => {
                const st = statusTag(r.status_was)
                return (
                  <div key={i} className="lesson-row !items-center">
                    <div className="lesson-row__num" style={{ fontSize: 11 }}>{r.lesson_number ?? '—'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{r.spec_name}</div>
                      <div className="text-xs text-muted truncate">
                        {r.date_visit}{r.lesson_theme ? ` · ${r.lesson_theme}` : ''}{r.teacher_name ? ` · ${r.teacher_name}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end items-center">
                      {MARK_FIELDS.filter((f) => r[f.key] != null).map((f) => (
                        <MarkPill key={f.key} mark={r[f.key]} />
                      ))}
                      <span className={`tag ${st.cls}`}>{st.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {history.length > limit && (
              <div className="flex justify-center mt-4">
                <button className="btn btn--ghost" onClick={() => setLimit((l) => l + 60)}>
                  {t('hwLoadMore')}
                  <CalendarCheck2 size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </main>
  )
}
