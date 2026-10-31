import request from './client'
import { APPLICATION_KEY } from './constants'

// ── Аутентификация ───────────────────────────────────────────────────────────
export const apiLogin = (username, password) =>
  request('/auth/login', {
    method: 'POST',
    body: { application_key: APPLICATION_KEY, id_city: null, username, password },
  })

export const apiRefresh = (refresh_token) =>
  request('/auth/refresh', { method: 'POST', body: { refresh_token } })

export const apiUserInfo = () => request('/settings/user-info')

// ── Главная ──────────────────────────────────────────────────────────────────
export const apiCounters = (filterType = 0) =>
  request('/count/page-counters', { params: { filter_type: filterType } })

export const apiHomeworkCounters = () => request('/count/homework')

export const apiLibraryCounters = () => request('/count/library')

export const apiAvgProgressChart = () => request('/dashboard/chart/average-progress')

export const apiAttendanceChart = () => request('/dashboard/chart/attendance')

export const apiAcademicPerformance = () => request('/dashboard/progress/academic-performance')

export const apiAttendanceStatistic = () => request('/dashboard/progress/attendance-statistic')

export const apiLeaderGroup = () => request('/dashboard/progress/leader-group')

export const apiLeaderGroupPoints = () => request('/dashboard/progress/leader-group-points')

export const apiFutureExams = () => request('/dashboard/info/future-exams')

export const apiActivity = () => request('/dashboard/progress/activity')

// ── Расписание ───────────────────────────────────────────────────────────────
// Параметры дублируются (date + date_filter / date_from + date_start и т.п.),
// т.к. разные части оригинального фронтенда используют разные имена —
// лишние параметры сервер игнорирует.
export const apiScheduleByDate = (date) =>
  request('/schedule/operations/get-by-date', { params: { date, date_filter: date } })

export const apiScheduleByRange = (date_from, date_to) =>
  request('/schedule/operations/get-by-date-range', {
    params: { date_from, date_to, date_start: date_from, date_end: date_to },
  })

export const apiScheduleMonth = (date) =>
  request('/schedule/operations/get-month', { params: { date, date_filter: date } })

// ── Домашние задания и лабораторные ─────────────────────────────────────────
export const apiHomeworkList = ({ page = 1, status, type = 0, groupId, specId } = {}) =>
  request('/homework/operations/list', {
    params: { page, status, type, group_id: groupId, spec_id: specId },
  })

export const apiGroupHistory = () => request('/homework/settings/group-history')

// Сдача работы — multipart/form-data, формат оригинального клиента:
// id, file, answerText, spentTimeHour, spentTimeMin
export const apiSubmitHomework = ({ id, file, answerText = '', spentTimeHour = 0, spentTimeMin = 0 }) => {
  const fd = new FormData()
  fd.append('id', String(id))
  fd.append('file', file || '')
  fd.append('answerText', answerText || '')
  fd.append('spentTimeHour', String(spentTimeHour))
  fd.append('spentTimeMin', String(spentTimeMin))
  return request('/homework/operations/create', { method: 'POST', body: fd })
}

export const apiDeleteHomework = (id) =>
  request('/homework/operations/delete', { method: 'POST', body: { id } })

// ── Учебные материалы ────────────────────────────────────────────────────────
export const apiLibraryList = (materialType, recommendedType = 1) =>
  request('/library/operations/list', {
    params: { material_type: materialType, recommended_type: recommendedType },
  })

export const apiMarkMaterialUsed = (id) =>
  request('/library/operations/set-use-material', { method: 'POST', body: { id } })

// ── Оценки и посещаемость ────────────────────────────────────────────────────
export const apiStudentVisits = () => request('/progress/operations/student-visits')

export const apiStudentExams = () => request('/progress/operations/student-exams')

export const apiQuarterlyGrades = () => request('/progress/operations/school-quarterly-grades')

// ── Оценивание занятий ───────────────────────────────────────────────────────
export const apiEvaluateLessonList = () => request('/feedback/students/evaluate-lesson-list')

export const apiEvaluateLesson = ({ key, mark, comment = '', tags = [] }) =>
  request('/feedback/students/evaluate-lesson', {
    method: 'POST',
    body: {
      key,
      mark_lesson: mark,
      mark_teach: mark,
      comment_lesson: comment,
      comment_teach: comment,
      tags_lesson: tags,
      tags_teach: tags,
    },
  })

// ── Сигналы (обращения) ──────────────────────────────────────────────────────
export const apiSignalsList = () => request('/signal/operations/signals-list')

export const apiSignalProblems = () => request('/signal/operations/problems-list')

export const apiSignalCountUnread = () => request('/signal/operations/count-unread')

// Формат оригинального клиента: { Signal: { problem_id, theme, message, ... } }
export const apiCreateSignal = ({ problemId, theme = '', message = '' }) =>
  request('/signal/operations/create', {
    method: 'POST',
    body: { Signal: { problem_id: problemId, theme, message, priority: 0, status: 0 } },
  })

// ── Достижения ───────────────────────────────────────────────────────────────
export const apiAchievements = () => request('/profile/statistic/student-achievements')

// ── Документы ────────────────────────────────────────────────────────────────
export const apiProfileFields = (studentId) =>
  request('/documents/get-profile-fields', { params: { studentId } })

export const apiDocuments = (studentId) =>
  request('/documents/get', { params: { studentId } })

// ── Портфолио ────────────────────────────────────────────────────────────────
export const apiPortfolioList = () => request('/portfolio/operations/list')

export const apiPortfolioHistory = () => request('/portfolio/operations/history')

// ── Оплата ───────────────────────────────────────────────────────────────────
export const apiPaymentIndex = () => request('/payment/operations/index')

export const apiPaymentHistory = () => request('/payment/operations/history')

// ── Профиль ──────────────────────────────────────────────────────────────────
export const apiProfileSettings = () => request('/profile/operations/settings')
