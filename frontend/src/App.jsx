import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SchedulePage from './pages/SchedulePage'
import HomeworkPage from './pages/HomeworkPage'
import MaterialsPage from './pages/MaterialsPage'
import GradesPage from './pages/GradesPage'
import AchievementsPage from './pages/AchievementsPage'
import DocumentsPage from './pages/DocumentsPage'
import PortfolioPage from './pages/PortfolioPage'
import SignalsPage from './pages/SignalsPage'
import PaymentPage from './pages/PaymentPage'
import SettingsPage from './pages/SettingsPage'
import { Spinner } from './components/ui'

function Protected({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div style={{ paddingTop: 120 }}><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { ready } = useAuth()

  return (
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
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/signals" element={<SignalsPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
