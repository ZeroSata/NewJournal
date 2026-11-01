/**
 * Все ключи запросов TanStack Query в одном месте.
 * Раньше строки вроде 'evaluate-lesson-list' повторялись в разных файлах
 * и инвалидация рассинхронизировалась — теперь ключ собирается здесь.
 */
export const qk = {
  // ── Профиль и счётчики ──────────────────────────────────────────────────
  userInfo: ['user-info'],
  pageCounters: ['page-counters'],
  hwCounters: ['count-homework'],
  libraryCounters: ['library-counters'],
  signalUnread: ['signal-unread'],

  // ── Главная ─────────────────────────────────────────────────────────────
  academicPerformance: ['academic-performance'],
  attendanceStatistic: ['attendance-statistic'],
  chartAvgProgress: ['chart-average-progress'],
  chartAttendance: ['chart-attendance'],
  leaderGroup: ['leader-group'],
  leaderGroupPoints: ['leader-group-points'],
  leaderStream: ['leader-stream'],
  leaderStreamPoints: ['leader-stream-points'],
  futureExams: ['future-exams'],
  activity: ['dashboard-activity'],

  // ── Расписание ──────────────────────────────────────────────────────────
  scheduleDay: (date) => ['schedule', date],
  scheduleRange: (from, to) => ['schedule', 'range', from, to],
  scheduleMonth: (date) => ['schedule', 'month', date],

  // ── ДЗ и ЛР ─────────────────────────────────────────────────────────────
  hwList: ({ type, status, groupId, specId }) => [
    'hw-list',
    type,
    status ?? 'all',
    groupId ?? 'all',
    specId ?? 'all',
  ],
  groupHistory: ['hw-group-history'],
  hwEvalTags: ['hw-eval-tags'],
  // Лёгкий запрос первых страниц текущих работ — для бейджа дедлайнов
  deadlines: (groupId) => ['deadlines', groupId],

  // ── Материалы ───────────────────────────────────────────────────────────
  library: (materialType, recommendedType) => ['library', materialType, recommendedType],

  // ── Оценки ──────────────────────────────────────────────────────────────
  studentVisits: ['student-visits'],
  studentExams: ['student-exams'],
  quarterlyGrades: ['school-quarterly-grades'],

  // ── Оценивание занятий ──────────────────────────────────────────────────
  evaluateLessonList: ['evaluate-lesson-list'],
  publicTags: ['public-tags'],

  // ── Прочее ──────────────────────────────────────────────────────────────
  signals: ['signals-list'],
  signalProblems: ['signal-problems'],
  achievements: ['student-achievements'],
  portfolio: ['portfolio-list'],
  portfolioHistory: ['portfolio-history'],
  paymentIndex: ['payment-index'],
  paymentHistory: ['payment-history'],
  profileSettings: ['profile-settings'],
  documents: (studentId) => ['documents', studentId],
  profileFields: (studentId) => ['profile-fields', studentId],
}

export default qk
