import React, { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Settings as SettingsIcon, Sun, Moon, LogOut, GraduationCap, Gem, Coins } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useSettings } from '../settings/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { useAutoRate } from '../hooks/useAutoRate'
import { useDeadlines } from '../hooks/useDeadlines'
import { apiCounters, apiSignalCountUnread, apiHomeworkCounters, apiLibraryCounters } from '../api/endpoints'
import { qk } from '../api/queryKeys'
import { NAV_ITEMS, SETTINGS_NAV } from './navItems'
import { daysUntil } from '../utils/format'
import { NOTIFIED_KEY } from '../api/constants'

/**
 * Счётчики для бейджей меню (ДЗ / Материалы / Обращения).
 * Один хук — сайдбар и мобильная нижняя навигация показывают одни и те же цифры.
 * Запросы дедуплицируются React Query, дублирующих обращений к API нет.
 */
function useNavBadges() {
  const { user } = useAuth()

  const { data: counters } = useQuery({
    queryKey: qk.pageCounters,
    queryFn: () => apiCounters(0),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const { data: hwCounters } = useQuery({
    queryKey: qk.hwCounters,
    queryFn: apiHomeworkCounters,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const { data: libCounters } = useQuery({
    queryKey: qk.libraryCounters,
    queryFn: apiLibraryCounters,
    staleTime: 15 * 60 * 1000,
    retry: 0,
  })
  const { data: signalUnread } = useQuery({
    queryKey: qk.signalUnread,
    queryFn: apiSignalCountUnread,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const { data: deadlines } = useDeadlines(user?.current_group_id)

  const badge = (id) => {
    if (id === 'homework') {
      // новые ДЗ из общих счётчиков меню (type 100)
      const item = Array.isArray(counters) ? counters.find((c) => c.counter_type === 100) : null
      if (item?.counter > 0) return item.counter
      // запасной вариант: текущие ДЗ из /count/homework (type 3)
      const hw = Array.isArray(hwCounters) ? hwCounters.find((c) => c.counter_type === 3) : null
      return hw?.counter > 0 ? hw.counter : null
    }
    if (id === 'materials') {
      const item = Array.isArray(counters) ? counters.find((c) => c.counter_type === 400) : null
      if (item?.counter > 0) return item.counter
      // запасной вариант: сумма новых материалов из /count/library
      const n = (Array.isArray(libCounters) ? libCounters : []).reduce((s, c) => s + (c.new_count || 0), 0)
      return n > 0 ? n : null
    }
    if (id === 'signals') {
      const n = Number(signalUnread?.counter)
      return n > 0 ? n : null
    }
    return null
  }

  return { badge, dueToday: deadlines?.dueToday?.length || 0 }
}

function Sidebar() {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const { hiddenNav } = useSettings()
  const navigate = useNavigate()
  const { badge, dueToday } = useNavBadges()

  const items = NAV_ITEMS.filter((it) => !hiddenNav.includes(it.id))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const renderItem = (it) => {
    const Icon = typeof it.icon === 'string' ? SettingsIcon : it.icon
    const b = badge(it.id)
    return (
      <NavLink
        key={it.id}
        to={it.to}
        end={it.end}
        className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
      >
        <Icon />
        <span>{t(it.labelKey)}</span>
        {it.id === 'homework' && dueToday > 0 && (
          <span className="sidebar__due-dot" title={t('dashDueToday')} />
        )}
        {b != null && <span className="sidebar__badge">{b}</span>}
      </NavLink>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <GraduationCap size={24} style={{ color: 'var(--accent)' }} />
        Journal
      </div>
      <nav className="sidebar__nav">
        {items.map(renderItem)}
        {renderItem(SETTINGS_NAV)}
        {/* Вкладка «Объявления» и рекламные ссылки (MAX, «Классно!» и т.п.) удалены сознательно */}
      </nav>
      <div className="sidebar__footer">
        {user?.photo ? (
          <img className="sidebar__avatar" src={user.photo} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="sidebar__avatar" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{user?.full_name}</div>
          <div className="text-xs text-muted truncate">{user?.group_name}</div>
        </div>
        <button className="icon-btn" title={t('logout')} aria-label={t('logout')} onClick={handleLogout}>
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  )
}

/**
 * Нижняя навигация для мобильных (появляется вместо бургера):
 * все пункты меню в горизонтально прокручиваемой панели снизу.
 */
function BottomNav() {
  const { t } = useI18n()
  const { hiddenNav } = useSettings()
  const { badge, dueToday } = useNavBadges()

  const items = [...NAV_ITEMS.filter((it) => !hiddenNav.includes(it.id)), SETTINGS_NAV]

  return (
    <nav className="bottom-nav" aria-label={t('setNavMenu')}>
      {items.map((it) => {
        const Icon = typeof it.icon === 'string' ? SettingsIcon : it.icon
        const b = badge(it.id)
        return (
          <NavLink
            key={it.id}
            to={it.to}
            end={it.end}
            className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}
          >
            <span className="bottom-nav__icon">
              <Icon />
              {b != null && <span className="bottom-nav__badge">{b}</span>}
              {it.id === 'homework' && dueToday > 0 && <span className="bottom-nav__dot" />}
            </span>
            <span className="bottom-nav__label">{t(it.labelKey)}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

/**
 * Кошелёк в топбаре: Топгемы и Топкоины (как на оригинальном сайте).
 * Балансы приходят из /settings/user-info → user.gaming_points.
 * Соответствие типов — по словарю локализации оригинала (/public/translations):
 * COIN (id 2) = «Топгемы», DIAMOND (id 1) = «Топкоины».
 */
function WalletChips() {
  const { user } = useAuth()
  const { t, locale } = useI18n()

  const arr = Array.isArray(user?.gaming_points) ? user.gaming_points : []
  const gems = arr.find((g) => g.new_gaming_point_types__id === 2)?.points ?? null
  const coins = arr.find((g) => g.new_gaming_point_types__id === 1)?.points ?? null
  if (gems == null && coins == null) return null

  const fmt = (n) => new Intl.NumberFormat(locale).format(n)
  return (
    <div className="flex items-center gap-1.5">
      {gems != null && (
        <span className="tag" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }} title={t('achTopgems')}>
          <Gem size={14} />
          {fmt(gems)}
        </span>
      )}
      {coins != null && (
        <span className="tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} title={t('achTopcoins')}>
          <Coins size={14} />
          {fmt(coins)}
        </span>
      )}
    </div>
  )
}

export default function Layout() {
  const [toast, setToast] = useState(null)
  const { user } = useAuth()
  const { settings, setTheme, resolvedTheme } = useSettings()
  const { t } = useI18n()

  // onRated стабилен: тост теперь рендерится по ключу перевода
  const onRated = useCallback((n) => {
    setToast({ key: 'toastAutoRated', vars: { n }, ts: Date.now() })
  }, [])

  const { sessionCount } = useAutoRate({
    mode: settings.autoRateMode,
    isAuthed: Boolean(user),
    onRated,
  })

  // Web Notifications: напоминаем о работах «сдать сегодня/завтра»
  useDeadlineNotify({
    enabled: settings.deadlineNotify,
    isAuthed: Boolean(user),
    groupId: user?.current_group_id ?? null,
  })

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  const toggleTheme = () =>
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        {/* Топбар без гамбургера и аватарки: аватар — только в сайдбаре/кабинете.
            Переключатель темы оставлен для быстрого доступа (в настройках он тоже есть). */}
        <header className="topbar">
          <div className="font-bold italic">Journal</div>
          <div className="flex-1" />
          <WalletChips />
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={t('setTheme')}
            aria-label={t('setTheme')}
          >
            {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>
        <Outlet />
        <BottomNav />
        {toast && (
          <div className="toast" role="status">
            {t(toast.key, toast.vars)}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Напоминания о дедлайнах через Web Notifications.
 * Каждый цикл сравниваем работы «на сегодня/завтра» со списком уже
 * отправленных уведомлений в localStorage, чтобы не повторяться.
 */
function useDeadlineNotify({ enabled, isAuthed, groupId }) {
  const { t } = useI18n()
  // данные уже загружены в useNavBadges (тот же ключ) — здесь только читаем кеш
  const { data: deadlines } = useDeadlines(groupId, { enabled: false, refetch: false })

  useEffect(() => {
    if (!enabled || !isAuthed || !deadlines) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    let notified = []
    try {
      notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]')
    } catch {
      notified = []
    }
    const fresh = [...(deadlines.dueToday || []), ...(deadlines.dueTomorrow || [])]
      .filter((it) => it?.id && !notified.includes(it.id))
    for (const it of fresh) {
      const left = daysUntil(it.overdue_time)
      try {
        new Notification('Journal', {
          body: `${it.name_spec}: ${it.theme} — ${left === 0 ? t('dashDueToday') : t('dashDueTomorrow')}`,
          tag: `hw-${it.id}`,
        })
        notified.push(it.id)
      } catch { /* noop */ }
    }
    if (fresh.length) {
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified.slice(-300)))
    }
  }, [enabled, isAuthed, deadlines, t])
}
