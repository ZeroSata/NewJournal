// Ключ приложения из оригинального фронтенда журнала.
// Он публичный (зашит в их JS-бандл), но вынесен в .env, чтобы значение
// можно было переопределить без правки кода. См. .env.example.
// Это НЕ секрет: реальную защиту даёт только пара логин/пароль.
export const APPLICATION_KEY =
  import.meta.env.VITE_APPLICATION_KEY || '6a56a5df2667e65aab73ce76d1dd737f7d1faef9c52e8b8c55ac75f565d8e8a6'

export const API_BASE = '/api/v2'

// Типы материалов библиотеки (как в оригинальном API)
export const LIBRARY_TYPES = {
  1: 'libraryHomework',
  2: 'libraryLessons',
  3: 'libraryLaboratories',
  4: 'libraryBooks',
  5: 'libraryVideos',
  6: 'libraryPresentations',
  7: 'libraryTests',
  8: 'libraryArticles',
}

// Статусы ДЗ в query-параметре status
export const HW_STATUS = {
  OVERDUE: 0,
  CHECKED: 1,
  ON_CHECK: 2,
  CURRENT: 3,
}

// ── Автооценка занятий ───────────────────────────────────────────────────────
// Интервал фоновой проверки списка ожидающих оценки занятий
export const AUTO_RATE_INTERVAL_MIN = 5
// Отправка не раньше, чем через столько минут после конца пары
export const AUTO_RATE_DELAY_MIN = 30
// Автоматом ставятся только оценки 4–5 (низкие — только вручную)
export const AUTO_RATE_MIN_MARK = 4
// Резервные теги, если /public/tags недоступен (everything_is_super, clearly_explains)
export const AUTO_RATE_FALLBACK_TAGS = [8, 10]
// Ключи тегов для хороших оценок в справочнике /public/tags
export const AUTO_RATE_TAG_KEYS = ['everything_is_super_tag', 'clearly_explains_tag']

// Категории оценок из /progress/operations/student-visits
export const MARK_FIELDS = [
  { key: 'class_work_mark', label: 'marksClasswork' },
  { key: 'home_work_mark', label: 'marksHomework' },
  { key: 'lab_work_mark', label: 'marksLab' },
  { key: 'control_work_mark', label: 'marksControl' },
  { key: 'practical_work_mark', label: 'marksPractical' },
  { key: 'final_work_mark', label: 'marksFinal' },
]

export const TOKENS_KEY = 'journal.tokens'
export const SETTINGS_KEY = 'journal.settings'
export const AUTO_RATED_KEY = 'journal.autoRated'
// id работ, о которых уже напоминали (Web Notifications)
export const NOTIFIED_KEY = 'journal.notifiedDeadlines'
