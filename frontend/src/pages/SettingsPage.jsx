import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Sun, Moon, Monitor, Languages, Zap, Info, User, LogOut, Eraser, BookOpen,
  ListTree, ChevronDown, Eye, EyeOff, Bell, KeyRound, Users, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useSettings } from '../settings/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { useNavigate } from 'react-router-dom'
import { AUTO_RATED_KEY } from '../api/constants'
import { qk } from '../api/queryKeys'
import { apiProfileSettings, apiChangePassword } from '../api/endpoints'
import { Card, ErrorBox } from '../components/ui'
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
          aria-expanded={open}
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

/** Смена пароля */
function PasswordForm() {
  const { t } = useI18n()
  const [oldPassword, setOld] = useState('')
  const [newPassword, setNew] = useState('')
  const [repeat, setRepeat] = useState('')
  const [msg, setMsg] = useState(null)

  // Правило оригинального клиента: 8+ символов, две заглавные и две строчные
  const PASS_RE = /^(?=.*[A-Z].*[A-Z])(?=.*[a-z].*[a-z])[0-9a-zA-Z!@#$%^&*]{8,}$/

  const mutation = useMutation({
    mutationFn: () => apiChangePassword({ oldPassword, newPassword, repeatNewPassword: repeat }),
    onSuccess: () => {
      setMsg({ ok: true, text: t('setPassOk') })
      setOld('')
      setNew('')
      setRepeat('')
    },
    onError: (e) => setMsg({ ok: false, text: e?.message || t('setPassFail') }),
  })

  const submit = (e) => {
    e.preventDefault()
    if (!oldPassword || !newPassword || !repeat) {
      setMsg({ ok: false, text: t('setPassFill') })
      return
    }
    if (newPassword !== repeat) {
      setMsg({ ok: false, text: t('setPassMismatch') })
      return
    }
    if (!PASS_RE.test(newPassword)) {
      setMsg({ ok: false, text: t('setPassRule') })
      return
    }
    mutation.mutate()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="text-sm font-semibold flex items-center gap-2">
        <KeyRound size={15} />
        {t('setPassTitle')}
      </div>
      <div className="flex flex-wrap gap-3">
        <input
          type="password"
          className="field flex-1 !min-w-[180px]"
          placeholder={t('setPassOld')}
          value={oldPassword}
          onChange={(e) => setOld(e.target.value)}
          autoComplete="current-password"
          aria-label={t('setPassOld')}
        />
        <input
          type="password"
          className="field flex-1 !min-w-[180px]"
          placeholder={t('setPassNew')}
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          autoComplete="new-password"
          aria-label={t('setPassNew')}
        />
        <input
          type="password"
          className="field flex-1 !min-w-[180px]"
          placeholder={t('setPassRepeat')}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          autoComplete="new-password"
          aria-label={t('setPassRepeat')}
        />
      </div>
      <div className="text-xs text-muted">{t('setPassRule')}</div>
      {msg && (
        <div
          className="text-xs font-semibold rounded-lg px-3 py-2"
          style={{
            background: msg.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
            color: msg.ok ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {msg.text}
        </div>
      )}
      <div>
        <button type="submit" className="btn btn--primary !py-2 text-sm" disabled={mutation.isPending}>
          {mutation.isPending ? t('setPassSaving') : t('setPassSave')}
        </button>
      </div>
    </form>
  )
}

/** Переключатель активной группы (если их несколько) */
function GroupSwitcher() {
  const { t } = useI18n()
  const { user, switchGroup } = useAuth()
  const [msg, setMsg] = useState(null)
  const groups = Array.isArray(user?.groups) ? user.groups : []
  if (groups.length <= 1) return null

  const onChange = async (e) => {
    const id = Number(e.target.value)
    if (!id || id === user.current_group_id) return
    setMsg(null)
    try {
      await switchGroup(id)
      setMsg({ ok: true, text: t('setGroupSwitched') })
    } catch (err) {
      setMsg({ ok: false, text: err?.message || t('setGroupSwitchFail') })
    }
  }

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Users size={15} />
        {t('setGroupSwitch')}
      </div>
      <p className="text-xs text-muted mb-2">{t('setGroupSwitchHint')}</p>
      <select
        className="field !w-auto !py-2 text-sm"
        value={user.current_group_id}
        onChange={onChange}
        aria-label={t('setGroupSwitch')}
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}{g.is_primary ? ' ★' : ''}
          </option>
        ))}
      </select>
      {msg && (
        <div
          className="text-xs font-semibold rounded-lg px-3 py-2 mt-2"
          style={{
            background: msg.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
            color: msg.ok ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { settings, setTheme, setLang, setAutoRateMode, setAutoRateMark, setDeadlineNotify } = useSettings()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [, force] = useState(0)

  // Данные профиля: email/телефон и прочее (эндпоинт /profile/operations/settings)
  const profile = useQuery({
    queryKey: qk.profileSettings,
    queryFn: apiProfileSettings,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  })

  const themeOptions = [
    { key: 'light', icon: <Sun size={16} />, label: t('setThemeLight') },
    { key: 'dark', icon: <Moon size={16} />, label: t('setThemeDark') },
    { key: 'system', icon: <Monitor size={16} />, label: t('setThemeSystem') },
  ]

  const autoRateModes = [
    { key: 'off', label: t('setModeOff') },
    { key: 'auto', label: t('setModeAuto') },
    { key: 'confirm', label: t('setModeConfirm') },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const resetAutoRated = () => {
    localStorage.removeItem(AUTO_RATED_KEY)
    force((n) => n + 1)
  }

  // Включение уведомлений: сначала спрашиваем разрешение браузера
  const enableNotifications = async (on) => {
    if (!on) {
      setDeadlineNotify(false)
      return
    }
    if (typeof Notification === 'undefined') {
      setDeadlineNotify(false)
      return
    }
    let perm = Notification.permission
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission()
      } catch {
        perm = 'denied'
      }
    }
    setDeadlineNotify(perm === 'granted')
  }

  const notifBlocked =
    settings.deadlineNotify === false &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'denied'

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
                  aria-pressed={settings.theme === o.key}
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
                aria-pressed={settings.lang === 'ru'}
              >
                {t('setLangRu')}
              </button>
              <button
                className={`chip ${settings.lang === 'en' ? 'is-active' : ''}`}
                onClick={() => setLang('en')}
                aria-pressed={settings.lang === 'en'}
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

        {/* Автооценка: три режима вместо простого включателя */}
        <Card title={t('setAutoRate')} icon={<Zap size={17} />}>
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2">{t('setAutoRateMode')}</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {autoRateModes.map((m) => (
                <button
                  key={m.key}
                  className={`chip ${settings.autoRateMode === m.key ? 'is-active' : ''}`}
                  onClick={() => setAutoRateMode(m.key)}
                  aria-pressed={settings.autoRateMode === m.key}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted max-w-[520px]">
              {settings.autoRateMode === 'auto' ? t('setModeAutoDesc') : ''}
              {settings.autoRateMode === 'confirm' ? t('setModeConfirmDesc') : ''}
              {settings.autoRateMode === 'off' ? t('setModeOffDesc') : ''}
            </div>
          </div>

          {settings.autoRateMode === 'auto' && (
            <div className="mb-4">
              <div className="text-sm font-semibold mb-2">{t('setAutoRateMark')}</div>
              <div className="flex flex-wrap gap-2">
                {[5, 4].map((m) => (
                  <button
                    key={m}
                    className={`chip ${settings.autoRateMark === m ? 'is-active' : ''}`}
                    onClick={() => setAutoRateMark(m)}
                    aria-pressed={settings.autoRateMark === m}
                  >
                    {t(`setMark${m}`)}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted mt-2">{t('setAutoRateMarksHint')}</div>
            </div>
          )}

          <div className="text-xs text-muted mb-3 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            {t('setAutoRateNote')}
          </div>

          {settings.autoRateMode !== 'off' && (
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
          )}
        </Card>

        {/* Напоминания о дедлайнах */}
        <Card title={t('setNotif')} icon={<Bell size={17} />}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold mb-1">{t('setNotif')}</div>
              <div className="text-xs text-muted max-w-[460px]">{t('setNotifDesc')}</div>
              {settings.deadlineNotify && (
                <div className="text-xs mt-2 font-bold" style={{ color: 'var(--success)' }}>
                  {t('setNotifGranted')}
                </div>
              )}
              {notifBlocked && (
                <div className="text-xs mt-2 font-bold" style={{ color: 'var(--danger)' }}>
                  {t('setNotifBlocked')}
                </div>
              )}
            </div>
            <Switch
              on={Boolean(settings.deadlineNotify)}
              onChange={enableNotifications}
              label={t('setNotif')}
            />
          </div>
        </Card>

        {/* Аккаунт: профиль, смена группы, смена пароля, выход */}
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
              {profile.data?.email && (
                <div className="text-xs text-muted mt-0.5">email: {profile.data.email}</div>
              )}
              {profile.data?.phone && (
                <div className="text-xs text-muted">tel: {profile.data.phone}</div>
              )}
            </div>
            <button className="btn btn--ghost !py-2 text-sm" onClick={handleLogout}>
              <LogOut size={15} />
              {t('logout')}
            </button>
          </div>

          <GroupSwitcher />

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <PasswordForm />
          </div>

          {profile.isError && (
            <div className="mt-3">
              <ErrorBox title={t('noData')} onRetry={() => profile.refetch()} />
            </div>
          )}
        </Card>

        {/* О приложении */}
        <Card title={t('setAbout')} icon={<BookOpen size={17} />}>
          <p className="text-sm text-muted m-0">{t('setAboutText')}</p>
          <p className="text-xs text-muted mt-3 mb-0 flex items-start gap-2">
            <ShieldCheck size={14} className="shrink-0 mt-0.5" />
            {t('setSecurityNote')}
          </p>
        </Card>
      </div>
    </main>
  )
}
