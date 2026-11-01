import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { translations } from './translations'
import { setLangProvider, setApiErrorMessageFactory } from '../api/client'

const LANG_HEADER = { ru: 'ru_RU, ru', en: 'en_US, en' }

const I18nContext = createContext(null)

export function I18nProvider({ lang, children }) {
  // Словарь доступен не-React модулям (client.js, useAutoRate)
  useEffect(() => {
    setLangProvider(() => LANG_HEADER[lang] || 'ru_RU, ru')
  }, [lang])

  const value = useMemo(() => {
    const dict = translations[lang] || translations.ru
    const t = (key, vars) => {
      let s = dict[key] ?? translations.ru[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v)
      }
      return s
    }
    const locale = lang === 'en' ? 'en-GB' : 'ru-RU'
    const fmtDate = (d) => {
      const date = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : d
      if (Number.isNaN(date?.getTime?.())) return d || ''
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    }
    const fmtShort = (d) => {
      const date = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : d
      if (Number.isNaN(date?.getTime?.())) return d || ''
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date)
    }
    const fmtWeekday = (d) => {
      const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : d
      if (Number.isNaN(date?.getTime?.())) return ''
      return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
    }
    return { t, lang, locale, fmtDate, fmtShort, fmtWeekday }
  }, [lang])

  // «Ошибка API (404)» больше не зашита по-русски: текст берётся из словаря
  useEffect(() => {
    const dict = translations[lang] || translations.ru
    setApiErrorMessageFactory((status) => {
      let s = dict.apiError ?? `API error (${status})`
      return s.replace('{status}', String(status))
    })
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
