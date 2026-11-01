import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Cake, CalendarClock, UserRound, GraduationCap, LogOut, Settings as SettingsIcon,
  Gem, Coins, Trophy, IdCard, Star, Users,
} from 'lucide-react'
import { apiProfileSettings } from '../api/endpoints'
import { qk } from '../api/queryKeys'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { Card, Spinner, ErrorBox, Tag } from '../components/ui'

/**
 * «Личный кабинет» (v1.2) — данные профиля как на оригинальном сайте:
 * личные данные, обучение, награды, группы и быстрый выход.
 * Источники: /settings/user-info (кеш AuthContext) + /profile/operations/settings.
 */
export default function CabinetPage() {
  const { t, fmtDate } = useI18n()
  const { user, logout, switchGroup } = useAuth()
  const navigate = useNavigate()

  const profile = useQuery({
    queryKey: qk.profileSettings,
    queryFn: apiProfileSettings,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  })

  if (!user) return <div style={{ paddingTop: 80 }}><Spinner /></div>

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const changeGroup = async (id) => {
    if (!id || id === user.current_group_id) return
    try { await switchGroup(id) } catch { /* сообщение покажет Settings при желании */ }
  }

  const points = Array.isArray(user.gaming_points) ? user.gaming_points : []
  const topgems = points.find((p) => p.new_gaming_point_types__id === 2)?.points ?? null   // COIN = «Топгемы»
  const topcoins = points.find((p) => p.new_gaming_point_types__id === 1)?.points ?? null  // DIAMOND = «Топкоины»
  const groups = Array.isArray(user.groups) ? user.groups : []
  const studyForm = user.study_form_short_name === 'COLL' ? t('cabFormColl') : (user.study_form_short_name || null)
  const gender = user.gender === 0 ? t('cabGenderM') : user.gender === 1 ? t('cabGenderF') : null

  return (
    <main className="page">
      <h1 className="page__title">{t('cabTitle')}</h1>
      <p className="page__subtitle">{t('cabSubtitle')}</p>

      {/* Профиль */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          {user.photo ? (
            <img className="sidebar__avatar !w-16 !h-16" src={user.photo} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="sidebar__avatar !w-16 !h-16 flex items-center justify-center">
              <UserRound size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
          <div className="flex-1 min-w-[200px]">
            <div className="font-bold text-lg">{user.full_name}</div>
            <div className="text-sm text-muted">
              {t('setGroup')}: <b>{user.group_name}</b> · {t('setStream')}: <b>{user.stream_name}</b>
            </div>
            {(profile.data?.email || profile.data?.phone) && (
              <div className="text-xs text-muted mt-1">
                {profile.data?.email && <div>email: {profile.data.email}</div>}
                {profile.data?.phone && <div>tel: {profile.data.phone}</div>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag tag--current" title={t('cabLevel')}><Star size={12} /> {t('cabLevel')} {user.level}</span>
            <Link to="/achievements" className="tag tag--mark" style={{ textDecoration: 'none' }}>
              <Trophy size={12} /> {t('navAchievements')}: {user.achieves_count}
            </Link>
          </div>
        </div>
        {profile.isError && (
          <div className="mt-3">
            <ErrorBox title={t('noData')} onRetry={() => profile.refetch()} />
          </div>
        )}
      </Card>

      <div className="grid-2 mb-4">
        {/* Личные данные */}
        <Card title={t('cabPersonal')} icon={<IdCard size={17} />}>
          <ul className="cab-list">
            {user.birthday && (
              <li><Cake size={15} /><span>{t('cabBirthday')}</span><b>{fmtDate(user.birthday)}{user.age != null ? ` · ${t('cabAge')}: ${user.age}` : ''}</b></li>
            )}
            {gender && (
              <li><UserRound size={15} /><span>{t('cabGender')}</span><b>{gender}</b></li>
            )}
            {user.registration_date && (
              <li><CalendarClock size={15} /><span>{t('cabRegistered')}</span><b>{fmtDate(String(user.registration_date).slice(0, 10))}</b></li>
            )}
            {user.last_date_visit && (
              <li><CalendarClock size={15} /><span>{t('cabLastVisit')}</span><b>{String(user.last_date_visit).slice(0, 16)}</b></li>
            )}
            {user.student_id != null && (
              <li><IdCard size={15} /><span>{t('cabStudentId')}</span><b>{user.student_id}</b></li>
            )}
          </ul>
        </Card>

        {/* Обучение и награды */}
        <Card title={t('cabEducation')} icon={<GraduationCap size={17} />}>
          <ul className="cab-list">
            <li><Users size={15} /><span>{t('setGroup')}</span><b>{user.group_name}</b></li>
            <li><GraduationCap size={15} /><span>{t('setStream')}</span><b>{user.stream_name}</b></li>
            {studyForm && (
              <li><IdCard size={15} /><span>{t('cabStudyForm')}</span><b>{studyForm}</b></li>
            )}
            {topgems != null && (
              <li><Gem size={15} /><span>{t('cabTopgems')}</span><b style={{ color: 'var(--accent)' }}>{topgems}</b></li>
            )}
            {topcoins != null && (
              <li><Coins size={15} /><span>{t('cabTopcoins')}</span><b style={{ color: 'var(--warning)' }}>{topcoins}</b></li>
            )}
          </ul>

          {groups.length > 1 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="text-sm font-semibold mb-2">{t('cabGroups')}</div>
              <div className="flex flex-col gap-1.5">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    className={`chip ${g.id === user.current_group_id ? 'is-active' : ''}`}
                    onClick={() => changeGroup(g.id)}
                  >
                    {g.name}
                    {g.is_primary ? ` ★ (${t('cabPrimary')})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Быстрые действия */}
      <Card>
        <div className="flex flex-wrap gap-2">
          <Link to="/settings" className="btn btn--ghost" style={{ textDecoration: 'none' }}>
            <SettingsIcon size={15} />
            {t('cabGoSettings')}
          </Link>
          <button className="btn btn--ghost" onClick={handleLogout}>
            <LogOut size={15} />
            {t('logout')}
          </button>
        </div>
        <p className="text-xs text-muted mt-3 mb-0">
          <Tag kind="current">Journal</Tag> {t('setAboutText')}
        </p>
      </Card>
    </main>
  )
}
