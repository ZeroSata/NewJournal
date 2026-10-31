import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiLogin, apiUserInfo } from '../api/endpoints'
import { setTokens, getTokens, setOnLogout } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const queryClient = useQueryClient()

  // Восстановление сессии по сохранённым токенам
  useMemo(() => {
    if (getTokens()?.access_token) {
      apiUserInfo()
        .then(setUser)
        .catch(() => setTokens(null))
        .finally(() => setReady(true))
    } else {
      setReady(true)
    }
  }, [])

  const logout = useCallback(() => {
    setTokens(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useMemo(() => setOnLogout(logout), [logout])

  const login = useCallback(async (username, password) => {
    const tokens = await apiLogin(username, password)
    setTokens(tokens)
    const info = await apiUserInfo()
    setUser(info)
    return info
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, logout, isAuthed: Boolean(user) }),
    [user, ready, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
