// Ключ приложения из оригинального фронтенда журнала (публичный, зашит в их бандл)
export const APPLICATION_KEY =
  '6a56a5df2667e65aab73ce76d1dd737f7d1faef9c52e8b8c55ac75f565d8e8a6'

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
