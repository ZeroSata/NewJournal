import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { SETTINGS_KEY } from '../api/constants'

const DEFAULTS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  lang: 'ru',      // 'ru' | 'en'
  autoRate: false, // автооценка занятий
  autoRateMark: 5, // какая оценка ставится (2..5)
  hiddenNav: [],   // id пунктов сайдбара, скрытых пользователем
}

const SettingsContext = createContext(null)

function applyTheme(theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  return dark ? 'dark' : 'light'
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
    } catch {
      return { ...DEFAULTS }
    }
  })

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    document.documentElement.lang = settings.lang
  }, [settings])

  // Следим за системной темой, если выбран режим "как в системе"
  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  // Применяем тему при любом изменении
  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  const value = useMemo(() => {
    const update = (patch) => setSettings((s) => ({ ...s, ...patch }))
    const resolvedTheme = applyTheme(settings.theme)
    const hiddenNav = Array.isArray(settings.hiddenNav) ? settings.hiddenNav : []
    return {
      settings,
      update,
      resolvedTheme,
      hiddenNav,
      setTheme: (theme) => update({ theme }),
      setLang: (lang) => update({ lang }),
      setAutoRate: (autoRate) => update({ autoRate }),
      setAutoRateMark: (autoRateMark) => update({ autoRateMark }),
      // Показать/скрыть пункт меню сайдбара
      toggleNav: (id) =>
        setSettings((s) => {
          const cur = Array.isArray(s.hiddenNav) ? s.hiddenNav : []
          return { ...s, hiddenNav: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }
        }),
      showAllNav: () => update({ hiddenNav: [] }),
    }
  }, [settings])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}
