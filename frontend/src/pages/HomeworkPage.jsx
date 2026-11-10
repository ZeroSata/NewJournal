import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, FlaskConical, FileDown, ExternalLink, ChevronDown, SearchX,
  UploadCloud, Trash2, FileUp, Clock, Star, X, CloudUpload,
  CalendarDays, CheckCircle2, FileText, MessageSquare, UserRound,
} from 'lucide-react'
import {
  apiHomeworkList, apiSubmitHomework, apiDeleteHomework, apiGroupHistory,
  apiHomeworkEvalTags, apiSaveHomeworkEvaluation,
} from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { qk } from '../api/queryKeys'
import { Card, Spinner, ErrorBox, Empty, SearchInput, Chip, Tag, MarkPill } from '../components/ui'
import { hwBucket, HW_BUCKETS, HW_STATUS_PARAM, normalize, daysUntil } from '../utils/format'

function useHomeworkInfinite(type, statusParam, groupId, specId) {
  return useInfiniteQuery({
    queryKey: qk.hwList({ type, status: statusParam, groupId, specId }),
    queryFn: ({ pageParam }) =>
      apiHomeworkList({ page: pageParam, status: statusParam, type, groupId, specId }),
    initialPageParam: 1,
    // Пагинация с защитой от дублей (поведение сервера проверено живьём):
    // часть работ сервер повторяет на КАЖДОЙ странице и признака конца
    // списка не отдаёт. Идём дальше только пока страница принесла хотя бы
    // одну работу с новым id — иначе список закончился.
    getNextPageParam: (last, allPages) => {
      const list = Array.isArray(last) ? last : []
      if (!list.length) return undefined
      const seen = new Set()
      for (const p of allPages.slice(0, -1)) {
        for (const it of Array.isArray(p) ? p : []) seen.add(it.id)
      }
      return list.some((it) => !seen.has(it.id)) ? allPages.length + 1 : undefined
    },
    staleTime: 2 * 60 * 1000,
  })
}

/** Склейка страниц без дублей: одни и те же работы приходят на разных страницах */
function dedupePages(data) {
  const out = []
  const seen = new Set()
  for (const it of (data?.pages || []).flat()) {
    if (it?.id == null || seen.has(it.id)) continue
    seen.add(it.id)
    out.push(it)
  }
  return out
}

const BUCKET_META = {
  overdue: { sectionKey: 'hwSectionOverdue', tag: 'overdue' },
  dueSoon: { sectionKey: 'hwSectionDueSoon', tag: 'soon' }, // свой стиль, не как «На проверке»
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
  const [subject, setSubject] = useState('all') // имя предмета

  const statusParam = statusFilter === 'all' ? undefined : HW_STATUS_PARAM[statusFilter]

  // Справочник предметов группы: id + название — для серверного фильтра spec_id
  const groupHistory = useQuery({
    queryKey: qk.groupHistory,
    queryFn: apiGroupHistory,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  })
  const subjects = useMemo(() => {
    const out = []
    const seen = new Set()
    for (const g of Array.isArray(groupHistory.data) ? groupHistory.data : []) {
      for (const s of g.specs || []) {
        if (seen.has(s.name)) continue
        seen.add(s.name)
        out.push({ id: s.id, name: s.name })
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }, [groupHistory.data])

  // Если у предмета известен id из справочника — фильтр уходит на сервер (spec_id);
  // для предметов без id работает клиентский фильтр по имени
  const specId = useMemo(
    () => subjects.find((s) => s.name === subject)?.id ?? undefined,
    [subjects, subject]
  )

  const hwQuery = useHomeworkInfinite(0, statusParam, groupId, specId)
  const labQuery = useHomeworkInfinite(1, statusParam, groupId, specId)

  // Страницы, склеенные без дублей (сервер повторяет работы между страницами)
  const hwItems = useMemo(() => dedupePages(hwQuery.data), [hwQuery.data])
  const labItems = useMemo(() => dedupePages(labQuery.data), [labQuery.data])

  // Предметы, найденные только в загруженных работах (в справочнике их нет)
  const extraSubjects = useMemo(() => {
    const seen = new Set(subjects.map((s) => s.name))
    const out = []
    const push = (list) =>
      (Array.isArray(list) ? list : []).forEach((it) => {
        if (it.name_spec && !seen.has(it.name_spec)) {
          seen.add(it.name_spec)
          out.push({ id: null, name: it.name_spec })
        }
      })
    push(hwItems)
    push(labItems)
    return out
  }, [subjects, hwItems, labItems])

  const allSubjects = useMemo(
    () => [...subjects, ...extraSubjects],
    [subjects, extraSubjects]
  )

  // Поиск подгружает все страницы в фоне (см. анализ: раньше поиск работал
  // только по уже загруженным шести работам)
  useEffect(() => {
    if (!search) return
    for (const q of [hwQuery, labQuery]) {
      if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage()
    }
  }, [search, hwQuery.hasNextPage, hwQuery.isFetchingNextPage, labQuery.hasNextPage, labQuery.isFetchingNextPage, hwQuery.data, labQuery.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    const out = []
    const seen = new Set() // одна работа не показывается дважды (ДЗ и ЛР-списки)
    const push = (list, type) => {
      for (const it of Array.isArray(list) ? list : []) {
        if (seen.has(it.id)) continue
        seen.add(it.id)
        out.push({ ...it, workType: type })
      }
    }
    if (typeFilter !== 'lab') push(hwItems, 0)
    if (typeFilter !== 'hw') push(labItems, 1)

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
  }, [hwItems, labItems, typeFilter, search, subject])

  const totalLoaded =
    (typeFilter !== 'lab' ? hwItems.length : 0) +
    (typeFilter !== 'hw' ? labItems.length : 0)

  const loading = hwQuery.isLoading || labQuery.isLoading
  const error = hwQuery.isError || labQuery.isError
  const hasNext = hwQuery.hasNextPage || labQuery.hasNextPage
  const fetchingMore = hwQuery.isFetchingNextPage || labQuery.isFetchingNextPage

  const loadMore = () => {
    if (hwQuery.hasNextPage) hwQuery.fetchNextPage()
    if (labQuery.hasNextPage) labQuery.fetchNextPage()
  }

  // «Ещё» подгружается само, когда конец списка виден на экране
  const sentinelRef = useRef(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNext) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '400px' }
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNext, fetchingMore, typeFilter, statusFilter, specId])

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
          {search && (hwQuery.hasNextPage || labQuery.hasNextPage) && (
            <p className="text-xs text-muted -mt-1">{t('hwSearchLoading')}</p>
          )}

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

          {allSubjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="hw-subject-select"
                className="text-xs text-muted font-semibold uppercase tracking-wide mr-1"
              >
                {t('hwSubject')}
              </label>
              <select
                id="hw-subject-select"
                className="field !w-auto !py-1.5 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="all">{t('hwSubjectAll')}</option>
                {allSubjects.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
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
                <div className="hw-grid">
                  {sec.list.map((it) => (
                    <HwCard key={`${it.workType}-${it.id}`} it={it} t={t} fmtShort={fmtShort} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="hw-grid">
              {sorted.map((it) => (
                <HwCard key={`${it.workType}-${it.id}`} it={it} t={t} fmtShort={fmtShort} />
              ))}
            </div>
          )}

          {/* Автодогрузка: маркер в конце списка */}
          <div ref={sentinelRef} style={{ height: 1 }} />

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

/**
 * Карточка одной работы — как на оригинальном сайте:
 * обложка задания, предмет, тема, преподаватель, сроки, файлы,
 * текст ответа, комментарии преподавателя, статус и оценка.
 */
function HwCard({ it, t, fmtShort }) {
  const queryClient = useQueryClient()
  const [submitOpen, setSubmitOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [msg, setMsg] = useState(null)

  const isLab = it.workType === 1
  const hs = it.homework_stud
  const mark = hs?.mark
  const canSubmit = !hs
  const canDelete = Boolean(hs) && mark == null

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hw-list'] })
    queryClient.invalidateQueries({ queryKey: ['count-homework'] })
    queryClient.invalidateQueries({ queryKey: ['page-counters'] })
    queryClient.invalidateQueries({ queryKey: ['deadlines'] })
  }

  const deleteMutation = useMutation({
    // ВАЖНО: сервер ждёт id СДАННОЙ работы (homework_stud.id), а не задания —
    // с id задания отвечает 422 (проверено живьём)
    mutationFn: () => apiDeleteHomework(hs?.id ?? it.id),
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

  const teacherComment = String(it.homework_comment || '').trim()
  const taskComment = String(it.comment || '').trim()
  const myAnswer = String(hs?.stud_answer || '').trim()

  return (
    <div
      className="card hw-card"
      style={it.bucket === 'overdue' ? { borderColor: 'var(--danger-soft)' } : undefined}
    >
      {/* Обложка работы (как на оригинале) с запасным фоном под иконку типа */}
      <div className="hw-card__cover">
        {it.cover_image ? (
          <img src={it.cover_image} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="hw-card__cover-fallback" style={{ color: isLab ? 'var(--accent)' : 'var(--info)' }}>
            {isLab ? <FlaskConical size={30} /> : <ClipboardList size={30} />}
          </div>
        )}
      </div>

      <div className="hw-card__body">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag kind={isLab ? 'lab' : 'hw'}>{isLab ? t('hwTagLab') : t('hwTagHw')}</Tag>
          <Tag kind={meta.tag}>{t(meta.sectionKey)}</Tag>
          {mark != null && (
            <span className="inline-flex items-center gap-1 text-xs">
              {t('hwMark')}: <MarkPill mark={mark} />
              {hs?.auto_mark && <span className="text-muted">({t('hwAutoMark')})</span>}
            </span>
          )}
        </div>

        <div className="text-xs text-muted truncate">{it.name_spec}</div>
        <div className="font-semibold text-[15px] leading-snug">{it.theme}</div>

        <div className="flex items-center gap-1.5 text-xs text-muted truncate">
          <UserRound size={13} className="shrink-0" />
          <span className="truncate">{it.fio_teach}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {it.creation_time && (
            <span className="text-muted inline-flex items-center gap-1">
              <CalendarDays size={12} /> {t('hwIssued')}: {fmtShort(it.creation_time)}
            </span>
          )}
          {it.overdue_time && (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: it.bucket === 'overdue' ? 'var(--danger)' : it.bucket === 'dueSoon' ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600 }}
            >
              <Clock size={12} /> {t('hwDeadline')}: {fmtShort(it.overdue_time)}
              {deadlineInfo && <span className="font-normal">· {deadlineInfo}</span>}
            </span>
          )}
          {hs && (
            <span className="text-muted inline-flex items-center gap-1">
              <CheckCircle2 size={12} /> {t('hwSentAt')}: {fmtShort(hs.creation_time)}
            </span>
          )}
        </div>

        {(it.file_path || hs?.file_path) && (
          <div className="flex flex-wrap gap-1.5">
            {it.file_path && (
              <a
                className="hw-attach"
                href={it.file_path}
                target="_blank"
                rel="noreferrer"
                title={it.filename || t('hwAttachTask')}
              >
                <FileText size={13} className="shrink-0" />
                <span className="truncate" style={{ maxWidth: 200 }}>{it.filename || t('hwAttachTask')}</span>
                <FileDown size={13} className="shrink-0" />
              </a>
            )}
            {hs?.file_path && (
              <a
                className="hw-attach"
                href={hs.file_path}
                target="_blank"
                rel="noreferrer"
                title={hs.filename || t('hwAttachMy')}
              >
                <FileUp size={13} className="shrink-0" />
                <span className="truncate" style={{ maxWidth: 200 }}>{hs.filename || t('hwAttachMy')}</span>
                <ExternalLink size={13} className="shrink-0" />
              </a>
            )}
          </div>
        )}

        {myAnswer && (
          <div className="hw-note" title={myAnswer}>
            <span className="hw-note__text"><b>{t('hwMyAnswer')}:</b> {myAnswer}</span>
          </div>
        )}
        {taskComment && (
          <div className="hw-note" title={taskComment}>
            <span className="hw-note__text"><b>{t('hwTaskComment')}:</b> {taskComment}</span>
          </div>
        )}
        {teacherComment && (
          <div className="hw-note hw-note--teacher" title={teacherComment}>
            <MessageSquare size={13} className="shrink-0" style={{ color: 'var(--accent)', marginTop: 2 }} />
            <span className="hw-note__text"><b>{t('hwTeacherComment')}:</b> {teacherComment}</span>
          </div>
        )}

        {msg && (
          <div className={`error-box mt-1 !text-xs`} style={msg.ok ? { background: 'var(--success-soft)', color: 'var(--success)' } : undefined}>
            {msg.text}
          </div>
        )}

        {confirmDelete && (
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ background: 'var(--danger-soft)', borderRadius: 10, padding: '8px 12px' }}>
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{t('hwDeleteConfirm')}</span>
            <button className="btn btn--primary !py-1.5 !px-3 text-xs" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? t('hwSending') : t('hwDelete')}
            </button>
            <button className="btn btn--ghost !py-1.5 !px-3 text-xs" onClick={() => setConfirmDelete(false)}>
              {t('cancel')}
            </button>
          </div>
        )}

        {(canSubmit || canDelete) && (
          <div className="flex items-center gap-2 mt-auto pt-2">
            {canSubmit && (
              <button className="btn btn--primary !py-2 !px-3 text-xs" onClick={() => setSubmitOpen(true)} title={t('hwSubmit')}>
                <UploadCloud size={14} />
                {t('hwSubmit')}
              </button>
            )}
            {canDelete && (
              <button className="btn btn--ghost !py-2 !px-3 text-xs" onClick={() => setConfirmDelete(true)} title={t('hwDelete')}>
                <Trash2 size={14} />
                {t('hwDelete')}
              </button>
            )}
          </div>
        )}
      </div>

      {submitOpen && (
        <SubmitModal
          hw={it}
          onClose={() => setSubmitOpen(false)}
          onDone={(m) => { if (m) setMsg(m); invalidate() }}
        />
      )}
    </div>
  )
}

/**
 * Модальное окно сдачи работы — как в оригинальном журнале:
 * файл (drag&drop), текстовый ответ, затраченное время,
 * звёздная оценка «хватит ли знаний?», быстрые теги, комментарий.
 *
 * Формат запроса проверен живьём: id + file + answerText + spentTime «ЧЧ:ММ»
 * (старые spentTimeHour/spentTimeMin дают 500). Оценка — вторым запросом
 * /homework/evaluation/operations/save (FormData EvaluationHomeworkForm).
 */
const HW_MIN_TEXT = 5
const HW_MAX_TEXT = 500
const HW_BAD_EXT = ['txt', 'csv'] // как в оригинале: .txt и .csv запрещены

function SubmitModal({ hw, onClose, onDone }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [answer, setAnswer] = useState('')
  const [file, setFile] = useState(null)
  const [fileErr, setFileErr] = useState(null)
  const [hours, setHours] = useState(1)
  const [minutes, setMinutes] = useState(0)
  const [mark, setMark] = useState(0)
  const [tags, setTags] = useState([])
  const [wantComment, setWantComment] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const evalTags = useQuery({
    queryKey: qk.hwEvalTags,
    queryFn: apiHomeworkEvalTags,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  })

  const createMutation = useMutation({ mutationFn: apiSubmitHomework })
  const evalMutation = useMutation({ mutationFn: apiSaveHomeworkEvaluation })

  const pickFile = (f) => {
    setError(null)
    setFileErr(null)
    if (!f) return
    const ext = String(f.name).split('.').pop()?.toLowerCase()
    if (HW_BAD_EXT.includes(ext)) {
      setFileErr(t('hwBadExt'))
      return
    }
    setFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer?.files?.[0] || null)
  }

  const toggleTag = (id) =>
    setTags((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const textLen = answer.trim().length
  const textBad = textLen > 0 && textLen < HW_MIN_TEXT
  const canSend = (textLen >= HW_MIN_TEXT || file) && !fileErr

  const send = async () => {
    setError(null)
    try {
      const spentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      const created = await createMutation.mutateAsync({
        id: hw.id,
        file: file || '',
        answerText: answer.trim(),
        spentTime,
      })
      // Оценка ДЗ — вторым шагом (как в оригинале), только если что-то выбрано
      const needEval = mark > 0 || tags.length > 0 || (wantComment && comment.trim())
      if (needEval && created?.id) {
        try {
          await evalMutation.mutateAsync({
            idDomZad: hw.id,
            idStud: user?.student_id,
            mark: mark || 0,
            comment: wantComment ? comment.trim() : '',
            tags,
          })
        } catch {
          onDone({ ok: false, text: t('hwEvalFail') })
          onClose()
          return
        }
      }
      onDone({ ok: true, text: t('hwSubmitOk') })
      onClose()
    } catch (e) {
      setError(e?.message || t('hwSubmitFail'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div
        className="card modal-card w-full"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('hwSubmitTitle')}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="card__title !mb-0">
            <FileUp size={18} />
            {t('hwSubmitTitle')}
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('hwDecline')}>
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-muted mt-0 mb-3 truncate">{hw.theme} · {hw.name_spec}</p>

        <div className="modal-scroll flex flex-col gap-3">
          {/* Файл: drag&drop + выбор по клику */}
          <div>
            {file ? (
              <div className="dropzone is-file">
                <FileUp size={18} style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-semibold truncate flex-1 min-w-0">{file.name}</span>
                <span className="text-xs text-muted shrink-0">{Math.ceil(file.size / 1024)} KB</span>
                <button
                  type="button"
                  className="icon-btn !w-8 !h-8"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  title={t('hwRemoveFile')}
                  aria-label={t('hwRemoveFile')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`dropzone ${dragOver ? 'is-drag' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <CloudUpload size={26} />
                <span className="text-sm font-semibold">{t('hwDropFile')}</span>
                <span className="text-xs text-muted">{t('hwFileHint')}</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
              aria-label={t('hwDropFile')}
            />
            {fileErr && <div className="text-xs mt-1 font-semibold" style={{ color: 'var(--danger)' }}>{fileErr}</div>}
          </div>

          {/* Текстовый ответ */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="hw-answer" className="text-sm text-muted">{t('hwAnswer')}</label>
              <span className={`text-xs ${textLen > HW_MAX_TEXT ? 'font-bold' : 'text-muted'}`} style={textLen > HW_MAX_TEXT ? { color: 'var(--danger)' } : undefined}>
                {textLen} / {HW_MAX_TEXT}
              </span>
            </div>
            <textarea
              id="hw-answer"
              className="field"
              rows={3}
              maxLength={HW_MAX_TEXT}
              value={answer}
              placeholder={t('hwAnswerPh')}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {textBad && (
              <div className="text-xs mt-1 font-semibold" style={{ color: 'var(--danger)' }}>
                {t('hwMinLen', { n: HW_MIN_TEXT })}
              </div>
            )}
          </div>

          {/* Затраченное время */}
          <div>
            <label htmlFor="hw-time-h" className="text-sm text-muted mb-1 block">{t('hwSpentTime')}</label>
            <div className="flex gap-2">
              <select
                id="hw-time-h"
                className="field"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                aria-label="hours"
              >
                {Array.from({ length: 13 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>{h} h</option>
                ))}
              </select>
              <select
                className="field"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                aria-label="minutes"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
          </div>

          {/* Оценка ДЗ: звёзды + теги + комментарий (как на оригинале) */}
          <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold mb-1">{t('hwEvalTitle')}</div>
            <p className="text-xs text-muted mt-0 mb-2">{t('hwRateQuestion')}</p>
            <div className="flex items-center gap-1 mb-3" role="radiogroup" aria-label={t('hwRateQuestion')}>
              {[1, 2, 3, 4, 5].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`star-btn ${m <= mark ? 'is-on' : ''}`}
                  onClick={() => setMark(m)}
                  role="radio"
                  aria-checked={mark === m}
                  aria-label={`${m}`}
                >
                  <Star size={26} />
                </button>
              ))}
            </div>

            {Array.isArray(evalTags.data) && evalTags.data.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {evalTags.data.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`chip !py-1.5 !px-3 text-xs ${tags.includes(tag.id) ? 'is-active' : ''}`}
                    onClick={() => toggleTag(tag.id)}
                    aria-pressed={tags.includes(tag.id)}
                  >
                    {t(tag.translate_key)}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="flex items-center gap-2 text-sm font-semibold"
              onClick={() => setWantComment((v) => !v)}
              aria-expanded={wantComment}
              style={{ color: wantComment ? 'var(--accent)' : 'var(--text-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <span className={`switch switch--sm ${wantComment ? 'is-on' : ''}`} aria-hidden="true" />
              {t('hwWantComment')}
            </button>
            {wantComment && (
              <textarea
                className="field mt-2"
                rows={2}
                maxLength={HW_MAX_TEXT}
                value={comment}
                placeholder={t('hwCommentPh')}
                onChange={(e) => setComment(e.target.value)}
                aria-label={t('hwCommentPh')}
              />
            )}
          </div>

          {error && <div className="error-box">{error}</div>}
        </div>

        <div className="flex gap-2 justify-end pt-3 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn btn--ghost" onClick={onClose}>
            {t('hwDecline')}
          </button>
          <button className="btn btn--primary" disabled={!canSend || createMutation.isPending} onClick={send}>
            <UploadCloud size={15} />
            {createMutation.isPending ? t('hwSending') : t('hwSend')}
          </button>
        </div>
      </div>
    </div>
  )
}
