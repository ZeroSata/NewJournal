import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { BrowserRouter } from 'react-router-dom'
import './styles/global.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './auth/AuthContext'
import { SettingsProvider, useSettings } from './settings/SettingsContext'
import { I18nProvider } from './i18n/I18nContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000, // кеш живёт сутки — переживёт перезагрузку вкладки
    },
  },
})

// Persist кеша: приложение открывается мгновенно с прошлыми данными,
// пока в фоне подгружаются свежие (см. анализ, п. 4)
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'journal.rq-cache',
})

function Providers() {
  const { settings } = useSettings()
  return (
    <I18nProvider lang={settings.lang}>
      {/* PersistQueryClientProvider расширяет QueryClientProvider — API тот же */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000, buster: 'v1' }}
      >
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </PersistQueryClientProvider>
    </I18nProvider>
  )
}

// Service Worker — только в production-сборке
function ServiceWorkerRegistration() {
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* без PWA тоже работаем */ })
    }
  }, [])
  return null
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <Providers />
        <ServiceWorkerRegistration />
      </SettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
