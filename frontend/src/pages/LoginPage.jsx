import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useSettings } from '../settings/SettingsContext'
import { useI18n } from '../i18n/I18nContext'
import { setLangProvider } from '../api/client'

export default function LoginPage() {
  const { login } = useAuth()
  const { settings, setLang, resolvedTheme, setTheme } = useSettings()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      setLangProvider(() => (settings.lang === 'en' ? 'en_US, en' : 'ru_RU, ru'))
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.status === 401 ? t('loginError') : t('loginFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-card__logo">
          <GraduationCap size={30} style={{ color: 'var(--accent)' }} />
          {t('loginTitle')}
        </div>
        <p className="text-center text-muted mb-6">{t('loginSubtitle')}</p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-muted mb-1 block">{t('username')}</label>
            <input
              className="field"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-muted mb-1 block">{t('password')}</label>
            <div className="relative">
              <input
                className="field pr-10"
                type={show ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 icon-btn !border-0 !w-8 !h-8"
                onClick={() => setShow((v) => !v)}
                tabIndex={-1}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="error-box">{error}</div>}

          <button className="btn btn--primary w-full" disabled={busy}>
            {busy ? t('signingIn') : t('signIn')}
          </button>
        </form>

        <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <select
            className="field !w-auto text-sm"
            value={settings.lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
          <button
            className="icon-btn"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={t('setTheme')}
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
