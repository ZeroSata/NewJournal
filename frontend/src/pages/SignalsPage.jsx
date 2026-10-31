import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquareWarning, Send, CheckCircle2, Clock3 } from 'lucide-react'
import { apiSignalsList, apiSignalProblems, apiCreateSignal } from '../api/endpoints'
import { useI18n } from '../i18n/I18nContext'
import { Card, Spinner, ErrorBox, Empty, Tag } from '../components/ui'

function statusMeta(status) {
  if (status === 2) return { label: 'sigStatusDone', kind: 'checked' }
  if (status === 1) return { label: 'sigStatusWork', kind: 'checking' }
  return { label: 'sigStatus0', kind: 'current' }
}

export default function SignalsPage() {
  const { t, fmtShort } = useI18n()
  const queryClient = useQueryClient()

  const problems = useQuery({ queryKey: ['signal-problems'], queryFn: apiSignalProblems, staleTime: Infinity })
  const signals = useQuery({ queryKey: ['signals-list'], queryFn: apiSignalsList, staleTime: 60 * 1000 })

  const [problemId, setProblemId] = useState('')
  const [theme, setTheme] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null) // {ok, text}

  const createMutation = useMutation({
    mutationFn: () =>
      apiCreateSignal({
        problemId: Number(problemId),
        theme: theme.trim(),
        message: message.trim(),
      }),
    onSuccess: () => {
      setResult({ ok: true, text: t('sigOk') })
      setTheme('')
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['signals-list'] })
      queryClient.invalidateQueries({ queryKey: ['signal-unread'] })
    },
    onError: (e) => setResult({ ok: false, text: e?.message || t('sigFail') }),
  })

  const canSend = problemId !== '' && message.trim().length > 0
  const list = Array.isArray(signals.data) ? signals.data : []

  return (
    <main className="page">
      <h1 className="page__title">{t('sigTitle')}</h1>
      <p className="page__subtitle">{t('sigSubtitle')}</p>

      <div className="grid-2">
        {/* Форма нового обращения */}
        <Card title={t('sigNew')} icon={<Send size={17} />}>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-muted mb-1 block">{t('sigProblem')}</label>
              <select
                className="field"
                value={problemId}
                onChange={(e) => setProblemId(e.target.value)}
                disabled={problems.isLoading}
              >
                <option value="">{problems.isLoading ? t('loading') : '—'}</option>
                {(Array.isArray(problems.data) ? problems.data : []).map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-muted mb-1 block">{t('sigTheme')}</label>
              <input
                className="field"
                value={theme}
                placeholder={t('sigThemePh')}
                onChange={(e) => setTheme(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-muted mb-1 block">{t('sigMessage')}</label>
              <textarea
                className="field"
                rows={5}
                value={message}
                placeholder={t('sigMessagePh')}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {result && (
              <div
                className="error-box"
                style={result.ok ? { background: 'var(--success-soft)', color: 'var(--success)' } : undefined}
              >
                {result.text}
              </div>
            )}

            <button
              className="btn btn--primary w-full"
              disabled={!canSend || createMutation.isPending}
              onClick={() => {
                setResult(null)
                createMutation.mutate()
              }}
            >
              <Send size={15} />
              {createMutation.isPending ? t('sigSending') : t('sigSend')}
            </button>
          </div>
        </Card>

        {/* Список обращений */}
        <Card title={t('sigTitle')} icon={<MessageSquareWarning size={17} />}>
          {signals.isLoading ? (
            <Spinner />
          ) : signals.isError ? (
            <ErrorBox onRetry={() => signals.refetch()} />
          ) : list.length === 0 ? (
            <Empty text={t('sigEmpty')} icon={MessageSquareWarning} />
          ) : (
            <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
              {list.map((s, i) => {
                const meta = statusMeta(s.status)
                return (
                  <div key={s.id ?? i} className="lesson-row !items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm truncate">{s.theme || s.problem_name}</span>
                        <Tag kind={meta.kind}>{t(meta.label)}</Tag>
                      </div>
                      <div className="text-xs text-muted mb-1">
                        {s.problem_name || ''}
                        {s.date_start ? ` · ${fmtShort(String(s.date_start).slice(0, 10))}` : ''}
                      </div>
                      {s.message && (
                        <div className="text-xs text-muted line-clamp-3">{s.message}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}
