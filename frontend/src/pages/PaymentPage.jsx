import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Wallet, Landmark, History, ExternalLink, BookOpen } from 'lucide-react'
import { apiPaymentIndex, apiPaymentHistory } from '../api/endpoints'
import { useI18n } from '../i18n/I18nContext'
import { Card, Spinner, ErrorBox, Empty, Tag } from '../components/ui'
import { money } from '../utils/format'

export default function PaymentPage() {
  const { t, locale, fmtShort } = useI18n()
  const [showDetails, setShowDetails] = useState(false)

  const index = useQuery({ queryKey: ['payment-index'], queryFn: apiPaymentIndex, staleTime: 10 * 60 * 1000 })
  const history = useQuery({ queryKey: ['payment-history'], queryFn: apiPaymentHistory, staleTime: 10 * 60 * 1000 })

  if (index.isLoading) {
    return (
      <main className="page">
        <h1 className="page__title">{t('payTitle')}</h1>
        <Spinner />
      </main>
    )
  }

  if (index.isError) {
    return (
      <main className="page">
        <h1 className="page__title">{t('payTitle')}</h1>
        <Card><ErrorBox onRetry={() => index.refetch()} /></Card>
      </main>
    )
  }

  const d = index.data || {}
  const payment = d.payment || {}
  const legacy = d.legacy_payment || {}
  const hasDebt = payment.amount_debt != null && Number(payment.amount_debt) > 0
  const online = d.online_link || payment.online_link || null
  const instruction = d.instruction_link || d.mobile_instruction_link || null
  const payments = Array.isArray(history.data) ? history.data : []

  return (
    <main className="page">
      <h1 className="page__title">{t('payTitle')}</h1>
      <p className="page__subtitle">{t('paySubtitle')}</p>

      <div className="grid-2 mb-4">
        {/* Ближайший платёж */}
        <Card title={t('payNext')} icon={<Wallet size={17} />}>
          <div className="text-3xl font-extrabold mb-1">
            {money(payment.amount_next, locale)}
          </div>
          <div className="text-sm text-muted mb-3">{payment.purpose_of_payment || '—'}</div>
          <div className="flex flex-wrap gap-2">
            <span className="chip !cursor-default">
              {t('payDate')}: <b className="ml-1">{payment.pay_date_start && payment.pay_date_start.startsWith('0000') ? '—' : fmtShort(payment.pay_date_start) || '—'}</b>
            </span>
            {hasDebt ? (
              <span className="chip !cursor-default" style={{ color: 'var(--danger)' }}>
                {t('payDebt')}: <b className="ml-1">{money(payment.amount_debt, locale)}</b>
              </span>
            ) : (
              <span className="chip !cursor-default" style={{ color: 'var(--success)' }}>
                {t('payNoDebt')}
              </span>
            )}
          </div>
          {legacy?.amount != null && Number(legacy.amount) > 0 && (
            <div className="text-xs text-muted mt-2">
              {t('payDebt')}: {money(legacy.amount, locale)}
              {legacy.pay_date_start ? ` · ${fmtShort(legacy.pay_date_start)}` : ''}
            </div>
          )}
          {(online || instruction) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {online && (
                <a className="btn btn--primary !py-2 text-sm" href={online} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  {t('payOnline')}
                </a>
              )}
              {instruction && (
                <a className="btn btn--ghost !py-2 text-sm" href={instruction} target="_blank" rel="noreferrer">
                  <BookOpen size={15} />
                  {t('payInstruction')}
                </a>
              )}
            </div>
          )}
        </Card>

        {/* Реквизиты */}
        <Card
          title={t('payDetails')}
          icon={<Landmark size={17} />}
          actions={
            <button className="btn btn--ghost !py-1.5 !px-3 text-xs" onClick={() => setShowDetails((v) => !v)}>
              {showDetails ? t('close') : t('open')}
            </button>
          }
        >
          {showDetails ? (
            <table className="marks-table">
              <tbody>
                <tr><td className="text-muted text-xs" style={{ width: '40%' }}>{t('payOrg')}</td><td className="text-xs">{payment.organization_name || d.full_name || '—'}</td></tr>
                <tr><td className="text-muted text-xs">{t('payBank')}</td><td className="text-xs">{payment.bank_name || '—'}</td></tr>
                <tr><td className="text-muted text-xs">{t('payAccount')}</td><td className="text-xs">{payment.settlement_account || '—'}</td></tr>
                <tr><td className="text-muted text-xs">ОКПО</td><td className="text-xs">{payment.okpo || '—'}</td></tr>
                <tr><td className="text-muted text-xs">1С</td><td className="text-xs">{payment.one_c_code || '—'}</td></tr>
                <tr><td className="text-muted text-xs">{t('payPayer')}</td><td className="text-xs">{payment.payer_full_name || d.full_name || '—'}</td></tr>
              </tbody>
            </table>
          ) : (
            <Empty text={t('payDetails')} icon={Landmark} />
          )}
        </Card>
      </div>

      {/* История платежей */}
      <Card title={t('payHistory')} icon={<History size={17} />}>
        {history.isLoading ? (
          <Spinner />
        ) : history.isError ? (
          <ErrorBox onRetry={() => history.refetch()} />
        ) : payments.length === 0 ? (
          <Empty text={t('payHistoryEmpty')} icon={CreditCard} />
        ) : (
          <div className="overflow-x-auto">
            <table className="marks-table">
              <thead>
                <tr>
                  <th>{t('payOperation')}</th>
                  <th>{t('payDate')}</th>
                  <th>{t('paySum')}</th>
                  <th>{t('payStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id ?? i}>
                    <td className="text-sm">{p.purpose_of_payment || p.description || p.operation || `#${p.id ?? i + 1}`}</td>
                    <td className="text-xs text-muted whitespace-nowrap">
                      {p.date || p.pay_date ? fmtShort(String(p.date || p.pay_date).slice(0, 10)) : '—'}
                    </td>
                    <td className="text-sm font-semibold whitespace-nowrap">
                      {money(p.amount ?? p.sum, locale)}
                    </td>
                    <td>
                      {p.status != null ? <Tag kind={Number(p.status) === 1 ? 'checked' : 'current'}>{p.status_name || p.status}</Tag> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  )
}
