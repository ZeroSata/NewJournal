import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { apiLogin, apiUserInfo, apiChangeCurrentGroup } from '../api/endpoints'
import { setTokens, getTokens, setOnLogout } from '../api/client'
import { qk } from '../api/queryKeys'

const AuthContext = createContext(null)

/**
 * Токены сбрасываются ТОЛЬКО если сервер ответил 401 и refresh не помог.
 * Один 403 от DDoS-Guard, обрыв сети или 5xx больше не стирают сессию —
 * раньше любой такой сбой выбрасывал пользователя из аккаунта.
 */
function isAuthFailure(err) {
  return err instanceof ApiError && err.status === 401
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const queryClient = useQueryClient()

  // Восстановление сессии по сохранённым токенам — в useEffect,
  // а не useMemo (в StrictMode useMemo выполнялся дважды: двойной user-info)
  useEffect(() => {
    let cancelled = false
    if (!getTokens()?.access_token) {
      setReady(true)
      return
    }
    const load = async (attempt = 0) => {
      try {
        const info = await apiUserInfo()
        if (!cancelled) setUser(info)
      } catch (err) {
        if (cancelled) return
        if (isAuthFailure(err)) {
          // refresh уже был сделан в client.js и не помог — сессия истекла
          setTokens(null)
        } else if (attempt < 2) {
          // сетевой сбой: токены НЕ трогаем, пробуем ещё раз
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
          return load(attempt + 1)
        }
        // после 3 неудач (не по 401) оставляем токены —
        // пользователь сможет просто перезагрузить страницу
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const logout = useCallback(() => {
    setTokens(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => setOnLogout(logout), [logout])

  const login = useCallback(async (username, password) => {
    const tokens = await apiLogin(username, password)
    setTokens(tokens)
    const info = await apiUserInfo()
    setUser(info)
    return info
  }, [])

  // Обновить профиль (после смены данных, аватара, группы и т.п.)
  const refreshUser = useCallback(async () => {
    const info = await apiUserInfo()
    setUser(info)
    queryClient.setQueryData(qk.userInfo, info)
    return info
  }, [queryClient])

  // Переключение активной группы (несколько групп у студента)
  const switchGroup = useCallback(async (groupId) => {
    await apiChangeCurrentGroup(groupId)
    const info = await refreshUser()
    // расписания/списки зависят от группы — сбрасываем кеш
    queryClient.invalidateQueries({ queryKey: ['schedule'] })
    queryClient.invalidateQueries({ queryKey: ['hw-list'] })
    queryClient.invalidateQueries({ queryKey: ['deadlines'] })
    queryClient.invalidateQueries({ queryKey: ['hw-group-history'] })
    return info
  }, [queryClient, refreshUser])

  const value = useMemo(
    () => ({ user, ready, login, logout, refreshUser, switchGroup, isAuthed: Boolean(user) }),
    [user, ready, login, logout, refreshUser, switchGroup]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
