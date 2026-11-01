import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Star, TrendingUp, CalendarCheck, Gem, ClipboardCheck, Clock, Users, Sparkles, ThumbsUp,
  GraduationCap, Activity, AlarmClock, Coins,
} from 'lucide-react'
import {
  apiAcademicPerformance, apiAttendanceStatistic, apiAvgProgressChart, apiAttendanceChart,
  apiScheduleByDate, apiLeaderGroup, apiLeaderGroupPoints, apiLeaderStream, apiLeaderStreamPoints,
  apiHomeworkCounters, apiEvaluateLessonList, apiEvaluateLesson, apiStudentVisits,
  apiFutureExams, apiActivity,
} from '../api/endpoints'
import { MARK_FIELDS } from '../api/constants'
import { qk } from '../api/queryKeys'
import { useI18n } from '../i18n/I18nContext'
import { useEvalTags } from '../hooks/useAutoRate'
import { useDeadlines } from '../hooks/useDeadlines'
import { useAuth } from '../auth/AuthContext'
import { Card, StatCard, Spinner, ErrorBox, Empty, MarkPill, CardSkeleton } from '../components/ui'
import { GpaTrendChart, AttendanceTrendChart } from '../components/charts'
import { todayISO, nowMinutes as nowMinutesNow, prettyKey } from '../utils/format'

const MONTHS = 7

export default function DashboardPage() {
  const { t, locale } = useI18n()
  const today = todayISO()
  const tomorrow = todayISO(1)

  // «пары на завтра» должны переключаться сами, пока вкладка открыта:
  // раз в минуту обновляем текущие минуты (см. анализ, п. 3.8)
  const [nowTick, setNowTick] = useState(() => nowMinutesNow())
  useEffect(() => {
    const id = setInterval(() => setNowTick(nowMinutesNow()), 60 * 1000)
    return () => clearInterval(id)
  }, [])
  const nowMinutes = nowTick

  const perf = useQuery({ queryKey: qk.academicPerformance, queryFn: apiAcademicPerformance })
  const attStat = useQuery({ queryKey: qk.attendanceStatistic, queryFn: apiAttendanceStatistic })
  const gpaChart = useQuery({ queryKey: qk.chartAvgProgress, queryFn: apiAvgProgressChart, staleTime: 10 * 60 * 1000 })
  const attChart = useQuery({ queryKey: qk.chartAttendance, queryFn: apiAttendanceChart, staleTime: 10 * 60 * 1000 })
  const lessons = useQuery({
    queryKey: qk.scheduleDay(today),
    queryFn: () => apiScheduleByDate(today),
    refetchInterval: 5 * 60 * 1000,
  })
  const leaders = useQuery({ queryKey: qk.leaderGroup, queryFn: apiLeaderGroup, staleTime: 10 * 60 * 1000 })
  const leaderPoints = useQuery({ queryKey: qk.leaderGroupPoints, queryFn: apiLeaderGroupPoints, staleTime: 10 * 60 * 1000 })
  const streamLeaders = useQuery({ queryKey: qk.leaderStream, queryFn: apiLeaderStream, staleTime: 10 * 60 * 1000 })
  const streamPoints = useQuery({ queryKey: qk.leaderStreamPoints, queryFn: apiLeaderStreamPoints, staleTime: 10 * 60 * 1000 })
  const hwCounters = useQuery({ queryKey: qk.hwCounters, queryFn: apiHomeworkCounters })
  // select: из всей истории посещений вычисляем только оценки за сегодня —
  // перерисовка не происходит при обновлении остальной истории
  const visits = useQuery({
    queryKey: qk.studentVisits,
    queryFn: apiStudentVisits,
    staleTime: 10 * 60 * 1000,
    select: (list) =>
      (Array.isArray(list) ? list : [])
        .filter((v) => v.date_visit === today && MARK_FIELDS.some((f) => v[f.key] != null))
        .sort((a, b) => (a.lesson_number ?? 0) - (b.lesson_number ?? 0)),
  })
  const futureExams = useQuery({ queryKey: qk.futureExams, queryFn: apiFutureExams, staleTime: 15 * 60 * 1000 })
  const activity = useQuery({ queryKey: qk.activity, queryFn: apiActivity, staleTime: 5 * 60 * 1000 })
  const pendingEval = useQuery({
    queryKey: qk.evaluateLessonList,
    queryFn: apiEvaluateLessonList,
    staleTime: 60 * 1000,
  })

  // Месяцы без данных (points = null: каникулы, текущий месяц) убираем ДО
  // среза — иначе линия графика обрывается, а справа остаётся пустой хвост
  const gpaData = useMemo(() => {
    const list = gpaChart.data
    if (!Array.isArray(list)) return []
    return list
      .filter((d) => d.points != null)
      .slice(-MONTHS)
      .map((d) => ({
        label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(d.date + 'T12:00:00')),
        value: d.points,
        previous: d.previous_points ?? null,
      }))
  }, [gpaChart.data, locale])

  const attData = useMemo(() => {
    const list = attChart.data
    if (!Array.isArray(list)) return []
    return list
      .filter((d) => d.points != null)
      .slice(-MONTHS)
      .map((d) => ({
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

  // 6.3: если пары на сегодня уже закончились (или их нет) — показываем завтрашние
  const todayList = Array.isArray(lessons.data) ? lessons.data : []
  const allFinished = todayList.length > 0 && todayList.every((l) => {
    const [fh, fm] = String(l.finished_at || '00:00').split(':').map(Number)
    return fh * 60 + fm <= nowMinutes
  })
  const showTomorrow = !lessons.isLoading && (todayList.length === 0 || allFinished)
  const tomorrowQuery = useQuery({
    queryKey: qk.scheduleDay(tomorrow),
    queryFn: () => apiScheduleByDate(tomorrow),
    enabled: showTomorrow,
  })

  const todayMarks = visits.data || []

  return (
    <main className="page">
      <h1 className="page__title">{t('navHome')}</h1>
      <p className="page__subtitle">{today && new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>

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
          value={leaderPoints.data?.studentPosition ? `#${leaderPoints.data.studentPosition}` : '—'}
          label={t('dashTopgems')}
          delta={leaderPoints.data ? `${t('dashRank')} · ${t('dashTopgems')}: ${leaderPoints.data.totalCount ?? '—'}` : ''}
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
          {gpaChart.isLoading ? (
            <CardSkeleton />
          ) : gpaChart.isError ? <ErrorBox onRetry={() => gpaChart.refetch()} /> : gpaData.length ? <GpaTrendChart data={gpaData} /> : <Empty text={t('noData')} />}
        </Card>
        <Card title={t('dashTrendAttendance')} icon={<CalendarCheck size={17} />}>
          {attChart.isLoading ? (
            <CardSkeleton />
          ) : attChart.isError ? <ErrorBox onRetry={() => attChart.refetch()} /> : attData.length ? <AttendanceTrendChart data={attData} /> : <Empty text={t('noData')} />}
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
            <CardSkeleton />
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

      <div className="grid-2 mb-4">
        <Card title={t('dashLeaders')} icon={<Users size={17} />}>
          {leaders.isLoading ? (
            <CardSkeleton />
          ) : leaders.isError ? (
            <ErrorBox onRetry={() => leaders.refetch()} />
          ) : !leaders.data?.length ? (
            <Empty text={t('noData')} />
          ) : (
            <LeaderList list={leaders.data} t={t} />
          )}
        </Card>

        {/* Рейтинг потока — раньше эндпоинты были, карточки не было */}
        <Card title={t('dashLeadersStream')} icon={<Users size={17} />}>
          {streamLeaders.isLoading ? (
            <CardSkeleton />
          ) : streamLeaders.isError ? (
            <ErrorBox onRetry={() => streamLeaders.refetch()} />
          ) : !streamLeaders.data?.length ? (
            <Empty text={t('noData')} />
          ) : (
            <>
              {streamPoints.data?.studentPosition ? (
                <p className="text-xs text-muted mt-0 mb-2">
                  {t('dashRankStream')}: <b>#{streamPoints.data.studentPosition}</b>
                </p>
              ) : null}
              <LeaderList list={streamLeaders.data} t={t} />
            </>
          )}
        </Card>
      </div>

      <div className="grid-2 mb-4">
        {/* Блок «Ближайшие экзамены» — данные /dashboard/info/future-exams */}
        <Card title={t('dashFutureExams')} icon={<GraduationCap size={17} />}>
          {futureExams.isLoading ? (
            <CardSkeleton />
          ) : futureExams.isError ? (
            <ErrorBox onRetry={() => futureExams.refetch()} />
          ) : !futureExams.data?.length ? (
            <Empty text={t('dashNoExamsSoon')} icon={GraduationCap} />
          ) : (
            <div className="flex flex-col gap-2">
              {futureExams.data.map((e, i) => (
                <div key={i} className="lesson-row !items-center">
                  <div className="lesson-row__num"><GraduationCap size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">
                      {e.spec_name || e.spec || e.name || e.subject_name}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {e.teacher_name || e.teacher || e.fio_teach || ''}
                    </div>
                  </div>
                  {e.date && <span className="tag tag--mark">{e.date}</span>}
                  {e.mark != null && <MarkPill mark={e.mark} />}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Лента активности и наград — /dashboard/progress/activity */}
        <Card title={t('dashActivity')} icon={<Activity size={17} />}>
          {activity.isLoading ? (
            <CardSkeleton />
          ) : activity.isError ? (
            <ErrorBox onRetry={() => activity.refetch()} />
          ) : !activity.data?.length ? (
            <Empty text={t('dashNoActivity')} icon={Sparkles} />
          ) : (
            <div className="flex flex-col gap-1.5">
              {activity.data.slice(0, 8).map((a, i) => {
                // нормальные названия: перевод по коду награды, для неизвестных —
                // человекочитаемый запасной вариант (prettyKey)
                const key = `ach.${a.achievements_name}`
                const raw = t(key)
                const label = raw === key ? prettyKey(a.achievements_name) : raw
                const isCoin = a.point_types_name === 'COIN'
                return (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <span
                      className="inline-flex items-center justify-center rounded-lg shrink-0"
                      style={{ width: 30, height: 30, background: isCoin ? 'var(--warning-soft)' : 'var(--accent-soft)' }}
                      title={isCoin ? t('achTopcoins') : t('achTopgems')}
                    >
                      {isCoin
                        ? <Coins size={16} style={{ color: 'var(--warning)' }} />
                        : <Gem size={16} style={{ color: 'var(--accent)' }} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{label}</div>
                      <div className="text-xs text-muted">{a.date}</div>
                    </div>
                    <span className="tag tag--mark">+{a.current_point}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <DeadlinesCard t={t} />
        <EvalPendingCard t={t} />
      </div>
    </main>
  )
}

/**
 * Карточка «Занятия сегодня» (требование 6.3).
 * Если пары на сегодня уже закончились или сегодня занятий нет —
 * карточка автоматически переключается на расписание на завтра.
 * У сегодняшних пар три статуса: идёт сейчас (is-now), закончилась, впереди.
 */
function LessonsCard({ tomorrow, lessons, showTomorrow, allFinished, tomorrowQuery, nowMinutes, t }) {
  const { locale } = useI18n()

  const mins = (hhmm) => {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const fmtDay = (iso) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(iso + 'T12:00:00'))

  // активный источник данных: сегодня или завтра
  const active = showTomorrow ? tomorrowQuery : lessons
  const list = Array.isArray(active.data)
    ? active.data.slice().sort((a, b) => (a.lesson ?? 0) - (b.lesson ?? 0))
    : []

  const rows = (withStatus) => (
    <div className="flex flex-col gap-2">
      {list.map((l, i) => {
        const start = mins(l.started_at)
        const end = mins(l.finished_at)
        // статусы считаем только для сегодняшних пар — у завтрашних они бессмысленны
        const isNow = withStatus && start <= nowMinutes && nowMinutes < end
        const isOver = withStatus && !isNow && end <= nowMinutes
        return (
          <div
            key={i}
            className={`lesson-row ${isNow ? 'is-now' : ''}`}
            style={isOver ? { opacity: 0.55 } : undefined}
          >
            <div className="lesson-row__num">{l.lesson}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{l.subject_name}</div>
              <div className="text-xs text-muted truncate">{l.room_name} · {l.teacher_name}</div>
            </div>
            <div className="lesson-row__time !min-w-0 text-right">
              {l.started_at}
              <br />
              {l.finished_at}
            </div>
            {isNow ? (
              <span className="tag tag--current">{t('dashNow')}</span>
            ) : isOver ? (
              <span className="tag">{t('dashFinished')}</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )

  return (
    <Card
      title={showTomorrow ? t('dashTomorrow') : t('dashToday')}
      icon={<Clock size={17} />}
      actions={
        active.isLoading || active.isError ? null : showTomorrow ? (
          <span className="tag tag--current">{fmtDay(tomorrow)}</span>
        ) : (
          <span className="tag tag--mark">{t('schedLessonsCount', { n: list.length })}</span>
        )
      }
    >
      {/* почему включился режим «завтра»: пары закончились или сегодня занятий нет */}
      {showTomorrow && allFinished && (
        <p className="text-xs text-muted mb-3 flex items-center gap-1.5">
          <AlarmClock size={13} /> {t('dashLessonsOver')}
        </p>
      )}
      {showTomorrow && !allFinished && (
        <p className="text-xs text-muted mb-3 flex items-center gap-1.5">
          <CalendarCheck size={13} /> {t('dashNoLessons')}
        </p>
      )}

      {active.isLoading ? (
        <CardSkeleton />
      ) : active.isError ? (
        <ErrorBox onRetry={() => active.refetch()} />
      ) : list.length === 0 ? (
        <Empty text={showTomorrow ? t('dashNoLessonsTomorrow') : t('dashNoLessons')} icon={Clock} />
      ) : (
        rows(!showTomorrow)
      )}
    </Card>
  )
}

/** Список лидеров (группа/поток) */
function LeaderList({ list, t }) {
  const rows = list.filter((s) => s.full_name).slice(0, 5)
  if (!rows.length) return <Empty text={t('noData')} />
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((s) => (
        <div key={`${s.id}-${s.position}`} className="flex items-center gap-3 py-1">
          <span className="font-extrabold w-6 text-center" style={{ color: s.position <= 3 ? 'var(--accent)' : 'var(--text-muted)' }}>
            {s.position}
          </span>
          <span className="text-sm font-medium truncate flex-1">{s.full_name}</span>
          <span className="tag tag--mark">{s.amount}</span>
        </div>
      ))}
    </div>
  )
}

/** Карточка дедлайнов: «сдать сегодня / завтра» (данные из лёгкого запроса сайдбара) */
function DeadlinesCard({ t }) {
  const { user } = useAuth()
  const deadlines = useDeadlines(user?.current_group_id)

  const rows = useMemo(() => {
    const d = deadlines.data
    if (!d) return []
    return [
      ...d.dueToday.map((it) => ({ it, day: t('dashDueToday'), tone: 'var(--danger)' })),
      ...d.dueTomorrow.map((it) => ({ it, day: t('dashDueTomorrow'), tone: 'var(--warning)' })),
    ]
  }, [deadlines.data, t])

  return (
    <Card title={t('dashDeadlines')} icon={<AlarmClock size={17} />}>
      {deadlines.isLoading ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <Empty text={t('dashNoDeadlines')} icon={AlarmClock} />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ it, day, tone }, i) => (
            <div key={`${it.id}-${i}`} className="lesson-row !items-center">
              <div className="lesson-row__num" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                <Clock size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{it.theme}</div>
                <div className="text-xs text-muted truncate">{it.name_spec}</div>
              </div>
              <span className="tag" style={{ background: 'var(--warning-soft)', color: tone }}>{day}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** Ручная оценка занятий (режим «по подтверждению» = список + кнопки) */
function EvalPendingCard({ t }) {
  const { locale } = useI18n()
  const queryClient = useQueryClient()
  const tags = useEvalTags()
  const [done, setDone] = useState({})
  const [err, setErr] = useState(null)
  const [bulk, setBulk] = useState(false)

  const q = useQuery({
    queryKey: qk.evaluateLessonList,
    queryFn: apiEvaluateLessonList,
    staleTime: 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: apiEvaluateLesson,
    onSuccess: (_, vars) => {
      setDone((d) => ({ ...d, [vars.key]: true }))
      setErr(null)
      queryClient.invalidateQueries({ queryKey: qk.evaluateLessonList })
    },
    onError: () => setErr(t('dashEvalFail')),
  })

  const list = Array.isArray(q.data) ? q.data.filter((l) => !done[l.key]) : []

  const rateAll = async () => {
    setBulk(true)
    for (const l of list) {
      try {
        await apiEvaluateLesson({ key: l.key, mark: 5, comment: '', tags })
        setDone((d) => ({ ...d, [l.key]: true }))
      } catch { /* продолжаем */ }
    }
    queryClient.invalidateQueries({ queryKey: qk.evaluateLessonList })
    setBulk(false)
  }

  return (
    <Card
      title={t('dashEvalPending')}
      icon={<ThumbsUp size={17} />}
      actions={list.length > 1 ? (
        <button className="btn btn--ghost !py-1.5 !px-3 text-xs" disabled={bulk} onClick={rateAll}>
          <Star size={13} />
          {t('dashEvalRateAll')}
        </button>
      ) : null}
    >
      {q.isLoading ? (
        <CardSkeleton />
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
                  disabled={mutation.isPending || bulk}
                  onClick={() => mutation.mutate({ key: l.key, mark: 5, comment: '', tags })}
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
