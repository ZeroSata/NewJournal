import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './styles/global.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { SettingsProvider, useSettings } from './settings/SettingsContext'
import { I18nProvider } from './i18n/I18nContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
  },
})

function Providers() {
  const { settings } = useSettings()
  return (
    <I18nProvider lang={settings.lang}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <Providers />
    </SettingsProvider>
  </React.StrictMode>
)
