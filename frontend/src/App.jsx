import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'

// Code splitting: каждая страница — отдельный чанк (раньше все 12 страниц
// грузились одним бандлом, а предупреждение сборки заглушалось лимитом 1600 КБ)
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const HomeworkPage = lazy(() => import('./pages/HomeworkPage'))
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'))
const GradesPage = lazy(() => import('./pages/GradesPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const CabinetPage = lazy(() => import('./pages/CabinetPage'))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'))
const SignalsPage = lazy(() => import('./pages/SignalsPage'))
const PaymentPage = lazy(() => import('./pages/PaymentPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function Protected({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div style={{ paddingTop: 120 }}><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

const pageFallback = <div style={{ paddingTop: 80 }}><Spinner /></div>

export default function App() {
  const { ready } = useAuth()

  return (
    <Suspense fallback={pageFallback}>
      <Routes>
        <Route
          path="/login"
          element={ready ? <LoginPage /> : <div style={{ paddingTop: 120 }}><Spinner /></div>}
        />
        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/homework" element={<HomeworkPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/grades" element={<GradesPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/cabinet" element={<CabinetPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
