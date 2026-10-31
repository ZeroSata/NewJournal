import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiEvaluateLesson, apiEvaluateLessonList } from '../api/endpoints'
import { AUTO_RATED_KEY } from '../api/constants'
import { useSettings } from '../settings/SettingsContext'
import { useI18n } from '../i18n/I18nContext'

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
 * Фоновая автооценка занятий.
 * Пока включена — раз в 5 минут проверяет список занятий, ожидающих оценки,
 * и отправляет для каждого сохранённую оценку выбранным баллом.
 */
export function useAutoRate({ enabled, isAuthed, onRated }) {
  const { settings } = useSettings()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const busyRef = useRef(false)
  const [sessionCount, setSessionCount] = useState(0)

  const run = useCallback(async () => {
    if (!enabled || busyRef.current) return 0
    busyRef.current = true
    try {
      const pending = await apiEvaluateLessonList()
      if (!Array.isArray(pending) || pending.length === 0) return 0
      const rated = readRated()
      const mark = Number(settings.autoRateMark) || 5
      const comment = mark <= 3 ? t('autoRateComment') : ''
      let done = 0
      for (const lesson of pending) {
        if (!lesson?.key || rated.has(lesson.key)) continue
        try {
          await apiEvaluateLesson({ key: lesson.key, mark, comment, tags: mark >= 4 ? [8, 10] : [] })
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
        queryClient.invalidateQueries({ queryKey: ['evaluate-lesson-list'] })
        onRated?.(done)
      }
      return done
    } catch {
      return 0
    } finally {
      busyRef.current = false
    }
  }, [enabled, settings.autoRateMark, t, onRated, queryClient])

  useEffect(() => {
    if (!enabled || !isAuthed) return
    run()
    const id = setInterval(run, 5 * 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, isAuthed, run])

  return { sessionCount, runNow: run }
}
