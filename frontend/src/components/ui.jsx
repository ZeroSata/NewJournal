import React from 'react'
import { Search, Inbox, AlertTriangle } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'

export function Card({ title, icon, children, className = '', actions = null }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="card__title !mb-0">
            {icon}
            {title}
          </h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="loading" />
}

export function Empty({ text, icon }) {
  const Icon = icon || Inbox
  return (
    <div className="empty">
      <Icon />
      <div>{text}</div>
    </div>
  )
}

export function ErrorBox({ onRetry, title }) {
  const { t } = useI18n()
  return (
    <div className="empty">
      <AlertTriangle />
      <div className="font-semibold mb-3">{title || t('errorTitle')}</div>
      {onRetry && (
        <button className="btn btn--ghost" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search-box w-full">
      <Search />
      <input
        className="field"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function Chip({ active, children, onClick }) {
  return (
    <button type="button" className={`chip ${active ? 'is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

export function StatCard({ icon, tone, value, label, delta }) {
  const tones = {
    accent: 'var(--accent-soft)',
    success: 'var(--success-soft)',
    warning: 'var(--warning-soft)',
    danger: 'var(--danger-soft)',
    info: 'var(--info-soft)',
  }
  return (
    <div className="card stat-card">
      <div className="stat-card__icon" style={{ background: tones[tone] || tones.accent }}>
        {icon}
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {delta != null && <div className="stat-card__delta">{delta}</div>}
    </div>
  )
}

export function MarkPill({ mark }) {
  if (mark == null || mark === '') return null
  const m = Number(mark)
  const tone = m >= 5 ? '5' : m >= 4 ? '4' : m >= 3 ? '3' : String(Math.max(m, 1))
  return <span className={`mark-pill mark-pill--${tone}`}>{mark}</span>
}

export function Tag({ kind, children }) {
  return <span className={`tag tag--${kind}`}>{children}</span>
}
