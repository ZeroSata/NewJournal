import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apiEvaluateLesson,
  apiEvaluateLessonList,
  apiPublicTags,
} from '../api/endpoints'
import {
  AUTO_RATED_KEY,
  AUTO_RATE_DELAY_MIN,
  AUTO_RATE_INTERVAL_MIN,
  AUTO_RATE_MIN_MARK,
  AUTO_RATE_TAG_KEYS,
  AUTO_RATE_FALLBACK_TAGS,
} from '../api/constants'
import { qk } from '../api/queryKeys'
import { useSettings } from '../settings/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { todayISO, minutesOfDay, nowMinutes } from '../utils/format'

function readRated() {
  try {
    return new Set(JSON.parse(localStorage.getItem(AUTO_RATED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function writeRated(set) {
  // храним не больше 300 последних ключей
  const arr = [...set].slice(-300)
  localStorage.setItem(AUTO_RATED_KEY, JSON.stringify(arr))
}

// Общая статистика автооценки за сессию (для страницы настроек)
export const autoRateStats = { sessionCount: 0, lastRun: null }

/**
 * Фоновая автооценка занятий. Безопасная версия (см. анализ проекта):
 *
 *  - `onRated` и другие пропсы читаются через ref, поэтому `run` стабилен
 *    и не пересоздаётся на каждый рендер Layout — раньше эффект
 *    перезапускался (и дёргал API) при открытии меню и показе тоста;
 *  - автоматически ставятся ТОЛЬКО оценки 4–5; низкие оценки требуют
 *    комментария, который прочитает живой преподаватель, — их ставят
 *    вручную через карточку на главной;
 *  - теги берутся из справочника /public/tags (ключи AUTO_RATE_TAG_KEYS),
 *    а не зашитыми [8, 10];
 *  - занятие отправляется не раньше чем через AUTO_RATE_DELAY_MIN минут
 *    после конца пары (по расписанию дня); если время конца пары
 *    определить не удалось — занятие пропускается до следующего цикла.
 */
export function useAutoRate({ mode, isAuthed, onRated }) {
  const { settings } = useSettings()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const busyRef = useRef(false)
  const [sessionCount, setSessionCount] = useState(0)

  // ref'ы вместо зависимостей: run стабилен, интервал не сбрасывается
  const enabledRef = useRef(mode === 'auto' && isAuthed)
  const markRef = useRef(settings.autoRateMark)
  const onRatedRef = useRef(onRated)
  const tRef = useRef(t)

  useEffect(() => {
    enabledRef.current = mode === 'auto' && isAuthed
  }, [mode, isAuthed])
  useEffect(() => {
    markRef.current = settings.autoRateMark
  }, [settings.autoRateMark])
  useEffect(() => {
    onRatedRef.current = onRated
  }, [onRated])
  useEffect(() => {
    tRef.current = t
  }, [t])

  // Справочник тегов оценки — тянем один раз, живёт неделю
  const tagsQuery = useQuery({
    queryKey: qk.publicTags,
    queryFn: apiPublicTags,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  })

  const getTags = useCallback(() => {
    const list = tagsQuery.data
    if (Array.isArray(list) && list.length) {
      const ids = list
        .filter((tag) => AUTO_RATE_TAG_KEYS.includes(tag.translate_key))
        .map((tag) => tag.id)
      if (ids.length) return ids
    }
    return AUTO_RATE_FALLBACK_TAGS
  }, [tagsQuery.data])

  /**
   * Можно ли отправлять оценку прямо сейчас:
   * для сегодняшних занятий сверяемся с расписанием дня.
   */
  const canRateNow = useCallback(
    (lesson) => {
      if (lesson.date_visit !== todayISO()) return true
      const sched = queryClient.getQueryData(qk.scheduleDay(todayISO()))
      if (!Array.isArray(sched)) return false // не знаем время конца пары — не рискуем
      const match = sched.find((s) => s.subject_name === lesson.spec_name)
      if (!match?.finished_at) return false
      const endMin = minutesOfDay(match.finished_at)
      if (endMin == null) return false
      return nowMinutes() >= endMin + AUTO_RATE_DELAY_MIN
    },
    [queryClient]
  )

  const run = useCallback(async () => {
    if (!enabledRef.current || busyRef.current) return 0
    busyRef.current = true
    try {
      const pending = await apiEvaluateLessonList()
      if (!Array.isArray(pending) || pending.length === 0) return 0
      const rated = readRated()
      // только 4–5, даже если в настройках выбрано меньше
      const mark = Math.max(Number(markRef.current) || 5, AUTO_RATE_MIN_MARK)
      const tags = getTags()
      let done = 0
      for (const lesson of pending) {
        if (!lesson?.key || rated.has(lesson.key)) continue
        if (!canRateNow(lesson)) continue
        try {
          await apiEvaluateLesson({ key: lesson.key, mark, comment: '', tags })
          rated.add(lesson.key)
          done += 1
        } catch {
          // при ошибке на одном занятии продолжаем остальные
        }
      }
      if (done > 0) {
        writeRated(rated)
        setSessionCount((c) => c + done)
        autoRateStats.sessionCount += done
        autoRateStats.lastRun = new Date().toISOString()
        queryClient.invalidateQueries({ queryKey: qk.evaluateLessonList })
        onRatedRef.current?.(done)
      }
      return done
    } catch {
      return 0
    } finally {
      busyRef.current = false
    }
  }, [getTags, canRateNow, queryClient])

  useEffect(() => {
    if (mode !== 'auto' || !isAuthed) return
    run()
    const id = setInterval(run, AUTO_RATE_INTERVAL_MIN * 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [mode, isAuthed, run])

  return { sessionCount, runNow: run }
}

/** Теги для ручной оценки (карточка на главной) — из того же справочника */
export function useEvalTags() {
  const tagsQuery = useQuery({
    queryKey: qk.publicTags,
    queryFn: apiPublicTags,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  })
  const list = tagsQuery.data
  if (Array.isArray(list) && list.length) {
    const ids = list
      .filter((tag) => AUTO_RATE_TAG_KEYS.includes(tag.translate_key))
      .map((tag) => tag.id)
    if (ids.length) return ids
  }
  return AUTO_RATE_FALLBACK_TAGS
}
