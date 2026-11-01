import {
  Home, CalendarDays, ClipboardList, BookOpen, BarChart3, Trophy,
  FileText, Briefcase, MessageSquareWarning, CreditCard,
  CalendarCheck2, IdCard,
} from 'lucide-react'

/**
 * Все вкладки обычного журнала, кроме «Объявлений» (удалены по требованию).
 * Реклама (MAX, «Классно!»), маркет, сторис и реферальная программа
 * тоже вырезаны сознательно.
 *
 * Новое в v1.2:
 *  - «Посещаемость» — отдельная вкладка с подробной статистикой;
 *  - «Личный кабинет» — профиль, обучение и награды (как на оригинале).
 *
 * id используется в настройках: пользователь может скрыть любой пункт
 * сайдбара (Настройки → «Пункты меню»). Настройки сами скрыть нельзя.
 */
export const NAV_ITEMS = [
  { id: 'home', to: '/', icon: Home, labelKey: 'navHome', end: true },
  { id: 'schedule', to: '/schedule', icon: CalendarDays, labelKey: 'navSchedule' },
  { id: 'homework', to: '/homework', icon: ClipboardList, labelKey: 'navHomework' },
  { id: 'materials', to: '/materials', icon: BookOpen, labelKey: 'navMaterials' },
  { id: 'grades', to: '/grades', icon: BarChart3, labelKey: 'navGrades' },
  { id: 'attendance', to: '/attendance', icon: CalendarCheck2, labelKey: 'navAttendance' },
  { id: 'achievements', to: '/achievements', icon: Trophy, labelKey: 'navAchievements' },
  { id: 'documents', to: '/documents', icon: FileText, labelKey: 'navDocuments' },
  { id: 'portfolio', to: '/portfolio', icon: Briefcase, labelKey: 'navPortfolio' },
  { id: 'signals', to: '/signals', icon: MessageSquareWarning, labelKey: 'navSignals' },
  { id: 'payment', to: '/payment', icon: CreditCard, labelKey: 'navPayment' },
  { id: 'cabinet', to: '/cabinet', icon: IdCard, labelKey: 'navCabinet' },
]

// «Настройки» — служебный пункт, показывается всегда
export const SETTINGS_NAV = { id: 'settings', to: '/settings', icon: 'settings', labelKey: 'navSettings' }
