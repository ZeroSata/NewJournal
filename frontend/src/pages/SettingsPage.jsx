import React, { useState } from 'react'
import {
  Sun, Moon, Monitor, Languages, Zap, Info, User, LogOut, Eraser, BookOpen,
  ListTree, ChevronDown, Eye, EyeOff,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useSettings } from '../settings/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { useNavigate } from 'react-router-dom'
import { AUTO_RATED_KEY } from '../api/constants'
import { Card } from '../components/ui'
import { autoRateStats } from '../hooks/useAutoRate'
import { NAV_ITEMS } from '../components/navItems'

function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      className={`switch ${on ? 'is-on' : ''}`}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={label}
    />
  )
}

/** Выпадающий список пунктов сайдбара с чекбоксами */
function NavMenuPicker() {
  const { t } = useI18n()
  const { hiddenNav, toggleNav, showAllNav } = useSettings()
  const [open, setOpen] = useState(false)

  const visibleCount = NAV_ITEMS.length - hiddenNav.length
  const hideAll = () => {
    // все, кроме «Настроек» (их скрыть нельзя)
    NAV_ITEMS.forEach((it) => {
      if (!hiddenNav.includes(it.id)) toggleNav(it.id)
    })
  }

  return (
    <div>
      <div className="text-sm font-semibold mb-2 flex items-center gap-2">
        <ListTree size={15} />
        {t('setNavMenu')}
      </div>
      <p className="text-xs text-muted mb-2">{t('setNavMenuDesc')}</p>
      <div className="text-xs text-muted mb-2">
        {t('setNavShown', { n: visibleCount, m: NAV_ITEMS.length })}
      </div>

      <div className="relative">
        <button
          type="button"
          className="btn btn--ghost w-full !justify-between"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <ListTree size={16} />
            {t('setNavMenu')}
          </span>
          <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {open && (
          <div
            className="absolute left-0 right-0 mt-2 rounded-xl p-2 z-20"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              maxHeight: 340,
              overflowY: 'auto',
            }}
          >
            {NAV_ITEMS.map((it) => {
              const visible = !hiddenNav.includes(it.id)
              const Icon = it.icon
              return (
                <label
                  key={it.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => toggleNav(it.id)}
                    className="w-4 h-4"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <Icon size={16} style={{ color: 'var(--text-muted)' }} />
                  <span>{t(it.labelKey)}</span>
                  <span className="ml-auto" style={{ color: visible ? 'var(--success)' : 'var(--text-muted)' }}>
                    {visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </span>
                </label>
              )
            })}
            <div className="flex gap-2 pt-2 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <button className="btn btn--ghost !py-1.5 !px-3 text-xs flex-1" onClick={showAllNav}>
                {t('setNavShowAll')}
              </button>
              <button className="btn btn--ghost !py-1.5 !px-3 text-xs flex-1" onClick={hideAll}>
                {t('setNavHideAll')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { settings, setTheme, setLang, setAutoRate, setAutoRateMark } = useSettings()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [, force] = useState(0)

  const themeOptions = [
    { key: 'light', icon: <Sun size={16} />, label: t('setThemeLight') },
    { key: 'dark', icon: <Moon size={16} />, label: t('setThemeDark') },
    { key: 'system', icon: <Monitor size={16} />, label: t('setThemeSystem') },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const resetAutoRated = () => {
    localStorage.removeItem(AUTO_RATED_KEY)
    force((n) => n + 1)
  }

  return (
    <main className="page">
      <h1 className="page__title">{t('setTitle')}</h1>
      <p className="page__subtitle">{t('setSubtitle')}</p>

      <div className="flex flex-col gap-4" style={{ maxWidth: 760 }}>
        {/* Внешний вид */}
        <Card title={t('setAppearance')} icon={<Sun size={17} />}>
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2">{t('setTheme')}</div>
            <div className="flex flex-wrap gap-2">
              {themeOptions.map((o) => (
                <button
                  key={o.key}
                  className={`chip ${settings.theme === o.key ? 'is-active' : ''}`}
                  onClick={() => setTheme(o.key)}
                >
                  {o.icon}
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Languages size={15} />
              {t('setLanguage')}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={`chip ${settings.lang === 'ru' ? 'is-active' : ''}`}
                onClick={() => setLang('ru')}
              >
                {t('setLangRu')}
              </button>
              <button
                className={`chip ${settings.lang === 'en' ? 'is-active' : ''}`}
                onClick={() => setLang('en')}
              >
                {t('setLangEn')}
              </button>
            </div>
          </div>
        </Card>

        {/* Пункты меню сайдбара */}
        <Card title={t('setNavMenu')} icon={<ListTree size={17} />}>
          <NavMenuPicker />
        </Card>

        {/* Автооценка */}
        <Card title={t('setAutoRate')} icon={<Zap size={17} />}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-sm font-semibold mb-1">{t('setAutoRateState')}</div>
              <div className="text-xs text-muted max-w-[460px]">{t('setAutoRateDesc')}</div>
              <div className="text-xs mt-2 font-bold" style={{ color: settings.autoRate ? 'var(--success)' : 'var(--text-muted)' }}>
                {settings.autoRate ? t('setAutoRateOn') : t('setAutoRateOff')}
              </div>
            </div>
            <Switch on={settings.autoRate} onChange={setAutoRate} label={t('setAutoRate')} />
          </div>

          <div className="mb-4">
            <div className="text-sm font-semibold mb-2">{t('setAutoRateMark')}</div>
            <div className="flex flex-wrap gap-2">
              {[5, 4, 3, 2].map((m) => (
                <button
                  key={m}
                  className={`chip ${settings.autoRateMark === m ? 'is-active' : ''}`}
                  onClick={() => setAutoRateMark(m)}
                >
                  {t(`setMark${m}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted mb-3 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            {t('setAutoRateNote')}
          </div>

          <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold mb-1">
              {t('setAutoRateToday')}: <b>{autoRateStats.sessionCount}</b>{' '}
              <span className="text-muted font-normal">{t('setAutoRateTodaySession')}</span>
            </div>
            <div className="text-xs text-muted mb-2">{t('setAutoRateResetDesc')}</div>
            <button className="btn btn--ghost !py-2 text-sm" onClick={resetAutoRated}>
              <Eraser size={15} />
              {t('setAutoRateReset')}
            </button>
          </div>
        </Card>

        {/* Аккаунт */}
        <Card title={t('setAccount')} icon={<User size={17} />}>
          <div className="flex items-center gap-4">
            {user?.photo && (
              <img className="sidebar__avatar !w-14 !h-14" src={user.photo} alt="" referrerPolicy="no-referrer" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold">{user?.full_name}</div>
              <div className="text-sm text-muted">
                {t('setGroup')}: {user?.group_name} · {t('setStream')}: {user?.stream_name}
              </div>
            </div>
            <button className="btn btn--ghost !py-2 text-sm" onClick={handleLogout}>
              <LogOut size={15} />
              {t('logout')}
            </button>
          </div>
        </Card>

        {/* О приложении */}
        <Card title={t('setAbout')} icon={<BookOpen size={17} />}>
          <p className="text-sm text-muted m-0">{t('setAboutText')}</p>
        </Card>
      </div>
    </main>
  )
}
