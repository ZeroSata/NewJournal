import { useQuery } from '@tanstack/react-query'
import { apiHomeworkList } from '../api/endpoints'
import { qk } from '../api/queryKeys'
import { hwBucket, daysUntil } from '../utils/format'

// ── Лёгкий запрос дедлайнов ──────────────────────────────────────────────────
// Первые две страницы текущих работ каждого типа — обычно этого достаточно,
// чтобы увидеть «сдать сегодня/завтра». Полная догрузка остаётся на странице ДЗ.
export function fetchDeadlineItems(groupId) {
  const load = (type, page) =>
    apiHomeworkList({ page, status: 3, type, groupId }).catch(() => [])
  return Promise.all([
    load(0, 1), load(0, 2), load(1, 1), load(1, 2),
  ]).then((pages) => {
    const items = pages.flat().filter(Boolean)
    const dueToday = []
    const dueTomorrow = []
    for (const it of items) {
      const bucket = hwBucket(it)
      if (bucket !== 'current' && bucket !== 'dueSoon') continue
      const left = daysUntil(it.overdue_time)
      if (left === 0) dueToday.push(it)
      else if (left === 1) dueTomorrow.push(it)
    }
    return { dueToday, dueTomorrow, items }
  })
}

/**
 * Дедлайны «сегодня/завтра» — общий запрос для сайдбара, главной и уведомлений.
 * @param {number|null} groupId
 * @param {object} opts { enabled = true, refetch = true }
 */
export function useDeadlines(groupId, { enabled = true, refetch = true } = {}) {
  return useQuery({
    queryKey: qk.deadlines(groupId),
    queryFn: () => fetchDeadlineItems(groupId),
    enabled: Boolean(groupId) && enabled,
    staleTime: 10 * 60 * 1000,
    refetchInterval: refetch ? 10 * 60 * 1000 : false,
    retry: 0,
  })
}
