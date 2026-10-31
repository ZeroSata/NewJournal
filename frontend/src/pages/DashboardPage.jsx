import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Star, TrendingUp, CalendarCheck, Gem, ClipboardCheck, Clock, Users, Sparkles, ThumbsUp,
  GraduationCap,
} from 'lucide-react'
import {
  apiAcademicPerformance, apiAttendanceStatistic, apiAvgProgressChart, apiAttendanceChart,
  apiScheduleByDate, apiLeaderGroup, apiLeaderGroupPoints, apiHomeworkCounters,
  apiEvaluateLessonList, apiEvaluateLesson, apiStudentVisits,
} from '../api/endpoints'
import { MARK_FIELDS } from '../api/constants'
import { useI18n } from '../i18n/I18nContext'
import { Card, StatCard, Spinner, ErrorBox, Empty, MarkPill } from '../components/ui'
import { GpaTrendChart, AttendanceTrendChart } from '../components/charts'
import { todayISO } from '../utils/format'

const MONTHS = 7

export default function DashboardPage() {
  const { t, locale } = useI18n()
  const today = todayISO()
  const tomorrow = todayISO(1)

  const perf = useQuery({ queryKey: ['academic-performance'], queryFn: apiAcademicPerformance })
  const attStat = useQuery({ queryKey: ['attendance-statistic'], queryFn: apiAttendanceStatistic })
  const gpaChart = useQuery({ queryKey: ['chart-average-progress'], queryFn: apiAvgProgressChart })
  const attChart = useQuery({ queryKey: ['chart-attendance'], queryFn: apiAttendanceChart })
  const lessons = useQuery({
    queryKey: ['schedule', today],
    queryFn: () => apiScheduleByDate(today),
  })
  const leaders = useQuery({ queryKey: ['leader-group'], queryFn: apiLeaderGroup })
  const leaderPoints = useQuery({ queryKey: ['leader-group-points'], queryFn: apiLeaderGroupPoints })
  const hwCounters = useQuery({ queryKey: ['count-homework'], queryFn: apiHomeworkCounters })
  const visits = useQuery({ queryKey: ['student-visits'], queryFn: apiStudentVisits, staleTime: 5 * 60 * 1000 })
  const pendingEval = useQuery({
    queryKey: ['evaluate-lesson-list'],
    queryFn: apiEvaluateLessonList,
    staleTime: 60 * 1000,
  })

  const gpaData = useMemo(() => {
    const list = gpaChart.data
    if (!Array.isArray(list)) return []
    return list.slice(-MONTHS).map((d) => ({
      label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(d.date + 'T12:00:00')),
      value: d.points,
      previous: d.previous_points ?? null,
    }))
  }, [gpaChart.data, locale])

  const attData = useMemo(() => {
    const list = attChart.data
    if (!Array.isArray(list)) return []
    return list.slice(-MONTHS).map((d) => ({
      label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(d.date + 'T12:00:00')),
      value: d.points,
    }))
  }, [attChart.data, locale])

  const hwCount = (type) => {
    const arr = hwCounters.data
    if (!Array.isArray(arr)) return '—'
    const found = arr.find((c) => c.counter_type === type)
    return found ? found.counter : '—'
  }

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  // 6.3: если пары на сегодня уже закончились (или их нет) — показываем завтрашние
  const todayList = Array.isArray(lessons.data) ? lessons.data : []
  const allFinished = todayList.length > 0 && todayList.every((l) => {
    const [fh, fm] = String(l.finished_at || '00:00').split(':').map(Number)
    return fh * 60 + fm <= nowMinutes
  })
  const showTomorrow = !lessons.isLoading && (todayList.length === 0 || allFinished)
  const tomorrowQuery = useQuery({
    queryKey: ['schedule', tomorrow],
    queryFn: () => apiScheduleByDate(tomorrow),
    enabled: showTomorrow,
  })

  // 6.1: оценки за сегодня — из посещений с оценками
  const todayMarks = useMemo(() => {
    const list = Array.isArray(visits.data) ? visits.data : []
    return list
      .filter((v) => v.date_visit === today)
      .filter((v) => MARK_FIELDS.some((f) => v[f.key] != null))
      .sort((a, b) => (a.lesson_number ?? 0) - (b.lesson_number ?? 0))
  }, [visits.data, today])

  return (
    <main className="page">
      <h1 className="page__title">{t('navHome')}</h1>
      <p className="page__subtitle">{today && new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)}</p>

      <div className="stats-grid mb-4">
        <StatCard
          icon={<TrendingUp size={19} style={{ color: 'var(--accent)' }} />}
          tone="accent"
          value={perf.data ? `${perf.data.totalAllTime}` : '—'}
          label={`${t('dashGpa')} · ${t('dashGpaAll')}`}
          delta={perf.data ? `${t('dashGpaMonth')}: ${perf.data.totalMonth}` : ''}
        />
        <StatCard
          icon={<CalendarCheck size={19} style={{ color: 'var(--success)' }} />}
          tone="success"
          value={attStat.data ? `${attStat.data.statTotal}%` : '—'}
          label={`${t('dashAttendance')} · ${t('dashAttendanceTotal')}`}
          delta={attStat.data ? `${t('dashAttendanceMonth')}: ${attStat.data.statMonth}% · ${t('dashAttendanceWeek')}: ${attStat.data.statWeek}%` : ''}
        />
        <StatCard
          icon={<Gem size={19} style={{ color: 'var(--warning)' }} />}
          tone="warning"
          value={leaderPoints.data?.totalCount ?? '—'}
          label={t('dashTopgems')}
          delta={leaderPoints.data ? `#${leaderPoints.data.studentPosition} · ${t('dashRank')}` : ''}
        />
        <StatCard
          icon={<ClipboardCheck size={19} style={{ color: 'var(--info)' }} />}
          tone="info"
          value={hwCount(3)}
          label={t('dashHwCurrent')}
          delta={`${t('dashHwChecked')}: ${hwCount(1)} · ${t('dashHwOnCheck')}: ${hwCount(2)} · ${t('dashHwOverdue')}: ${hwCount(0)}`}
        />
      </div>

      <div className="grid-2 mb-4">
        <Card title={t('dashTrendGpa')} icon={<TrendingUp size={17} />}>
          {gpaChart.isLoading ? <Spinner /> : gpaChart.isError ? <ErrorBox onRetry={() => gpaChart.refetch()} /> : gpaData.length ? <GpaTrendChart data={gpaData} /> : <Empty text={t('noData')} />}
        </Card>
        <Card title={t('dashTrendAttendance')} icon={<CalendarCheck size={17} />}>
          {attChart.isLoading ? <Spinner /> : attChart.isError ? <ErrorBox onRetry={() => attChart.refetch()} /> : attData.length ? <AttendanceTrendChart data={attData} /> : <Empty text={t('noData')} />}
        </Card>
      </div>

      <div className="grid-2 mb-4">
        <LessonsCard
          today={today}
          tomorrow={tomorrow}
          lessons={lessons}
          showTomorrow={showTomorrow}
          allFinished={allFinished}
          tomorrowQuery={tomorrowQuery}
          nowMinutes={nowMinutes}
          t={t}
        />

        {/* 6.1: оценки за сегодня */}
        <Card title={t('dashTodayMarks')} icon={<Star size={17} />}>
          {visits.isLoading ? (
            <Spinner />
          ) : visits.isError ? (
            <ErrorBox onRetry={() => visits.refetch()} />
          ) : todayMarks.length === 0 ? (
            <Empty text={t('dashNoMarksToday')} icon={Sparkles} />
          ) : (
            <div className="flex flex-col gap-2">
              {todayMarks.map((v, i) => (
                <div key={i} className="lesson-row !items-center">
                  <div className="lesson-row__num">{v.lesson_number ?? '—'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{v.spec_name}</div>
                    <div className="text-xs text-muted truncate">
                      {v.lesson_theme || v.teacher_name}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {MARK_FIELDS.filter((f) => v[f.key] != null).map((f) => (
                      <span key={f.key} title={t(f.label)}>
                        <MarkPill mark={v[f.key]} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card title={t('dashLeaders')} icon={<Users size={17} />}>
          {leaders.isLoading ? (
            <Spinner />
          ) : leaders.isError ? (
            <ErrorBox onRetry={() => leaders.refetch()} />
          ) : !leaders.data?.length ? (
            <Empty text={t('noData')} />
          ) : (
            <div className="flex flex-col gap-1.5">
              {leaders.data.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-1">
                  <span className="font-extrabold w-6 text-center" style={{ color: s.position <= 3 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {s.position}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{s.full_name}</span>
                  <span className="tag tag--mark">{s.amount}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <EvalPendingCard />
      </div>
    </main>
  )
}

/**
 * Карточка занятий: пока идут или впереди — сегодняшние пары;
 * когда все закончились (или сегодня выходной) — пары на завтра (6.3).
 */
function LessonsCard({ today, tomorrow, lessons, showTomorrow, allFinished, tomorrowQuery, nowMinutes, t }) {
  const isMinutesOver = (l) => {
    const [fh, fm] = String(l.finished_at || '00:00').split(':').map(Number)
    return fh * 60 + fm <= nowMinutes
  }
  const isNow = (l) => {
    const [sh, sm] = String(l.started_at || '00:00').split(':').map(Number)
    const [fh, fm] = String(l.finished_at || '00:00').split(':').map(Number)
    return nowMinutes >= sh * 60 + sm && nowMinutes < fh * 60 + fm
  }

  if (showTomorrow) {
    const list = Array.isArray(tomorrowQuery.data) ? tomorrowQuery.data : []
    return (
      <Card
        title={t('dashTomorrow')}
        icon={<GraduationCap size={17} />}
        actions={<span className="tag tag--checking">{allFinished ? t('dashLessonsOver') : t('dashNoLessons')}</span>}
      >
        {tomorrowQuery.isLoading || tomorrowQuery.isFetching ? (
          <Spinner />
        ) : tomorrowQuery.isError ? (
          <ErrorBox onRetry={() => tomorrowQuery.refetch()} />
        ) : list.length === 0 ? (
          <Empty text={t('dashNoLessonsTomorrow')} icon={Sparkles} />
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((l, i) => (
              <div key={i} className="lesson-row">
                <div className="lesson-row__num">{l.lesson}</div>
                <div className="lesson-row__time">
                  {l.started_at}–{l.finished_at}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{l.subject_name}</div>
                  <div className="text-xs text-muted truncate">
                    {l.teacher_name} · {l.room_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card title={t('dashToday')} icon={<Clock size={17} />}>
      {lessons.isLoading ? (
        <Spinner />
      ) : lessons.isError ? (
        <ErrorBox onRetry={() => lessons.refetch()} />
      ) : (
        <div className="flex flex-col gap-2">
          {lessons.data.map((l, i) => (
            <div key={i} className={`lesson-row ${isNow(l) ? 'is-now' : ''}`}>
              <div className="lesson-row__num">{l.lesson}</div>
              <div className="lesson-row__time">
                {l.started_at}–{l.finished_at}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{l.subject_name}</div>
                <div className="text-xs text-muted truncate">
                  {l.teacher_name} · {l.room_name}
                </div>
              </div>
              {isNow(l) ? (
                <span className="tag tag--current">{t('today')}</span>
              ) : isMinutesOver(l) ? (
                <span className="text-xs text-muted">{t('dashFinished')}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function EvalPendingCard() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [done, setDone] = useState({})
  const [err, setErr] = useState(null)

  const q = useQuery({
    queryKey: ['evaluate-lesson-list'],
    queryFn: apiEvaluateLessonList,
    staleTime: 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: apiEvaluateLesson,
    onSuccess: (_, vars) => {
      setDone((d) => ({ ...d, [vars.key]: true }))
      setErr(null)
      queryClient.invalidateQueries({ queryKey: ['evaluate-lesson-list'] })
    },
    onError: () => setErr(t('dashEvalFail')),
  })

  const list = Array.isArray(q.data) ? q.data.filter((l) => !done[l.key]) : []

  return (
    <Card title={t('dashEvalPending')} icon={<ThumbsUp size={17} />}>
      {q.isLoading ? (
        <Spinner />
      ) : q.isError ? (
        <ErrorBox onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <Empty text={t('dashEvalOk')} icon={Sparkles} />
      ) : (
        <>
          <p className="text-xs text-muted mb-3">{t('dashEvalPendingDesc')}</p>
          {err && <div className="error-box mb-2">{err}</div>}
          <div className="flex flex-col gap-2">
            {list.map((l) => (
              <div key={l.key} className="lesson-row">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{l.spec_name}</div>
                  <div className="text-xs text-muted truncate">
                    {l.fio_teach} · {l.date_visit}
                  </div>
                </div>
                <button
                  className="btn btn--primary !py-2 !px-3 text-sm"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ key: l.key, mark: 5, comment: '', tags: [8, 10] })}
                  title={t('dashEvaluate')}
                >
                  <Star size={15} />
                  {t('dashEvaluate')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
