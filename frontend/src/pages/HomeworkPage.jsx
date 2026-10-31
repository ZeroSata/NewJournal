import React, { useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, FlaskConical, FileDown, ExternalLink, ChevronDown, SearchX,
  UploadCloud, Trash2, FileUp, Clock,
} from 'lucide-react'
import { apiHomeworkList, apiSubmitHomework, apiDeleteHomework } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { Card, Spinner, ErrorBox, Empty, SearchInput, Chip, Tag, MarkPill } from '../components/ui'
import { hwBucket, HW_BUCKETS, HW_STATUS_PARAM, normalize, daysUntil } from '../utils/format'

const PAGE_SIZE = 6

function useHomeworkInfinite(type, statusParam, groupId) {
  return useInfiniteQuery({
    queryKey: ['hw-list', type, statusParam ?? 'all', groupId],
    queryFn: ({ pageParam }) =>
      apiHomeworkList({ page: pageParam, status: statusParam, type, groupId }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      Array.isArray(last) && last.length === PAGE_SIZE ? pages.length + 1 : undefined,
    staleTime: 2 * 60 * 1000,
  })
}

// Серверный статус ↔ клиенты buckets
const STATUS_TO_BUCKETS = {
  all: null,
  overdue: ['overdue'],
  current: ['current', 'dueSoon'],
  checking: ['checking'],
  checked: ['checked'],
}

const BUCKET_META = {
  overdue: { sectionKey: 'hwSectionOverdue', tag: 'overdue' },
  dueSoon: { sectionKey: 'hwSectionDueSoon', tag: 'checking' },
  current: { sectionKey: 'hwSectionCurrent', tag: 'current' },
  checking: { sectionKey: 'hwSectionChecking', tag: 'checking' },
  checked: { sectionKey: 'hwSectionChecked', tag: 'checked' },
}

export default function HomeworkPage() {
  const { t, fmtShort } = useI18n()
  const { user } = useAuth()
  const groupId = user?.current_group_id

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // all | hw | lab
  const [statusFilter, setStatusFilter] = useState('all')
  const [subject, setSubject] = useState('all')

  const statusParam = statusFilter === 'all' ? undefined : HW_STATUS_PARAM[statusFilter]
  const hwQuery = useHomeworkInfinite(0, statusParam, groupId)
  const labQuery = useHomeworkInfinite(1, statusParam, groupId)

  const items = useMemo(() => {
    const out = []
    const push = (list, type) => {
      for (const it of Array.isArray(list) ? list : []) out.push({ ...it, workType: type })
    }
    if (typeFilter !== 'lab') push(hwQuery.data?.pages?.flat(), 0)
    if (typeFilter !== 'hw') push(labQuery.data?.pages?.flat(), 1)

    const q = normalize(search)
    return out
      .filter((it) => {
        if (subject !== 'all' && it.name_spec !== subject) return false
        if (!q) return true
        return (
          normalize(it.theme).includes(q) ||
          normalize(it.name_spec).includes(q) ||
          normalize(it.fio_teach).includes(q) ||
          normalize(it.comment).includes(q)
        )
      })
      .map((it) => ({ ...it, bucket: hwBucket(it) }))
  }, [hwQuery.data, labQuery.data, typeFilter, search, subject])

  const subjects = useMemo(() => {
    const set = new Set()
    const push = (list) => (Array.isArray(list) ? list : []).forEach((it) => it.name_spec && set.add(it.name_spec))
    push(hwQuery.data?.pages?.flat())
    push(labQuery.data?.pages?.flat())
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [hwQuery.data, labQuery.data])

  const totalLoaded =
    (typeFilter !== 'lab' ? (hwQuery.data?.pages?.flat().length || 0) : 0) +
    (typeFilter !== 'hw' ? (labQuery.data?.pages?.flat().length || 0) : 0)

  const loading = hwQuery.isLoading || labQuery.isLoading
  const error = hwQuery.isError || labQuery.isError
  const hasNext = hwQuery.hasNextPage || labQuery.hasNextPage
  const fetchingMore = hwQuery.isFetchingNextPage || labQuery.isFetchingNextPage

  const loadMore = () => {
    if (hwQuery.hasNextPage) hwQuery.fetchNextPage()
    if (labQuery.hasNextPage) labQuery.fetchNextPage()
  }

  // Сортировка внутри bucket
  const sorted = useMemo(() => {
    const rank = Object.fromEntries(HW_BUCKETS.map((b, i) => [b, i]))
    return items
      .slice()
      .sort((a, b) => {
        if (rank[a.bucket] !== rank[b.bucket]) return rank[a.bucket] - rank[b.bucket]
        if (a.bucket === 'checked' || a.bucket === 'checking') {
          return String(b.homework_stud?.creation_time || '').localeCompare(String(a.homework_stud?.creation_time || ''))
        }
        return String(a.overdue_time || '').localeCompare(String(b.overdue_time || ''))
      })
  }, [items])

  const sections = useMemo(() => {
    if (statusFilter !== 'all') return null // плоский список конкретного статуса
    return HW_BUCKETS.map((b) => ({
      bucket: b,
      list: sorted.filter((it) => it.bucket === b),
    })).filter((s) => s.list.length > 0)
  }, [sorted, statusFilter])

  return (
    <main className="page">
      <h1 className="page__title">{t('hwTitle')}</h1>
      <p className="page__subtitle">
        {t('hwSubtitle')}
        {statusFilter === 'all' ? ` · ${t('hwSectionsHint')}` : ''}
      </p>

      {/* Панель фильтров */}
      <div className="card mb-4">
        <div className="flex flex-col gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder={t('hwSearch')} />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted font-semibold uppercase tracking-wide mr-1">{t('hwType')}</span>
            <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>{t('hwTypeAll')}</Chip>
            <Chip active={typeFilter === 'hw'} onClick={() => setTypeFilter('hw')}>
              <ClipboardList size={13} /> {t('hwTypeHw')}
            </Chip>
            <Chip active={typeFilter === 'lab'} onClick={() => setTypeFilter('lab')}>
              <FlaskConical size={13} /> {t('hwTypeLab')}
            </Chip>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted font-semibold uppercase tracking-wide mr-1">{t('hwStatus')}</span>
            <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>{t('hwStatusAll')}</Chip>
            <Chip active={statusFilter === 'current'} onClick={() => setStatusFilter('current')}>{t('hwStatusCurrent')}</Chip>
            <Chip active={statusFilter === 'checking'} onClick={() => setStatusFilter('checking')}>{t('hwStatusChecking')}</Chip>
            <Chip active={statusFilter === 'checked'} onClick={() => setStatusFilter('checked')}>{t('hwStatusChecked')}</Chip>
            <Chip active={statusFilter === 'overdue'} onClick={() => setStatusFilter('overdue')}>{t('hwStatusOverdue')}</Chip>
          </div>

          {subjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted font-semibold uppercase tracking-wide mr-1">{t('hwSubject')}</span>
              <select className="field !w-auto !py-1.5 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="all">{t('hwSubjectAll')}</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card><ErrorBox onRetry={() => { hwQuery.refetch(); labQuery.refetch() }} /></Card>
      ) : items.length === 0 ? (
        <Card>
          <Empty
            text={totalLoaded === 0 ? t('hwNoItems') : t('hwNotFound')}
            icon={SearchX}
          />
          {totalLoaded > 0 && <p className="text-center text-xs text-muted -mt-4 mb-2">{t('hwChangeFilters')}</p>}
        </Card>
      ) : (
        <>
          <div className="text-xs text-muted mb-2">
            {t('hwShown')} <b>{items.length}</b> {t('hwOfLoaded')} {totalLoaded}
          </div>

          {sections ? (
            // Режим «Все статусы»: секции в порядке —
            // просрочки → скоро сдавать → текущие → на проверке → проверено
            sections.map((sec) => (
              <div key={sec.bucket} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Tag kind={BUCKET_META[sec.bucket].tag}>{t(BUCKET_META[sec.bucket].sectionKey)}</Tag>
                  <span className="text-xs text-muted">{sec.list.length}</span>
                  <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
                </div>
                <div className="flex flex-col gap-2">
                  {sec.list.map((it) => (
                    <HwCard key={`${it.workType}-${it.id}`} it={it} t={t} fmtShort={fmtShort} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((it) => (
                <HwCard key={`${it.workType}-${it.id}`} it={it} t={t} fmtShort={fmtShort} />
              ))}
            </div>
          )}

          {hasNext && (
            <div className="flex justify-center mt-4">
              <button className="btn btn--ghost" onClick={loadMore} disabled={fetchingMore}>
                {fetchingMore ? t('hwLoading') : t('hwLoadMore')}
                <ChevronDown size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}

/** Карточка одного задания */
function HwCard({ it, t, fmtShort }) {
  const queryClient = useQueryClient()
  const [submitOpen, setSubmitOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [msg, setMsg] = useState(null)

  const isLab = it.workType === 1
  const mark = it.homework_stud?.mark
  const canSubmit = !it.homework_stud
  const canDelete = Boolean(it.homework_stud) && mark == null

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hw-list'] })
    queryClient.invalidateQueries({ queryKey: ['count-homework'] })
    queryClient.invalidateQueries({ queryKey: ['page-counters'] })
  }

  const deleteMutation = useMutation({
    mutationFn: () => apiDeleteHomework(it.id),
    onSuccess: () => {
      setConfirmDelete(false)
      setMsg({ ok: true, text: t('hwDeleteOk') })
      invalidate()
    },
    onError: () => setMsg({ ok: false, text: t('hwDeleteFail') }),
  })

  const meta = BUCKET_META[it.bucket]
  const left = daysUntil(it.overdue_time)
  const deadlineInfo =
    it.bucket === 'overdue'
      ? t('hwOverdueBy', { n: Math.abs(left) })
      : it.bucket === 'dueSoon'
        ? left === 0 ? t('hwDueToday') : t('hwDaysLeft', { n: left })
        : null

  return (
    <div className="lesson-row !items-start" style={it.bucket === 'overdue' ? { borderColor: 'var(--danger-soft)', background: 'var(--danger-soft)' } : undefined}>
      <div
        className="lesson-row__num"
        title={isLab ? t('hwTagLab') : t('hwTagHw')}
        style={isLab ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { background: 'var(--info-soft)', color: 'var(--info)' }}
      >
        {isLab ? <FlaskConical size={16} /> : <ClipboardList size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <Tag kind={isLab ? 'lab' : 'hw'}>{isLab ? t('hwTagLab') : t('hwTagHw')}</Tag>
          <span className="font-semibold text-sm">{it.theme}</span>
        </div>
        <div className="text-xs text-muted mb-1.5">
          {it.name_spec} · {it.fio_teach}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Tag kind={meta.tag}>{t(meta.sectionKey)}</Tag>
          {deadlineInfo && (
            <span className="inline-flex items-center gap-1" style={{ color: it.bucket === 'overdue' ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
              <Clock size={12} /> {deadlineInfo}
            </span>
          )}
          {mark != null && (
            <span className="inline-flex items-center gap-1">
              {t('hwMark')}: <MarkPill mark={mark} />
              {it.homework_stud?.auto_mark && <span className="text-muted">({t('hwAutoMark')})</span>}
            </span>
          )}
          {it.creation_time && (
            <span className="text-muted">{t('hwIssued')}: {fmtShort(it.creation_time)}</span>
          )}
          {it.overdue_time && (
            <span className="text-muted">{t('hwDeadline')}: {fmtShort(it.overdue_time)}</span>
          )}
        </div>

        {msg && (
          <div className={`error-box mt-2 !text-xs ${msg.ok ? '' : ''}`} style={msg.ok ? { background: 'var(--success-soft)', color: 'var(--success)' } : undefined}>
            {msg.text}
          </div>
        )}

        {confirmDelete && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ background: 'var(--danger-soft)', borderRadius: 10, padding: '8px 12px' }}>
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{t('hwDeleteConfirm')}</span>
            <button className="btn btn--primary !py-1.5 !px-3 text-xs" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? t('hwSending') : t('hwDelete')}
            </button>
            <button className="btn btn--ghost !py-1.5 !px-3 text-xs" onClick={() => setConfirmDelete(false)}>
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 shrink-0">
        {it.file_path && (
          <a className="icon-btn" href={it.file_path} target="_blank" rel="noreferrer" title={t('download')}>
            <FileDown size={16} />
          </a>
        )}
        {it.homework_stud?.file_path && (
          <a className="icon-btn" href={it.homework_stud.file_path} target="_blank" rel="noreferrer" title={t('open')}>
            <ExternalLink size={16} />
          </a>
        )}
        {canSubmit && (
          <button className="btn btn--primary !py-2 !px-3 text-xs" onClick={() => setSubmitOpen(true)} title={t('hwSubmit')}>
            <UploadCloud size={14} />
            {t('hwSubmit')}
          </button>
        )}
        {canDelete && (
          <button className="icon-btn" onClick={() => setConfirmDelete(true)} title={t('hwDelete')}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {submitOpen && <SubmitModal hw={it} onClose={() => setSubmitOpen(false)} onDone={invalidate} />}
    </div>
  )
}

/** Модальное окно сдачи работы: комментарий + файл + затраченное время */
function SubmitModal({ hw, onClose, onDone }) {
  const { t } = useI18n()
  const [answer, setAnswer] = useState('')
  const [file, setFile] = useState(null)
  const [hours, setHours] = useState(1)
  const [minutes, setMinutes] = useState(0)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const mutation = useMutation({
    mutationFn: () =>
      apiSubmitHomework({
        id: hw.id,
        file: file || '',
        answerText: answer,
        spentTimeHour: Number(hours) || 0,
        spentTimeMin: Number(minutes) || 0,
      }),
    onSuccess: () => {
      onDone()
      onClose()
    },
    onError: (e) => setError(e?.message || t('hwSubmitFail')),
  })

  const canSend = Boolean(answer.trim() || file)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="card w-full" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="card__title !mb-0">
            <FileUp size={18} />
            {t('hwSubmitTitle')}
          </h3>
          <span className="text-xs text-muted truncate ml-3 flex-1 text-right">{hw.theme}</span>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-muted mb-1 block">{t('hwAnswer')}</label>
            <textarea
              className="field"
              rows={4}
              value={answer}
              placeholder={t('hwAnswerPh')}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-1 block">{t('hwFile')}</label>
            <input ref={fileRef} type="file" className="field" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && <div className="text-xs text-muted mt-1">{t('hwFileChosen', { name: file.name })}</div>}
          </div>

          <div>
            <label className="text-sm text-muted mb-1 block">{t('hwSpentTime')}</label>
            <div className="flex gap-2">
              <select className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {Array.from({ length: 9 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>{h} h</option>
                ))}
              </select>
              <select className="field" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="error-box">{error}</div>}

          <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button className="btn btn--ghost" onClick={onClose}>
              {t('cancel')}
            </button>
            <button className="btn btn--primary" disabled={!canSend || mutation.isPending} onClick={() => mutation.mutate()}>
              <UploadCloud size={15} />
              {mutation.isPending ? t('hwSending') : t('hwSend')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
