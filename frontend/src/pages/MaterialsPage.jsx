import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ExternalLink, FileDown, SearchX, ImageOff } from 'lucide-react'
import { apiLibraryList, apiGroupHistory, apiMarkMaterialUsed } from '../api/endpoints'
import { LIBRARY_TYPES } from '../api/constants'
import { useI18n } from '../i18n/I18nContext'
import { Spinner, ErrorBox, Empty, SearchInput, Chip, Tag } from '../components/ui'
import { normalize } from '../utils/format'

const TYPE_IDS = Object.keys(LIBRARY_TYPES).map(Number)

async function fetchAllMaterials() {
  const results = await Promise.all(
    TYPE_IDS.map(async (type) => {
      try {
        const list = await apiLibraryList(type, 1)
        return Array.isArray(list) ? list.map((m) => ({ ...m, material_type: m.material_type ?? type })) : []
      } catch {
        return []
      }
    })
  )
  const seen = new Set()
  const merged = []
  for (const list of results) {
    for (const m of list) {
      const key = m.material_id ?? `${m.theme}|${m.date}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(m)
    }
  }
  return merged
}

export default function MaterialsPage() {
  const { t, fmtShort } = useI18n()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(0) // 0 = все
  const [subject, setSubject] = useState('all')

  const q = useQuery({ queryKey: ['library-all'], queryFn: fetchAllMaterials, staleTime: 10 * 60 * 1000 })
  const specs = useQuery({ queryKey: ['group-history'], queryFn: apiGroupHistory, staleTime: Infinity })

  const specNameById = useMemo(() => {
    const map = {}
    for (const g of specs.data || []) {
      for (const s of g.specs || []) {
        map[`${s.subject_source}:${s.subject_id}`] = s.name
        map[s.id] = s.name
      }
    }
    return map
  }, [specs.data])

  const materials = useMemo(() => {
    const list = (q.data || []).map((m) => ({
      ...m,
      subjectName:
        m.name_spec ||
        specNameById[m.id_spec] ||
        specNameById[`${m.subject_source}:${m.subject_id}`] ||
        null,
    }))
    return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [q.data, specNameById])

  const typeCounts = useMemo(() => {
    const counts = {}
    for (const m of materials) counts[m.material_type] = (counts[m.material_type] || 0) + 1
    return counts
  }, [materials])

  const subjects = useMemo(() => {
    const set = new Set()
    materials.forEach((m) => m.subjectName && set.add(m.subjectName))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [materials])

  const filtered = useMemo(() => {
    const query = normalize(search)
    return materials.filter((m) => {
      if (typeFilter !== 0 && m.material_type !== typeFilter) return false
      if (subject !== 'all' && m.subjectName !== subject) return false
      if (!query) return true
      return normalize(m.theme).includes(query) || normalize(m.description).includes(query) || normalize(m.subjectName).includes(query)
    })
  }, [materials, typeFilter, subject, search])

  const markUsed = useMutation({
    mutationFn: apiMarkMaterialUsed,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['page-counters'] }),
  })

  const openMaterial = (m, url) => {
    if (m.material_id) markUsed.mutate(m.material_id)
    window.open(url, '_blank', 'noopener')
  }

  const presentTypes = TYPE_IDS.filter((id) => (typeCounts[id] || 0) > 0)

  return (
    <main className="page">
      <h1 className="page__title">{t('matTitle')}</h1>
      <p className="page__subtitle">{t('matSubtitle')}</p>

      <div className="card mb-4">
        <div className="flex flex-col gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder={t('matSearch')} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted font-semibold uppercase tracking-wide mr-1">{t('matTypeAll')}</span>
            <Chip active={typeFilter === 0} onClick={() => setTypeFilter(0)}>
              {t('all')} · {materials.length}
            </Chip>
            {presentTypes.map((id) => (
              <Chip key={id} active={typeFilter === id} onClick={() => setTypeFilter(id)}>
                {t(LIBRARY_TYPES[id])} · {typeCounts[id]}
              </Chip>
            ))}
          </div>
          {subjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted font-semibold uppercase tracking-wide mr-1">{t('hwSubject')}</span>
              <select className="field !w-auto !py-1.5 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="all">{t('matSubjectAll')}</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {q.isLoading || specs.isLoading ? (
        <Spinner />
      ) : q.isError ? (
        <div className="card"><ErrorBox onRetry={() => q.refetch()} /></div>
      ) : materials.length === 0 ? (
        <div className="card"><Empty text={t('matNoItems')} icon={BookOpen} /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty text={t('matNotFound')} icon={SearchX} />
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}
        >
          {filtered.map((m) => {
            const link = m.url || m.link || null
            const download = m.download_url || (m.filename ? m.download_url : null)
            const typeLabel = t(LIBRARY_TYPES[m.material_type] || 'libraryLessons')
            return (
              <div key={m.material_id ?? `${m.theme}|${m.date}`} className="card !p-0 overflow-hidden flex flex-col">
                <div
                  className="h-36 w-full flex items-center justify-center"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {m.cover_image ? (
                    <img
                      src={m.cover_image}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.parentElement.innerHTML =
                          '<div style="color:var(--text-muted)"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div>'
                      }}
                    />
                  ) : (
                    <ImageOff size={34} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                  )}
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag kind={m.material_type === 3 ? 'lab' : 'hw'}>{typeLabel}</Tag>
                    {m.is_new_material ? <Tag kind="new">{t('matNew')}</Tag> : null}
                    {m.accessibility?.response_code && m.accessibility.response_code >= 400 ? (
                      <span className="text-xs" style={{ color: 'var(--warning)' }}>⚠ {t('matLinkDead')}</span>
                    ) : null}
                  </div>
                  <div className="font-semibold text-sm leading-snug">{m.theme}</div>
                  <div className="text-xs text-muted">
                    {m.subjectName ? `${m.subjectName}` : ''}
                    {m.date ? ` · ${fmtShort(m.date)}` : ''}
                  </div>
                  {m.description && (
                    <div className="text-xs text-muted line-clamp-2">{m.description}</div>
                  )}
                  <div className="flex gap-2 mt-auto pt-2">
                    {link && (
                      <button
                        className="btn btn--primary !py-2 !px-3 text-sm flex-1"
                        onClick={() => openMaterial(m, link)}
                      >
                        <ExternalLink size={15} />
                        {t('open')}
                      </button>
                    )}
                    {download && (
                      <a
                        className="btn btn--ghost !py-2 !px-3 text-sm"
                        href={download}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => m.material_id && markUsed.mutate(m.material_id)}
                      >
                        <FileDown size={15} />
                        {t('download')}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
