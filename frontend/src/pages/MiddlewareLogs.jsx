import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  HistoryRegular, DeleteRegular, ArrowSyncRegular, FilterRegular,
  SearchRegular, BoxRegular, WarningRegular, ErrorCircleRegular,
  CheckmarkCircleRegular, EyeRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useConfirm } from '../components/ConfirmDialog'
import CustomSelect from '../components/CustomSelect'

export default function MiddlewareLogs() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const isRu = i18n.language === 'ru'

  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ ips: [], status_breakdown: [] })
  
  // Filters
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [ip, setIp] = useState('')
  const [search, setSearch] = useState('')

  const [selectedLog, setSelectedLog] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('limit', limit)
      if (method) params.append('method', method)
      if (status) params.append('status', status)
      if (ip) params.append('ip', ip)
      if (search) params.append('search', search)

      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/middleware-logs/stats'),
        fetch(`/api/middleware-logs?${params.toString()}`)
      ])

      if (statsRes.status === 401) { navigate('/login'); return }

      if (statsRes.ok) {
        const data = await statsRes.json()
        if (data.ok) setStats(data)
      }

      if (logsRes.ok) {
        const data = await logsRes.json()
        if (data.ok) {
          setLogs(data.data || [])
          setTotalPages(data.pages || 1)
          setTotalItems(data.total || 0)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, limit, method, status, ip, search, navigate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleClear = () => {
    confirm({
      title: isRu ? 'Очистить логи' : 'Jurnallarni tozalash',
      body: isRu ? 'Вы уверены, что хотите удалить все записи?' : 'Barcha yozuvlarni o\'chirib tashlashga ishonchingiz komilmi?',
      confirmText: isRu ? 'Да, очистить' : 'Ha, tozalash',
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/middleware-logs/clear', { method: 'DELETE' })
          if (res.ok) {
            setPage(1)
            loadData()
          }
        } catch (e) {
          console.error(e)
        }
      }
    })
  }

  const getStatusColor = (code) => {
    if (code >= 200 && code < 300) return { bg: 'rgba(16,185,129,0.1)', color: '#10b981' }
    if (code >= 300 && code < 400) return { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' }
    if (code >= 400 && code < 500) return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
    if (code >= 500) return { bg: 'rgba(244,63,94,0.1)', color: '#f43f5e' }
    return { bg: 'var(--surface-2)', color: 'var(--text-1)' }
  }

  const getMethodColor = (m) => {
    switch (m?.toUpperCase()) {
      case 'GET': return '#3b82f6'
      case 'POST': return '#10b981'
      case 'PUT': return '#f59e0b'
      case 'DELETE': return '#f43f5e'
      default: return 'var(--text-4)'
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
        title={isRu ? 'Логи Middleware' : 'Middleware Jurnali'}
        sub={isRu ? 'Мониторинг всех входящих HTTP запросов к API' : 'API ga barcha kiruvchi HTTP so\'rovlarni monitoring qilish'}
        right={
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              <ArrowSyncRegular fontSize={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {isRu ? 'Обновить' : 'Yangilash'}
            </button>
            <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              <DeleteRegular fontSize={16} />
              {isRu ? 'Очистить' : 'Tozalash'}
            </button>
          </div>
        }
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px 80px' }}>
        
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{isRu ? 'Всего запросов' : 'Jami so\'rovlar'}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{totalItems}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{isRu ? 'Уникальные IP' : 'Noyob IPlar'}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.ips?.length || 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.04)', gridColumn: 'span 2' }}>
             <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{isRu ? 'Статусы (Всего)' : 'Statuslar (Jami)'}</div>
             <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {stats.status_breakdown?.map(st => {
                  const c = getStatusColor(st.code)
                  return (
                    <div key={st.code} style={{ display: 'flex', alignItems: 'center', gap: 6, background: c.bg, color: c.color, padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      {st.code >= 500 ? <ErrorCircleRegular /> : st.code >= 400 ? <WarningRegular /> : <CheckmarkCircleRegular />}
                      {st.code}: {st.count}
                    </div>
                  )
                })}
                {(!stats.status_breakdown || stats.status_breakdown.length === 0) && (
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{isRu ? 'Нет данных' : 'Ma\'lumot yo\'q'}</div>
                )}
             </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, padding: 16, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '0 12px' }}>
            <SearchRegular style={{ color: 'var(--text-4)' }} />
            <input 
              type="text" 
              placeholder={isRu ? 'Поиск по URL, IP, User-Agent...' : 'URL, IP, User-Agent orqali qidirish...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadData()}
              style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'var(--text-1)', outline: 'none', fontSize: 13 }} 
            />
          </div>
          
          <div style={{ width: 140 }}>
            <CustomSelect 
              value={method} 
              onChange={val => { setMethod(val); setPage(1) }} 
              options={[
                { label: isRu ? 'Все методы' : 'Barcha metodlar', value: '' },
                { label: 'GET', value: 'GET' },
                { label: 'POST', value: 'POST' },
                { label: 'PUT', value: 'PUT' },
                { label: 'DELETE', value: 'DELETE' }
              ]} 
              placeholder={isRu ? 'Все методы' : 'Barcha metodlar'}
            />
          </div>

          <div style={{ width: 140 }}>
            <CustomSelect 
              value={status} 
              onChange={val => { setStatus(val); setPage(1) }} 
              options={[
                { label: isRu ? 'Все статусы' : 'Barcha statuslar', value: '' },
                { label: '200 OK', value: '200' },
                { label: '201 Created', value: '201' },
                { label: '400 Bad Req', value: '400' },
                { label: '401 Unauth', value: '401' },
                { label: '403 Forbidden', value: '403' },
                { label: '404 Not Found', value: '404' },
                { label: '500 Server Err', value: '500' }
              ]} 
              placeholder={isRu ? 'Все статусы' : 'Barcha statuslar'}
            />
          </div>

          <div style={{ width: 160 }}>
            <CustomSelect 
              value={ip} 
              onChange={val => { setIp(val); setPage(1) }} 
              options={[
                { label: isRu ? 'Все IP адреса' : 'Barcha IP lar', value: '' },
                ...(stats.ips || []).map(addr => ({ label: addr, value: addr }))
              ]} 
              placeholder={isRu ? 'Все IP адреса' : 'Barcha IP lar'}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>ID</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Method</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>URL</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>IP</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Time (ms)</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} style={{ padding: '12px 16px' }}>
                          <div style={{ height: 16, background: 'var(--surface-2)', borderRadius: 4, width: j === 2 ? '100%' : (j === 7 ? 30 : '60%'), animation: 'pulse 1.5s infinite ease-in-out' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)', fontSize: 14 }}>
                      {isRu ? 'Журнал пуст' : 'Jurnal bo\'sh'}
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const stColor = getStatusColor(log.status_code)
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-4)' }}>#{log.id}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: getMethodColor(log.method) }}>{log.method}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.url}>{log.url}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{log.client_ip}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>
                          <span style={{ background: stColor.bg, color: stColor.color, padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>{log.status_code}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: log.response_time_ms > 1000 ? '#f59e0b' : 'var(--text-1)' }}>{parseFloat(log.response_time_ms || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-4)' }}>{log.created_at ? new Date(log.created_at).toLocaleString('ru-RU') : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                           <button onClick={() => setSelectedLog(log)} style={{ padding: '6px', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 6, color: 'var(--text-1)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Details">
                             <EyeRegular fontSize={16} />
                           </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-4)' }}>
                {isRu ? `Страница ${page} из ${totalPages}` : `Sahifa ${page} / ${totalPages}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  style={{ padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: page === 1 ? 'var(--text-4)' : 'var(--text-1)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                  {isRu ? 'Назад' : 'Orqaga'}
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                  style={{ padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: page === totalPages ? 'var(--text-4)' : 'var(--text-1)', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  {isRu ? 'Далее' : 'Oldinga'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedLog(null)}>
          <div style={{ background: 'var(--surface)', width: '100%', maxWidth: 700, maxHeight: '90vh', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
               <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Request #{selectedLog.id}</h3>
               <button onClick={() => setSelectedLog(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 20 }}>&times;</button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px 16px', fontSize: 13, marginBottom: 20 }}>
                <b style={{ color: 'var(--text-4)' }}>Method</b>
                <span style={{ fontWeight: 700, color: getMethodColor(selectedLog.method) }}>{selectedLog.method}</span>
                
                <b style={{ color: 'var(--text-4)' }}>URL</b>
                <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedLog.url}</span>
                
                <b style={{ color: 'var(--text-4)' }}>Status</b>
                <span>
                  <span style={{ background: getStatusColor(selectedLog.status_code).bg, color: getStatusColor(selectedLog.status_code).color, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{selectedLog.status_code}</span>
                </span>
                
                <b style={{ color: 'var(--text-4)' }}>Time</b>
                <span>{selectedLog.response_time_ms} ms</span>

                <b style={{ color: 'var(--text-4)' }}>Client IP</b>
                <span>{selectedLog.client_ip}</span>

                <b style={{ color: 'var(--text-4)' }}>User Agent</b>
                <span style={{ color: 'var(--text-4)' }}>{selectedLog.user_agent || '-'}</span>

                <b style={{ color: 'var(--text-4)' }}>Content Type</b>
                <span>{selectedLog.content_type || '-'}</span>
                
                <b style={{ color: 'var(--text-4)' }}>Date</b>
                <span>{selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString('ru-RU') : '-'}</span>
              </div>

              {selectedLog.details && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 8 }}>Details / Headers</div>
                  <pre style={{ background: '#020617', color: '#e2e8f0', padding: 16, borderRadius: 8, fontSize: 12, overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'pre-wrap' }}>
                    {selectedLog.details}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
