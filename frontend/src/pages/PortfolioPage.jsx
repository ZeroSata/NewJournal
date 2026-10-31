import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, History, ExternalLink } from 'lucide-react'
import { apiPortfolioList, apiPortfolioHistory } from '../api/endpoints'
import { useI18n } from '../i18n/I18nContext'
import { Card, Spinner, ErrorBox, Empty, Tag } from '../components/ui'

export default function PortfolioPage() {
  const { t, fmtShort } = useI18n()

  const list = useQuery({ queryKey: ['portfolio-list'], queryFn: apiPortfolioList, staleTime: 5 * 60 * 1000 })
  const history = useQuery({ queryKey: ['portfolio-history'], queryFn: apiPortfolioHistory, staleTime: 5 * 60 * 1000 })

  const works = Array.isArray(list.data) ? list.data : []
  const hist = Array.isArray(history.data) ? history.data : []

  return (
    <main className="page">
      <h1 className="page__title">{t('portTitle')}</h1>
      <p className="page__subtitle">{t('portSubtitle')}</p>

      <Card title={t('portTitle')} icon={<Briefcase size={17} />} className="mb-4">
        {list.isLoading ? (
          <Spinner />
        ) : list.isError ? (
          <ErrorBox onRetry={() => list.refetch()} />
        ) : works.length === 0 ? (
          <Empty text={t('portEmpty')} icon={Briefcase} />
        ) : (
          <div className="flex flex-col gap-2">
            {works.map((w, i) => (
              <div key={w.id ?? i} className="lesson-row">
                <div className="lesson-row__num">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{w.theme || w.name || `#${w.id}`}</div>
                  <div className="text-xs text-muted truncate">
                    {[w.spec_name, w.date ? fmtShort(w.date) : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {(w.file_path || w.url) && (
                  <a className="icon-btn" href={w.file_path || w.url} target="_blank" rel="noreferrer" title={t('open')}>
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('portHistory')} icon={<History size={17} />}>
        {history.isLoading ? (
          <Spinner />
        ) : history.isError ? (
          <ErrorBox onRetry={() => history.refetch()} />
        ) : hist.length === 0 ? (
          <Empty text={t('portHistoryEmpty')} icon={History} />
        ) : (
          <div className="flex flex-col gap-2">
            {hist.map((h, i) => (
              <div key={h.id ?? i} className="lesson-row">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{h.theme || h.action || `#${h.id}`}</div>
                  <div className="text-xs text-muted">
                    {h.date || h.creation_time ? fmtShort(h.date || h.creation_time) : ''}
                  </div>
                </div>
                {h.status != null && <Tag kind="current">{h.status}</Tag>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  )
}
