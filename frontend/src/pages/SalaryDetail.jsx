import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftRegular,
  MoneyRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  ClockRegular,
  CalendarRegular,
  BriefcaseRegular,
  PersonRegular,
  AddCircleRegular,
  SubtractCircleRegular,
  ArrowSyncRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'

export default function SalaryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [calendarData, setCalendarData] = useState(null)

  const loadCalendarData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${id}/attendance-calendar`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCalendarData(data)
      } else {
        toast.error(isRu ? 'Ошибка при загрузке данных посещаемости' : 'Davomat ma\'lumotlarini yuklashda xatolik yuz berdi')
      }
    } catch (err) {
      console.error(err)
      toast.error(isRu ? 'Ошибка сети' : 'Tarmoq xatoligi yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCalendarData()
  }, [id])

  const formatMoney = (val) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val)
  }

  const formatDateDay = (dateStr) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length < 3) return dateStr
    const day = parseInt(parts[2], 10)
    const monthIndex = parseInt(parts[1], 10) - 1
    const monthsUz = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr']
    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
    const monthName = isRu ? monthsRu[monthIndex] : monthsUz[monthIndex]
    return `${day}-${monthName}`
  }

  const formatVariance = (workedSec, expectedSec) => {
    const diff = workedSec - expectedSec
    if (diff === 0) return '0'
    const sign = diff > 0 ? '+' : '-'
    const absDiff = Math.abs(diff)
    const hours = Math.floor(absDiff / 3600)
    const minutes = Math.floor((absDiff % 3600) / 60)
    
    let text = ''
    if (hours > 0) text += `${hours}s `
    if (minutes > 0 || hours === 0) text += `${minutes}d`
    return `${sign}${text}`
  }

  const formatDuration = (sec) => {
    if (!sec) return '0d'
    const hours = Math.floor(sec / 3600)
    const minutes = Math.floor((sec % 3600) / 60)
    let text = ''
    if (hours > 0) text += `${hours}s `
    if (minutes > 0 || hours === 0) text += `${minutes}d`
    return text
  }

  const detailedStats = useMemo(() => {
    if (!calendarData || !calendarData.days) return null

    let totalWorkedSeconds = 0
    let totalExpectedSeconds = 0
    let overtimeSeconds = 0
    let undertimeSeconds = 0
    let onTimeDays = 0
    let lateDays = 0
    let absentDays = 0
    let presentDays = 0
    let holidayDays = 0

    calendarData.days.forEach(day => {
      if (day.status === 'holiday') {
        holidayDays++
        return
      }

      if (!day.present) {
        absentDays++
        return
      }

      presentDays++
      if (day.late_minutes > 0) {
        lateDays++
      } else {
        onTimeDays++
      }

      const start = new Date(day.expected_time)
      const end = new Date(day.expected_end_time)
      const expectedDiff = Math.max(0, (end - start) / 1000)
      totalExpectedSeconds += expectedDiff

      totalWorkedSeconds += day.worked_seconds

      const diff = day.worked_seconds - expectedDiff
      if (diff > 0) {
        overtimeSeconds += diff
      } else {
        undertimeSeconds += Math.abs(diff)
      }
    })

    const overtimeHours = overtimeSeconds / 3600
    const overtimeBonus = Math.round(overtimeHours * 30000)
    const latePenalty = lateDays * 50000

    return {
      totalWorkedSeconds,
      totalExpectedSeconds,
      overtimeSeconds,
      undertimeSeconds,
      onTimeDays,
      lateDays,
      absentDays,
      presentDays,
      holidayDays,
      overtimeHours,
      overtimeBonus,
      latePenalty
    }
  }, [calendarData])

  const employeeName = calendarData?.employee 
    ? `${calendarData.employee.first_name} ${calendarData.employee.last_name} ${calendarData.employee.middle_name || ''}`
    : ''

  const baseSalary = calendarData?.employee?.salary || 0
  const finalSalary = detailedStats ? Math.max(0, baseSalary + detailedStats.overtimeBonus - detailedStats.latePenalty) : 0

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Расчет зарплаты' : '✦ Ish haqi hisob-kitobi'}
        title={employeeName || (isRu ? 'Загрузка...' : 'Yuklanmoqda...')}
        sub={calendarData?.employee?.position ? `${isRu ? 'Должность' : 'Lavozimi'}: ${calendarData.employee.position}` : ''}
        right={
          <button
            onClick={() => navigate('/finance/salary')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowLeftRegular fontSize={16} />
            {isRu ? 'Назад' : 'Orqaga'}
          </button>
        }
      />

      <style>{`
        .detail-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .detail-container {
            padding: 16px 16px 60px !important;
            gap: 16px !important;
          }
        }
      `}</style>

      <div className="detail-container">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: 16 }}>
            <div style={{
              width: 40, height: 40, border: '3px solid var(--border)',
              borderTopColor: 'var(--accent)', borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {isRu ? 'Загрузка данных расчета посещаемости...' : 'Davomat hisob-kitob ma\'lumotlari yuklanmoqda...'}
            </span>
          </div>
        ) : calendarData && detailedStats ? (
          <>
            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ПРИСУТСТВИЕ' : 'KELGAN KUNLARI'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <PersonRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
                  {detailedStats.presentDays} {isRu ? 'дн.' : 'kun'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Пропущено:' : 'Kelmagan:'} {detailedStats.absentDays} {isRu ? 'дн.' : 'kun'}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ВОвремя' : 'VAQTIDA KELGAN'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    <CheckmarkCircleRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>
                  {detailedStats.onTimeDays} {isRu ? 'дн.' : 'kun'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Опоздания:' : 'Kechikkan:'} {detailedStats.lateDays} {isRu ? 'дн.' : 'kun'}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'СВЕРХУРОЧНО' : 'QO\'SHIMCHA VAQT'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    <ClockRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>
                  {formatDuration(detailedStats.overtimeSeconds)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Недоработка:' : 'Kam ishlangan:'} {formatDuration(detailedStats.undertimeSeconds)}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 500 }}>{isRu ? 'ИТОГО К ВЫПЛАТЕ' : 'SOF ISH HAQI'}</span>
                  <div style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                    <MoneyRegular fontSize={20} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
                  {formatMoney(finalSalary)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Базовый:' : 'Asosiy:'} {formatMoney(baseSalary)}
                </div>
              </div>
            </div>

            {/* Financial Calculations Detail Box */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 16 }}>
                <MoneyRegular fontSize={20} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  {isRu ? 'Финансовый расчет за месяц' : 'Bir oylik moliyaviy hisob-kitob'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-3)' }}>{isRu ? 'Оклад (базовый)' : 'Asosiy oylik (shtat):'}</span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(baseSalary)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
                    <AddCircleRegular fontSize={16} style={{ color: '#10b981' }} />
                    {isRu ? 'Бонус за сверхурочные' : 'Qo\'shimcha ishlangan vaqt uchun (Bonus):'}
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      ({formatDuration(detailedStats.overtimeSeconds)} × 30,000 UZS/soat)
                    </span>
                  </span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>+{formatMoney(detailedStats.overtimeBonus)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
                    <SubtractCircleRegular fontSize={16} style={{ color: '#ef4444' }} />
                    {isRu ? 'Штраф за опоздания' : 'Kechikkan kunlar uchun (Jarima):'}
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      ({detailedStats.lateDays} marta × 50,000 UZS)
                    </span>
                  </span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>-{formatMoney(detailedStats.latePenalty)}</span>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 16, fontWeight: 800, borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 6
                }}>
                  <span>{isRu ? 'Итоговая сумма к выплате' : 'To\'lanadigan yakuniy ish haqi:'}</span>
                  <span style={{ color: 'var(--accent)', fontSize: 18 }}>
                    {formatMoney(finalSalary)}
                  </span>
                </div>
              </div>
            </div>

            {/* Daily Calendar Report */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 16 }}>
                <CalendarRegular fontSize={20} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  {isRu ? 'Подробный отчет по дням' : 'Kunlik batafsil hisobot'}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-4)', fontSize: 12.5 }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'День' : 'Kun'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Статус' : 'Holat'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Режим' : 'Smen vaqti'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Приход / Уход' : 'Kelish / Ketish'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Отработано' : 'Ishlangan vaqt'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>{isRu ? 'Разница' : 'Farq'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarData.days.map((day, idx) => {
                      const expStart = day.expected_time ? day.expected_time.split('T')[1]?.substring(0, 5) : '09:00'
                      const expEnd = day.expected_end_time ? day.expected_end_time.split('T')[1]?.substring(0, 5) : '18:00'
                      const actStart = day.first_seen ? day.first_seen.split('T')[1]?.substring(0, 5) : '--:--'
                      const actEnd = day.last_seen ? day.last_seen.split('T')[1]?.substring(0, 5) : '--:--'

                      const startDt = new Date(day.expected_time)
                      const endDt = new Date(day.expected_end_time)
                      const expSec = Math.max(0, (endDt - startDt) / 1000)

                      let badge = <span style={badgeGrayStyle}>{isRu ? 'Выходной' : 'Dam olish'}</span>
                      if (day.status === 'present') {
                        badge = <span style={badgeGreenStyle}>{isRu ? 'Вовремя' : 'Vaqtida'}</span>
                      } else if (day.status === 'late') {
                        badge = <span style={badgeYellowStyle}>{isRu ? 'Опоздал' : 'Kechikdi'}</span>
                      } else if (day.status === 'absent') {
                        badge = <span style={badgeRedStyle}>{isRu ? 'Не пришел' : 'Kelmagan'}</span>
                      }

                      const diffSec = day.worked_seconds - expSec

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-2)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{formatDateDay(day.date)}</td>
                          <td style={{ padding: '14px 16px' }}>{badge}</td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-3)' }}>{expStart} — {expEnd}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                            {day.present ? `${actStart} — ${actEnd}` : '—'}
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                            {day.present ? formatDuration(day.worked_seconds) : '—'}
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                            {!day.present ? '—' : (
                              <span style={{ color: diffSec >= 0 ? '#10b981' : '#ef4444' }}>
                                {formatVariance(day.worked_seconds, expSec)}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-4)' }}>
            {isRu ? 'Данные отсутствуют' : 'Hisob-kitob ma\'lumotlari topilmadi'}
          </div>
        )}
      </div>
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
}

const badgeGreenStyle = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'rgba(16,185,129,0.12)',
  color: '#10b981',
  whiteSpace: 'nowrap'
}

const badgeYellowStyle = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'rgba(245,158,11,0.12)',
  color: '#f59e0b',
  whiteSpace: 'nowrap'
}

const badgeRedStyle = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'rgba(239,68,68,0.12)',
  color: '#ef4444',
  whiteSpace: 'nowrap'
}

const badgeGrayStyle = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text-3)',
  whiteSpace: 'nowrap'
}
