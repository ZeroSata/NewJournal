import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Paperclip, ExternalLink } from 'lucide-react'
import { apiProfileFields, apiDocuments } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { Card, Spinner, ErrorBox, Empty, Tag } from '../components/ui'

export default function DocumentsPage() {
  const { t, fmtShort } = useI18n()
  const { user } = useAuth()
  const studentId = user?.student_id

  const fields = useQuery({
    queryKey: ['doc-fields', studentId],
    queryFn: () => apiProfileFields(studentId),
    enabled: studentId != null,
    staleTime: 10 * 60 * 1000,
  })

  const docs = useQuery({
    queryKey: ['documents', studentId],
    queryFn: () => apiDocuments(studentId),
    enabled: studentId != null,
    staleTime: 10 * 60 * 1000,
  })

  // Значения полей из /documents/get: [{ field_id / id, textValue, files... }]
  const valuesById = useMemo(() => {
    const map = {}
    const push = (arr) => {
      for (const v of Array.isArray(arr) ? arr : []) {
        const id = v.field_id ?? v.id ?? v.fieldId
        if (id != null) map[String(id)] = v
      }
    }
    push(docs.data)
    return map
  }, [docs.data])

  // Группируем поля по document_group_id, сохраняя порядок
  const groups = useMemo(() => {
    const list = Array.isArray(fields.data) ? fields.data : []
    const order = []
    const map = {}
    for (const f of list) {
      const key = f.document_group_id || 'other'
      if (!map[key]) {
        map[key] = []
        order.push(key)
      }
      map[key].push(f)
    }
    return order.map((key) => ({
      id: key,
      name: map[key][0]?.group_name || (key !== 'other' ? `${t('docGroup')} №${key}` : t('docTitle')),
      fields: map[key],
    }))
  }, [fields.data, t])

  const renderValue = (f) => {
    const v = valuesById[String(f.id)]
    const text = v?.textValue ?? f.textValue
    const files = v?.files ?? f.files
    if (Array.isArray(files) && files.length > 0) {
      return (
        <div className="flex flex-col gap-1 items-end">
          {files.map((file, i) => {
            const url = typeof file === 'string' ? file : file?.url || file?.file_path
            const name = typeof file === 'string' ? t('docFile') : file?.name || file?.filename || t('docFile')
            return url ? (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1">
                <Paperclip size={12} />
                {name}
              </a>
            ) : (
              <span key={i} className="text-xs text-muted inline-flex items-center gap-1">
                <Paperclip size={12} /> {name}
              </span>
            )
          })}
        </div>
      )
    }
    if (text != null && text !== '') {
      if (f.type === 'date') {
        const d = new Date(String(text).slice(0, 10) + 'T12:00:00')
        return <span className="text-sm">{Number.isNaN(d.getTime()) ? text : fmtShort(text)}</span>
      }
      return <span className="text-sm text-right">{String(text)}</span>
    }
    return <span className="text-sm text-muted italic">{t('docNoValue')}</span>
  }

  if (studentId == null) {
    return (
      <main className="page">
        <h1 className="page__title">{t('docTitle')}</h1>
        <Card><Empty text={t('docEmpty')} icon={FileText} /></Card>
      </main>
    )
  }

  return (
    <main className="page">
      <h1 className="page__title">{t('docTitle')}</h1>
      <p className="page__subtitle">{t('docSubtitle')}</p>

      {fields.isLoading || docs.isLoading ? (
        <Spinner />
      ) : fields.isError ? (
        <Card><ErrorBox onRetry={() => fields.refetch()} /></Card>
      ) : groups.length === 0 ? (
        <Card><Empty text={t('docEmpty')} icon={FileText} /></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <Card key={g.id} title={g.name} icon={<FileText size={17} />}>
              <div className="overflow-x-auto">
                <table className="marks-table">
                  <tbody>
                    {g.fields.map((f) => (
                      <tr key={f.id}>
                        <td className="text-sm" style={{ width: '45%' }}>
                          <div className="flex items-center gap-2">
                            <span>{f.name}</span>
                            {f.type === 'file' && <Tag kind="lab">{t('docFile')}</Tag>}
                          </div>
                        </td>
                        <td className="text-right">{renderValue(f)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
          <p className="text-xs text-muted -mt-2">
            {t('docSubtitle')}. <ExternalLink size={11} className="inline" /> — {t('open')}
          </p>
        </div>
      )}
    </main>
  )
}
