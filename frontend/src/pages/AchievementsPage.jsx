import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Gem, Coins, Lock, CheckCircle2 } from 'lucide-react'
import { apiAchievements } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { Card, StatCard, Spinner, ErrorBox, Empty } from '../components/ui'

/** Человекочитаемое имя достижения, если нет перевода */
function prettyKey(key) {
  return String(key || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function AchievementsPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  const q = useQuery({ queryKey: ['achievements'], queryFn: apiAchievements, staleTime: 10 * 60 * 1000 })

  const gaming = useMemo(() => {
    const arr = Array.isArray(user?.gaming_points) ? user.gaming_points : []
    const gems = arr.find((g) => g.new_gaming_point_types__id === 1)?.points ?? null
    const coins = arr.find((g) => g.new_gaming_point_types__id === 2)?.points ?? null
    return { gems, coins }
  }, [user])

  const list = useMemo(() => {
    const arr = Array.isArray(q.data) ? q.data : []
    return arr
      .map((a) => ({
        ...a,
        name: t(`ach.${a.translate_key}`) !== `ach.${a.translate_key}` ? t(`ach.${a.translate_key}`) : prettyKey(a.translate_key),
      }))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active))
  }, [q.data, t])

  const activeCount = list.filter((a) => a.is_active).length

  return (
    <main className="page">
      <h1 className="page__title">{t('achTitle')}</h1>
      <p className="page__subtitle">
        {t('achSubtitle')}
        {list.length ? ` · ${activeCount}/${list.length}` : ''}
      </p>

      <div className="stats-grid mb-4">
        <StatCard
          icon={<Gem size={19} style={{ color: 'var(--warning)' }} />}
          tone="warning"
          value={gaming.gems ?? '—'}
          label={t('achTopgems')}
        />
        <StatCard
          icon={<Coins size={19} style={{ color: 'var(--accent)' }} />}
          tone="accent"
          value={gaming.coins ?? '—'}
          label={t('achTopcoins')}
        />
        <StatCard
          icon={<Trophy size={19} style={{ color: 'var(--success)' }} />}
          tone="success"
          value={activeCount || '—'}
          label={t('achTitle')}
        />
      </div>

      {q.isLoading ? (
        <Spinner />
      ) : q.isError ? (
        <Card><ErrorBox onRetry={() => q.refetch()} /></Card>
      ) : list.length === 0 ? (
        <Card><Empty text={t('noData')} icon={Trophy} /></Card>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
        >
          {list.map((a) => (
            <div
              key={a.id}
              className="card flex items-start gap-3"
              style={a.is_active ? { borderColor: 'var(--success-soft)', boxShadow: '0 0 0 1px var(--success-soft)' } : { opacity: 0.75 }}
            >
              <div
                className="lesson-row__num !w-10 !h-10"
                style={{ background: a.is_active ? 'var(--success-soft)' : 'var(--surface-2)', color: a.is_active ? 'var(--success)' : 'var(--text-muted)' }}
              >
                {a.is_active ? <CheckCircle2 size={19} /> : <Lock size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm leading-snug">{a.name}</div>
                <div className="text-xs mt-1" style={{ color: a.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                  {a.is_active ? t('achActive') : t('achLocked')}
                </div>
                {Array.isArray(a.achieve_points) && a.achieve_points.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {a.achieve_points.map((p) =>
                      p.points_count > 0 ? (
                        <span key={p.id} className="tag tag--mark">
                          +{p.points_count} {t('achPoints')}
                        </span>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
