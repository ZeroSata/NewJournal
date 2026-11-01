import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, ListChecks, GraduationCap, CalendarCheck, Download, Calculator } from 'lucide-react'
import { apiStudentVisits, apiStudentExams, apiAcademicPerformance, apiQuarterlyGrades } from '../api/endpoints'
import { MARK_FIELDS } from '../api/constants'
import { qk } from '../api/queryKeys'
import { useI18n } from '../i18n/I18nContext'
import { Card, Spinner, ErrorBox, Empty, Chip, MarkPill } from '../components/ui'
import { SubjectAverageChart, MarksDistributionChart } from '../components/charts'
import { exportMarksCSV } from '../utils/export'
import { fmtShortDate } from '../utils/format'

export default function GradesPage() {
  const { t, fmtShort } = useI18n()
  const [subject, setSubject] = useState('all')
  const [visible, setVisible] = useState(25)

  const visits = useQuery({ queryKey: qk.studentVisits, queryFn: apiStudentVisits, staleTime: 5 * 60 * 1000 })
  const exams = useQuery({ queryKey: qk.studentExams, queryFn: apiStudentExams, staleTime: 10 * 60 * 1000 })
  const perf = useQuery({ queryKey: qk.academicPerformance, queryFn: apiAcademicPerformance })
  const quarterly = useQuery({ queryKey: qk.quarterlyGrades, queryFn: apiQuarterlyGrades, staleTime: 30 * 60 * 1000, retry: 0 })

  const marked = useMemo(
    () => (visits.data || []).filter((v) => MARK_FIELDS.some((f) => v[f.key] != null)),
    [visits.data]
  )

  const subjects = useMemo(() => {
    const set = new Set(marked.map((v) => v.spec_name).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [marked])

  const filtered = useMemo(
    () => (subject === 'all' ? marked : marked.filter((v) => v.spec_name === subject)),
    [marked, subject]
  )

  const subjectAverages = useMemo(() => {
    const acc = {}
    for (const v of filtered) {
      for (const f of MARK_FIELDS) {
        const m = v[f.key]
        if (m == null) continue
        ;(acc[v.spec_name] ||= { sum: 0, n: 0 })
        acc[v.spec_name].sum += Number(m)
        acc[v.spec_name].n += 1
      }
    }
    return Object.entries(acc)
      .map(([label, { sum, n }]) => ({ label, value: Number((sum / n).toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const distribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const v of filtered) {
      for (const f of MARK_FIELDS) {
        const raw = v[f.key]
        if (raw == null || raw === '') continue
        const m = Number(raw)
        if (Number.isNaN(m)) continue
        const key = Math.min(Math.max(Math.round(m), 1), 5)
        counts[key] += 1
      }
    }
    return [5, 4, 3, 2, 1].map((label) => ({ label, value: counts[label] }))
  }, [filtered])

  const attendance = useMemo(() => {
    let present = 0
    let absent = 0
    let late = 0
    for (const v of visits.data || []) {
      if (v.status_was === 1) present += 1
      else if (v.status_was === 0) absent += 1
      else if (v.status_was === 2) late += 1
    }
    const total = present + absent + late
    // как на оригинальном сайте: опоздание приравнивается к «был»
    return { present, absent, late, total, percent: total ? Math.round(((present + late) / total) * 100) : null }
  }, [visits.data])

  const recent = useMemo(
    () =>
      filtered
        .slice()
        .sort((a, b) => String(b.date_visit).localeCompare(String(a.date_visit)))
        .slice(0, visible),
    [filtered, visible]
  )

  // ── Калькулятор среднего балла «что если» ─────────────────────────────────
  const allMarks = useMemo(() => {
    let sum = 0
    let n = 0
    for (const v of marked) {
      for (const f of MARK_FIELDS) {
        const m = v[f.key]
        if (m == null || m === '') continue
        const num = Number(m)
        if (Number.isNaN(num)) continue
        sum += num
        n += 1
      }
    }
    return { sum, n, avg: n ? sum / n : null }
  }, [marked])

  const [target, setTarget] = useState('4.5')
  const [planMark, setPlanMark] = useState('5')

  const whatIf = useMemo(() => {
    const tgt = Number(target)
    const m = Number(planMark)
    if (!Number.isFinite(tgt) || tgt <= 0 || tgt > 5 || !Number.isFinite(m)) return null
    const { sum, n } = allMarks
    if (!n) return null
    if (sum / n >= tgt) return { state: 'done', needed: 0 }
    if (m <= tgt) return { state: 'impossible' }
    // (sum + m*k) / (n + k) >= tgt  →  k >= (tgt*n - sum) / (m - tgt)
    const k = Math.max(0, Math.ceil((tgt * n - sum) / (m - tgt) - 1e-9))
    return { state: 'ok', needed: k }
  }, [target, planMark, allMarks])

  const handleExportCSV = () => {
    exportMarksCSV(
      recent.map((v) => ({
        date: fmtShortDate(v.date_visit),
        subject: v.spec_name || '',
        theme: v.lesson_theme || '',
        marks: MARK_FIELDS.filter((f) => v[f.key] != null).map((f) => v[f.key]).join(', '),
      })),
      `marks-${subject === 'all' ? 'all' : subject}.csv`
    )
  }

  if (visits.isLoading) {
    return (
      <main className="page">
        <h1 className="page__title">{t('gradesTitle')}</h1>
        <Spinner />
      </main>
    )
  }

  return (
    <main className="page">
      <h1 className="page__title">{t('gradesTitle')}</h1>
      <p className="page__subtitle">
        {visits.data?.length && attendance.percent != null
          ? `${t('gradesVisited')}: ${attendance.percent}% (${attendance.present + attendance.late}/${attendance.total})`
          : ''}
      </p>

      {visits.isError ? (
        <Card><ErrorBox onRetry={() => visits.refetch()} /></Card>
      ) : (
        <>
          <div className="grid-2 mb-4">
            <Card title={t('gradesAvgSubject')} icon={<BarChart3 size={17} />}>
              {subjectAverages.length ? (
                <SubjectAverageChart data={subjectAverages} />
              ) : (
                <Empty text={t('gradesNoMarks')} />
              )}
            </Card>
            <Card title={t('gradesDistributionFull')} icon={<BarChart3 size={17} />}>
              {subjectAverages.length ? (
                <MarksDistributionChart data={distribution} />
              ) : (
                <Empty text={t('gradesNoMarks')} />
              )}
            </Card>
          </div>

          {perf.data?.progress && (
            <Card title={t('gradesByCategory')} icon={<ListChecks size={17} />} className="mb-4">
              <div className="flex flex-wrap gap-2">
                {Object.entries(perf.data.progress).map(([k, v]) => (
                  <span key={k} className={`chip !cursor-default ${k === 'total' ? 'is-active' : ''}`}>
                    {t(`marks.${k}`)}: <b className="ml-1">{v}</b>
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Четвертные (периодические) оценки */}
          <Card title={t('gradesQuarterly')} icon={<CalendarCheck size={17} />} className="mb-4">
            {quarterly.isLoading ? (
              <Spinner />
            ) : quarterly.isError ? (
              <ErrorBox onRetry={() => quarterly.refetch()} />
            ) : !quarterly.data?.grades?.length ? (
              <Empty text={t('gradesQuarterlyEmpty')} icon={CalendarCheck} />
            ) : (
              <QuarterlyTable grades={quarterly.data.grades} t={t} />
            )}
          </Card>

          {/* Калькулятор среднего балла */}
          {allMarks.n > 0 && (
            <Card title={t('gradesWhatIf')} icon={<Calculator size={17} />} className="mb-4">
              <p className="text-xs text-muted mb-3">{t('gradesWhatIfDesc')}</p>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <label className="flex items-center gap-2 text-sm">
                  {t('gradesWhatIfTarget')}
                  <input
                    type="number"
                    className="field !w-24 !py-1.5"
                    min="2"
                    max="5"
                    step="0.05"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    aria-label={t('gradesWhatIfTarget')}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  {t('gradesWhatIfMark')}
                  <select
                    className="field !w-auto !py-1.5"
                    value={planMark}
                    onChange={(e) => setPlanMark(e.target.value)}
                    aria-label={t('gradesWhatIfMark')}
                  >
                    <option value="5">5</option>
                    <option value="4">4</option>
                    <option value="3">3</option>
                  </select>
                </label>
                <span className="text-xs text-muted">
                  {t('gradesWhatIfNow')}: <b>{allMarks.avg.toFixed(2)}</b> ({allMarks.n})
                </span>
              </div>
              {whatIf?.state === 'ok' && (
                <div className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  {t('gradesWhatIfResult', { n: whatIf.needed, m: planMark })}
                </div>
              )}
              {whatIf?.state === 'done' && (
                <div className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                  {t('gradesWhatIfDone')}
                </div>
              )}
              {whatIf?.state === 'impossible' && (
                <div className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                  {t('gradesWhatIfImpossible')}
                </div>
              )}
            </Card>
          )}

          {subjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Chip active={subject === 'all'} onClick={() => setSubject('all')}>{t('all')}</Chip>
              {subjects.map((s) => (
                <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>{s}</Chip>
              ))}
            </div>
          )}

          <Card
            title={t('gradesRecent')}
            icon={<ListChecks size={17} />}
            className="mb-4"
            actions={
              recent.length > 0 ? (
                <button className="btn btn--ghost !py-1.5 !px-3 text-xs" onClick={handleExportCSV}>
                  <Download size={14} />
                  {t('expCsv')}
                </button>
              ) : null
            }
          >
            {recent.length === 0 ? (
              <Empty text={t('gradesNoMarks')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="marks-table">
                  <thead>
                    <tr>
                      <th>{t('gradesDate')}</th>
                      <th>{t('gradesSubject')}</th>
                      <th>{t('gradesTheme')}</th>
                      <th>{t('gradesMarks')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((v, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap text-muted text-xs">{fmtShort(v.date_visit)}</td>
                        <td className="text-sm">{v.spec_name}</td>
                        <td className="text-xs text-muted">{v.lesson_theme}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {MARK_FIELDS.filter((f) => v[f.key] != null).map((f) => (
                              <span key={f.key} className="inline-flex items-center gap-1 mr-1" title={t(f.label)}>
                                <MarkPill mark={v[f.key]} />
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > visible && (
              <div className="flex justify-center mt-3">
                <button className="btn btn--ghost !py-2 text-sm" onClick={() => setVisible((v) => v + 50)}>
                  +50
                </button>
              </div>
            )}
          </Card>
        </>
      )}

      <Card title={t('gradesExams')} icon={<GraduationCap size={17} />} className="mb-4">
        {exams.isLoading ? (
          <Spinner />
        ) : exams.isError ? (
          <ErrorBox onRetry={() => exams.refetch()} />
        ) : !exams.data?.length ? (
          <Empty text={t('gradesNoExams')} icon={GraduationCap} />
        ) : (
          <div className="overflow-x-auto">
            <table className="marks-table">
              <thead>
                <tr>
                  <th>{t('gradesDate')}</th>
                  <th>{t('gradesExamSubject')}</th>
                  <th>{t('gradesExamTeacher')}</th>
                  <th>{t('gradesExamMark')}</th>
                </tr>
              </thead>
              <tbody>
                {exams.data
                  .slice()
                  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                  .map((e, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap text-muted text-xs">{fmtShort(e.date)}</td>
                      <td className="text-sm">{e.spec}</td>
                      <td className="text-xs text-muted">{e.teacher}</td>
                      <td><MarkPill mark={e.mark} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('gradesAttendance')} icon={<CalendarCheck size={17} />}>
        {!visits.data?.length ? (
          <Empty text={t('noData')} icon={CalendarCheck} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <span className="chip !cursor-default" style={{ color: 'var(--success)' }}>
              {t('gradesPresent')}: <b className="ml-1">{attendance.present}</b>
            </span>
            <span className="chip !cursor-default" style={{ color: 'var(--danger)' }}>
              {t('gradesAbsent')}: <b className="ml-1">{attendance.absent}</b>
            </span>
            {attendance.late > 0 && (
              <span className="chip !cursor-default" style={{ color: 'var(--warning)' }}>
                {t('gradesLate')}: <b className="ml-1">{attendance.late}</b>
              </span>
            )}
          </div>
        )}
      </Card>
    </main>
  )
}

/**
 * Четвертные оценки: структура ответа зависит от потока, поэтому таблица
 * строится по фактическим ключам первой строки (числа — как оценки).
 */
function QuarterlyTable({ grades, t }) {
  const columns = useMemo(() => {
    const skip = new Set(['id', 'student_id', 'spec_id'])
    const cols = []
    const seen = new Set()
    for (const g of grades) {
      for (const k of Object.keys(g)) {
        if (skip.has(k) || seen.has(k)) continue
        seen.add(k)
        cols.push(k)
      }
    }
    return cols
  }, [grades])

  const humanize = (key) => {
    const map = {
      spec_name: t('gradesSubject'),
      subject_name: t('gradesSubject'),
      period_name: t('gradesQuarterly'),
      name: t('gradesSubject'),
    }
    return map[key] || key.replace(/_/g, ' ')
  }

  return (
    <div className="overflow-x-auto">
      <table className="marks-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{humanize(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grades.map((g, i) => (
            <tr key={i}>
              {columns.map((c) => {
                const val = g[c]
                const num = Number(val)
                const isMark = val != null && val !== '' && !Number.isNaN(num) && num >= 1 && num <= 5
                return (
                  <td key={c} className={typeof val === 'number' || /^[\d.]+$/.test(String(val ?? '')) ? '' : 'text-xs text-muted'}>
                    {isMark ? <MarkPill mark={val} /> : String(val ?? '—')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
