import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Settings as SettingsIcon, Menu, X, Sun, Moon, LogOut, GraduationCap,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useSettings } from '../settings/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { useAutoRate } from '../hooks/useAutoRate'
import { apiCounters, apiSignalCountUnread, apiHomeworkCounters } from '../api/endpoints'
import { NAV_ITEMS, SETTINGS_NAV } from './navItems'

function Sidebar({ open, onClose }) {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const { hiddenNav } = useSettings()
  const navigate = useNavigate()

  const { data: counters } = useQuery({
    queryKey: ['page-counters'],
    queryFn: () => apiCounters(0),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: hwCounters } = useQuery({
    queryKey: ['count-homework'],
    queryFn: apiHomeworkCounters,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: signalUnread } = useQuery({
    queryKey: ['signal-unread'],
    queryFn: apiSignalCountUnread,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  // Бейдж для пункта меню
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
      return item?.counter > 0 ? item.counter : null
    }
    if (id === 'signals') {
      const n = Number(signalUnread?.counter)
      return n > 0 ? n : null
    }
    return null
  }

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
        {b != null && <span className="sidebar__badge">{b}</span>}
      </NavLink>
    )
  }

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="sidebar__logo">
        <GraduationCap size={24} style={{ color: 'var(--accent)' }} />
        Journal
      </div>
      <nav className="sidebar__nav" onClick={onClose}>
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
        <button className="icon-btn" title={t('logout')} onClick={handleLogout}>
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const { user } = useAuth()
  const { settings, setTheme, resolvedTheme } = useSettings()
  const { t } = useI18n()

  const { sessionCount } = useAutoRate({
    enabled: settings.autoRate,
    isAuthed: Boolean(user),
    onRated: (n) => setToast({ text: t('toastAutoRated', { n }), ts: Date.now() }),
  })

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const toggleTheme = () =>
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')

  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn burger" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="font-bold italic hidden sm:block">Journal</div>
          <div className="flex-1" />
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={t('setTheme')}
            aria-label={t('setTheme')}
          >
            {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {user?.photo && (
            <img
              className="sidebar__avatar !w-9 !h-9"
              src={user.photo}
              alt=""
              referrerPolicy="no-referrer"
            />
          )}
        </header>
        <Outlet />
        {toast && <div className="toast">{toast.text}</div>}
      </div>
    </div>
  )
}
