import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useToast } from './Toaster'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@fluentui/react-components'
import {
  MapRegular, InfoRegular, MailRegular, SignOutRegular, PersonRegular,
  GridRegular, CameraRegular, CodeRegular, WeatherSunnyRegular, WeatherMoonRegular,
  SettingsRegular, HistoryRegular, CalendarClockRegular,
  ServerRegular, DatabaseRegular, PlugConnectedRegular, ChevronDownRegular,
  PeopleRegular, ShieldRegular, HatGraduationRegular,
  ClipboardTaskListLtrRegular, BrainCircuitRegular, BuildingRegular, AlertRegular,
  ChatRegular, SendRegular, ArrowLeftRegular, CheckmarkRegular, DismissRegular,
  MoneyRegular, WalletRegular, StarRegular, ArrowSwapRegular, TagRegular,
} from '@fluentui/react-icons'

const PUBLIC_LINKS  = ['map', 'about', 'contact']
const PRIVATE_LINKS = ['dashboard', 'devices']

const LINK_ICONS = {
  map:            <MapRegular  fontSize={17} />,
  about:          <InfoRegular fontSize={17} />,
  contact:        <MailRegular fontSize={17} />,
  dashboard:      <GridRegular fontSize={17} />,
  devices:        <CameraRegular fontSize={17} />,
  shifts:         <CalendarClockRegular fontSize={17} />,
  attendance:     <ClipboardTaskListLtrRegular fontSize={17} />,
  psychology:     <BrainCircuitRegular fontSize={17} />,
  organizations:  <BuildingRegular fontSize={17} />,
  middlewareLogs: <HistoryRegular fontSize={17} />,
  settings:       <SettingsRegular fontSize={17} />,
  finance:        <MoneyRegular fontSize={17} />,
}
const LINK_PATHS = {
  map: '/map', about: '/about', contact: '/contact', dashboard: '/dashboard', 
  devices: '/devices', shifts: '/shifts', attendance: '/attendance', psychology: '/psychology', organizations: '/organizations', middlewareLogs: '/middleware-logs', settings: '/settings',
  finance: '/finance',
}

const navBtn = (active) => ({
  display: 'flex', alignItems: 'center', gap: 'var(--nav-btn-gap, 6px)',
  padding: 'var(--nav-btn-padding, 5px 13px)', borderRadius: 6, border: 'none',
  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
  fontWeight: active ? 600 : 400,
  fontSize: 'var(--nav-btn-font-size, 13px)', cursor: 'pointer',
})

function NavBtn({ id, active, onClick }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} style={navBtn(active)}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' } }}
    >
      {LINK_ICONS[id]}
      {t(`nav.${id}`)}
    </button>
  )
}

// Dropdown menu for Attendance section
function AttendanceDropdown({ active }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isRu = i18n.language === 'ru'

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const items = [
    { id: 'attendance', label: isRu ? 'Журнал событий' : 'Voqealar jurnali', icon: <HistoryRegular fontSize={15} />, path: '/attendance' },
    { id: 'attendanceEmployees', label: isRu ? 'В разрезе сотрудников' : 'Xodimlar kesimida', icon: <PeopleRegular fontSize={15} />, path: '/attendance/employees' },
    { id: 'psychology', label: isRu ? 'Психологический портрет' : 'Psixologik portret', icon: <BrainCircuitRegular fontSize={15} />, path: '/psychology' },
  ]

  return <NavDropdown
    label={isRu ? 'Посещаемость' : 'Davomat'}
    icon={<ClipboardTaskListLtrRegular fontSize={17} />}
    items={items}
    active={active}
    open={open}
    setOpen={setOpen}
    refEl={ref}
    location={location}
    navigate={navigate}
  />
}

// Dropdown menu for Users section
function UsersDropdown({ active }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const items = [
    { id: 'usersAdmins',  label: t('nav.usersAdmins'),  icon: <ShieldRegular fontSize={15} />,         path: '/users' },
    { id: 'usersStaff',   label: t('nav.usersStaff'),   icon: <PeopleRegular fontSize={15} />,         path: '/users/staff' },
    { id: 'usersStudents',label: t('nav.usersStudents'),icon: <HatGraduationRegular fontSize={15} />,  path: '/users/students' },
  ]

  return <NavDropdown
    label={t('nav.users')}
    icon={<PeopleRegular fontSize={17} />}
    items={items}
    active={active}
    open={open}
    setOpen={setOpen}
    refEl={ref}
    location={location}
    navigate={navigate}
  />
}

// Dropdown menu for Organizations section
function OrganizationsDropdown({ active }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isRu = i18n.language === 'ru'

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const items = [
    { id: 'organizations', label: isRu ? 'Организации' : 'Tashkilotlar', icon: <BuildingRegular fontSize={15} />, path: '/organizations' },
    { id: 'shifts', label: isRu ? 'Смены' : 'Smenalar', icon: <CalendarClockRegular fontSize={15} />, path: '/shifts' },
  ]

  return <NavDropdown
    label={isRu ? 'Организации' : 'Tashkilotlar'}
    icon={<BuildingRegular fontSize={17} />}
    items={items}
    active={active}
    open={open}
    setOpen={setOpen}
    refEl={ref}
    location={location}
    navigate={navigate}
  />
}

// Dropdown menu for Finance section
function FinanceDropdown({ active }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isRu = i18n.language === 'ru'

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const items = [
    { id: 'financeSalary', label: t('nav.financeSalary'), icon: <MoneyRegular fontSize={15} />, path: '/finance/salary' },
    { id: 'financeKpi', label: t('nav.financeKpi'), icon: <StarRegular fontSize={15} />, path: '/finance/kpi' },
    { id: 'financeCashflow', label: t('nav.financeCashflow'), icon: <ArrowSwapRegular fontSize={15} />, path: '/finance/cashflow' },
    { id: 'financeAccounts', label: t('nav.financeAccounts'), icon: <WalletRegular fontSize={15} />, path: '/finance/accounts' },
  ]

  return <NavDropdown
    label={isRu ? 'Финансы' : 'Moliya'}
    icon={<MoneyRegular fontSize={17} />}
    items={items}
    active={active}
    open={open}
    setOpen={setOpen}
    refEl={ref}
    location={location}
    navigate={navigate}
  />
}

// Dropdown menu for Settings section
function SettingsDropdown({ active }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isRu = i18n.language === 'ru'

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const items = [
    { id: 'settings', label: isRu ? 'Настройки' : 'Sozlamalar', icon: <SettingsRegular fontSize={15} />, path: '/settings' },
    { id: 'roles', label: isRu ? 'Роли' : 'Rollar', icon: <ShieldRegular fontSize={15} />, path: '/users' },
    { id: 'messages', label: isRu ? 'Обращения' : 'Murojaatlar', icon: <MailRegular fontSize={15} />, path: '/settings/messages' },
    { id: 'middlewareLogs', label: isRu ? 'Логи API' : 'API Jurnali', icon: <HistoryRegular fontSize={15} />, path: '/middleware-logs' },
    { id: 'isup', label: 'ISUP Server', icon: <ServerRegular fontSize={15} />, path: '/settings/isup' },
    { id: 'redis', label: 'Redis', icon: <DatabaseRegular fontSize={15} />, path: '/settings/redis' },
    { id: 'api', label: 'API Helper', icon: <PlugConnectedRegular fontSize={15} />, path: '/settings/api' },
    { id: 'versions', label: isRu ? 'Версии системы' : 'Versiya nazorati', icon: <TagRegular fontSize={15} />, path: '/settings/versions' },
  ]

  return <NavDropdown
    label={t('nav.settings')}
    icon={<SettingsRegular fontSize={17} />}
    items={items}
    active={active}
    open={open}
    setOpen={setOpen}
    refEl={ref}
    location={location}
    navigate={navigate}
  />
}

// Shared dropdown shell used by both SettingsDropdown and UsersDropdown
function NavDropdown({ label, icon, items, active, open, setOpen, refEl, location, navigate }) {
  return (
    <div ref={refEl} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        ...navBtn(active),
        gap: 5,
      }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' } }}
        onMouseLeave={e => { if (!active && !open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' } }}
      >
        {icon}
        {label}
        <ChevronDownRegular fontSize={12} style={{ opacity: 0.6, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          background: '#1a2236', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '6px', minWidth: 220,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          zIndex: 999, animation: 'fadeIn 0.15s ease',
        }}>
          {items.map(item => {
            const isActive = location.pathname === item.path
            return (
              <button key={item.id} onClick={() => { navigate(item.path); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 12px', borderRadius: 7, border: 'none',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.1)' : 'transparent'; e.currentTarget.style.color = isActive ? '#fff' : 'rgba(255,255,255,0.7)' }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}

const NAV_BG = '#0f172a'

const playSendSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const bufferSize = ctx.sampleRate * 0.35;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(150, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.25);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.18);
    
    oscGain.gain.setValueAtTime(0, ctx.currentTime);
    oscGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.06);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    noise.start();
    osc.start();
    noise.stop(ctx.currentTime + 0.35);
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn('Audio play error:', err);
  }
};

const playReceiveSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1174.66, ctx.currentTime);
    
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1567.98, ctx.currentTime + 0.07);
    
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start();
    osc2.start(ctx.currentTime + 0.07);
    
    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn('Audio play error:', err);
  }
};

export default function Navbar({ isLoggedIn, onLogout, onLangChange }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const { resolvedTheme, setTheme } = useTheme()
  const isLogin = location.pathname === '/login'
  const isDark  = resolvedTheme === 'dark'
  const [menuOpen, setMenuOpen] = useState(false)
  const toast = useToast()

  // Chat States
  const [chatOpen, setChatOpen] = useState(false)
  const [chatContacts, setChatContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatMessageText, setChatMessageText] = useState('')
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const [contactsSearch, setContactsSearch] = useState('')

  const [hasMore, setHasMore] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)

  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const chatIntervalRef = useRef(null)
  const unreadIntervalRef = useRef(null)
  const chatMessagesRef = useRef([])
  const isFirstUnreadFetchRef = useRef(true)

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  const handleScroll = (e) => {
    const container = e.currentTarget
    if (container.scrollTop === 0) {
      loadOlderMessages()
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setShowScrollBottomBtn(distanceFromBottom > 200)
  }

  useEffect(() => {
    chatMessagesRef.current = chatMessages
  }, [chatMessages])

  useEffect(() => {
    setHasMore(true)
    setLoadingOlder(false)
  }, [selectedContact])

  const fetchUnreadCount = async () => {
    if (!isLoggedIn) return
    try {
      const res = await fetch('/api/chat/unread-count', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setChatUnreadCount(prev => {
          if (!isFirstUnreadFetchRef.current && data.unread_count > prev) {
            playReceiveSound()
          }
          return data.unread_count
        })
        isFirstUnreadFetchRef.current = false
      }
    } catch (err) {
      console.error('Error fetching unread count:', err)
    }
  }

  const fetchContacts = async (showSkeleton = false) => {
    if (!isLoggedIn) return
    if (showSkeleton) setContactsLoading(true)
    try {
      const res = await fetch('/api/chat/contacts', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setChatContacts(data)
        if (selectedContact) {
          const updated = data.find(c => c.id === selectedContact.id)
          if (updated && updated.is_online !== selectedContact.is_online) {
            setSelectedContact(prev => prev ? { ...prev, is_online: updated.is_online } : null)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching contacts:', err)
    } finally {
      if (showSkeleton) setContactsLoading(false)
    }
  }

  const fetchMessages = async (contactId, isInitial = false) => {
    if (!isLoggedIn || !contactId) return
    try {
      const currentMsgs = chatMessagesRef.current
      const newestId = currentMsgs.length > 0 ? currentMsgs[currentMsgs.length - 1].id : null
      
      let url = `/api/chat/messages?contact_id=${contactId}`
      if (isInitial || !newestId) {
        url += '&limit=30'
      } else {
        url += `&after_id=${newestId}`
      }

      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (isInitial || !newestId) {
          setChatMessages(data)
          setHasMore(data.length === 30)
          // Scroll to bottom on initial load
          setTimeout(() => {
            if (chatContainerRef.current) {
              chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
            }
          }, 50)
        } else {
          // Polling new messages: check if there are actual new messages that we don't have yet
          const existingIds = new Set(currentMsgs.map(m => m.id))
          const filteredNew = data.filter(m => !existingIds.has(m.id))
          
          if (filteredNew.length > 0) {
            const hasIncoming = filteredNew.some(m => m.sender_id !== currentUser?.id)
            if (hasIncoming) {
              playReceiveSound()
            }
            
            const container = chatContainerRef.current
            let shouldScroll = false
            if (container) {
              const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
              shouldScroll = distanceFromBottom < 120
            }
            
            setChatMessages(prev => [...prev, ...filteredNew])
            
            if (shouldScroll) {
              setTimeout(() => {
                if (chatContainerRef.current) {
                  chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
                }
              }, 50)
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
    }
  }

  const loadOlderMessages = async () => {
    if (!selectedContact || !hasMore || loadingOlder) return
    const currentMsgs = chatMessagesRef.current
    if (currentMsgs.length === 0) return
    
    const oldestId = currentMsgs[0].id
    setLoadingOlder(true)
    
    try {
      const res = await fetch(`/api/chat/messages?contact_id=${selectedContact.id}&before_id=${oldestId}&limit=30`, { credentials: 'include' })
      if (res.ok) {
        const olderMsgs = await res.json()
        if (olderMsgs.length < 30) {
          setHasMore(false)
        }
        if (olderMsgs.length > 0) {
          const container = chatContainerRef.current
          const prevHeight = container ? container.scrollHeight : 0
          
          setChatMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id))
            const filteredOlder = olderMsgs.filter(m => !existingIds.has(m.id))
            return [...filteredOlder, ...prev]
          })
          
          // Restore scroll position
          setTimeout(() => {
            if (chatContainerRef.current && prevHeight > 0) {
              const nextHeight = chatContainerRef.current.scrollHeight
              chatContainerRef.current.scrollTop = nextHeight - prevHeight
            }
          }, 0)
        }
      }
    } catch (err) {
      console.error('Error loading older messages:', err)
    } finally {
      setLoadingOlder(false)
    }
  }

  const sendMessage = async (e) => {
    if (e) e.preventDefault()
    if (!chatMessageText.trim() || !selectedContact) return

    const textToSend = chatMessageText.trim()
    setChatMessageText('')

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: selectedContact.id,
          message: textToSend
        })
      })
      if (res.ok) {
        const newMsg = await res.json()
        playSendSound()
        setChatMessages(prev => [...prev, newMsg])
        
        // Auto scroll to bottom when user sends a message
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
          }
        }, 50)

        setChatContacts(prev => prev.map(c => {
          if (c.id === selectedContact.id) {
            return {
              ...c,
              last_message: {
                message: textToSend,
                created_at: new Date().toISOString(),
                sender_id: currentUser?.id
              }
            }
          }
          return c
        }))
        fetchUnreadCount()
      }
    } catch (err) {
      console.error('Error sending message:', err)
    }
  }

  // Background unread count polling
  useEffect(() => {
    if (isLoggedIn) {
      fetchUnreadCount()
      unreadIntervalRef.current = setInterval(fetchUnreadCount, 10000)
    } else {
      setChatUnreadCount(0)
      setChatOpen(false)
      setSelectedContact(null)
    }
    return () => {
      if (unreadIntervalRef.current) clearInterval(unreadIntervalRef.current)
    }
  }, [isLoggedIn])

  // Active chat polling when open
  useEffect(() => {
    if (chatOpen && isLoggedIn) {
      fetchContacts(true)
      if (selectedContact) {
        fetchMessages(selectedContact.id, true)
        fetchUnreadCount()
        chatIntervalRef.current = setInterval(() => {
          fetchMessages(selectedContact.id)
          fetchContacts()
        }, 3000)
      } else {
        chatIntervalRef.current = setInterval(() => {
          fetchContacts()
        }, 6000)
      }
    } else {
      if (chatIntervalRef.current) clearInterval(chatIntervalRef.current)
    }
    return () => {
      if (chatIntervalRef.current) clearInterval(chatIntervalRef.current)
    }
  }, [chatOpen, selectedContact?.id, isLoggedIn])

  const [notifications, setNotifications] = useState([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // Load dismissed system/camera alerts from localStorage
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissedAlerts')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Save dismissed alerts to localStorage
  const dismissAlert = (alertId) => {
    const updated = [...dismissedAlerts, alertId]
    setDismissedAlerts(updated)
    localStorage.setItem('dismissedAlerts', JSON.stringify(updated))
  }

  // Fetch notifications
  const fetchNavbarStatus = async () => {
    if (!isLoggedIn) return
    try {
      // 1. Fetch system status
      const res = await fetch('/api/system-monitor/navbar-status', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()

      const list = []

      // Telegram bot offline alert
      if (data.telegram && data.telegram.online === false) {
        list.push({
          id: 'bot-offline',
          isBotOffline: true,
          titleUz: 'Telegram bot to\'xtagan!',
          titleRu: 'Telegram-бот остановлен!',
          descUz: 'Tizimdagi xabar yuborish telegram boti ishlamayapti.',
          descRu: 'Служба Telegram-бота не активна.',
          type: 'error',
          icon: <AlertRegular style={{ color: '#f87171' }} fontSize={18} />,
        })
      }

      // Camera offline alerts
      if (data.camera_alerts && data.camera_alerts.items) {
        data.camera_alerts.items.forEach(cam => {
          const alertId = `cam-offline-${cam.id}-${cam.last_seen_at || 'never'}`
          list.push({
            id: alertId,
            titleUz: `${cam.name} kamerasi oflayn!`,
            titleRu: `Камера ${cam.name} отключена!`,
            descUz: cam.organization_name 
              ? `${cam.organization_name}. Oxirgi faollik: ${cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleString() : 'hech qachon'}`
              : `Oxirgi faollik: ${cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleString() : 'hech qachon'}`,
            descRu: cam.organization_name
              ? `${cam.organization_name}. Последняя активность: ${cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleString() : 'никогда'}`
              : `Последняя активность: ${cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleString() : 'никогда'}`,
            type: 'warning',
            path: '/devices',
            icon: <CameraRegular style={{ color: '#fb923c' }} fontSize={18} />,
          })
        })
      }

      // 2. Fetch unread appeals (contact messages)
      if (data.unread_appeals_count > 0) {
        const appealsRes = await fetch('/api/settings/contact-messages', { credentials: 'include' })
        if (appealsRes.ok) {
          const appealsData = await appealsRes.json()
          if (appealsData.messages) {
            appealsData.messages.forEach(msg => {
              if (!msg.is_read) {
                list.push({
                  id: `appeal-${msg.id}`,
                  appealId: msg.id,
                  titleUz: `Yangi murojaat: ${msg.name}`,
                  titleRu: `Новое обращение: ${msg.name}`,
                  descUz: msg.message.length > 60 ? `${msg.message.substring(0, 60)}...` : msg.message,
                  descRu: msg.message.length > 60 ? `${msg.message.substring(0, 60)}...` : msg.message,
                  type: 'info',
                  path: '/settings/messages',
                  icon: <MailRegular style={{ color: '#38bdf8' }} fontSize={18} />,
                })
              }
            })
          }
        }
      }

      setNotifications(list)
    } catch (err) {
      console.error('Error fetching navbar status alerts:', err)
    }
  }

  // Poll notifications
  useEffect(() => {
    if (isLoggedIn) {
      fetchNavbarStatus()
      const interval = setInterval(fetchNavbarStatus, 8000)

      const handleRefresh = () => {
        fetchNavbarStatus()
      }
      window.addEventListener('navbar-refresh', handleRefresh)

      return () => {
        clearInterval(interval)
        window.removeEventListener('navbar-refresh', handleRefresh)
      }
    } else {
      setNotifications([])
    }
  }, [isLoggedIn])

  // Handle click outside notifications dropdown
  useEffect(() => {
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false)
      }
    }
    if (isNotifOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isNotifOpen])

  const activeNotifications = notifications.filter(notif => {
    if (notif.appealId) return true
    return !dismissedAlerts.includes(notif.id)
  })

  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [appName, setAppName] = useState('BioFace')
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const fetchUser = () => {
      if (isLoggedIn) {
        fetch('/api/auth/me', { credentials: 'include' })
          .then(res => {
            if (res.ok) return res.json()
            throw new Error('Unauthorized')
          })
          .then(data => {
            setCurrentUser(data)
          })
          .catch(err => {
            console.log('Error loading current user:', err)
          })
      } else {
        setCurrentUser(null)
      }
    }

    fetchUser()
    window.addEventListener('user-profile-updated', fetchUser)
    return () => window.removeEventListener('user-profile-updated', fetchUser)
  }, [isLoggedIn])

  const getUserInitials = () => {
    if (!currentUser) return ''
    const last = (currentUser.last_name || '').trim()
    const first = (currentUser.first_name || '').trim()
    if (last && first) {
      return `${last}.${first.charAt(0).toUpperCase()}.`
    }
    if (last) return last
    if (first) return first
    return (currentUser.display_name || currentUser.name || '').trim()
  }

  const initials = getUserInitials()

  useEffect(() => {
    fetch('/api/settings')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to load settings');
      })
      .then(data => {
        if (data) {
          setAppName(data.app_name || 'BioFace')
          setLogoUrl(data.logo_url || '')
          setFaviconUrl(data.favicon_url || '')
        }
      })
      .catch(err => {
        console.log('Error loading branding settings:', err)
      })
  }, [])

  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") || document.querySelector("link[rel='shortcut icon']");
    if (link) {
      link.href = faviconUrl || '/favicon.svg';
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = faviconUrl || '/favicon.svg';
      document.head.appendChild(newLink);
    }
  }, [faviconUrl])

  useEffect(() => {
    document.title = appName || 'BioFace';
  }, [appName])

  const handleLangChange = (lang) => {
    i18n.changeLanguage(lang)
    if (onLangChange) onLangChange(lang)
  }

  const handleLogout = () => {
    if (onLogout) onLogout()
    navigate('/login')
  }

  const links = isLoggedIn ? PRIVATE_LINKS : PUBLIC_LINKS

  return (
    <>
      <header style={{
        height: 52,
        background: NAV_BG,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center',
        padding: 'var(--header-padding, 0 24px)', gap: 'var(--header-gap, 4px)',
        position: 'sticky', top: 0, zIndex: 200,
      }}>
        {/* Logo */}
        <div onClick={() => { navigate(isLoggedIn ? '/dashboard' : '/'); setMenuOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginRight: 'var(--logo-margin-right, 16px)' }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={appName}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: 28, height: 28, background: 'var(--accent)',
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {appName ? appName.charAt(0).toUpperCase() : 'B'}
            </div>
          )}
          <span className="logo-text" style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: -0.3 }}>
            {appName}
          </span>
        </div>

        {/* Desktop Nav links */}
        <nav className="desktop-nav" style={{ display: 'flex', gap: 'var(--desktop-nav-gap, 2px)', flex: 1 }}>
          {links.map(id => (
            <NavBtn key={id} id={id}
              active={location.pathname === LINK_PATHS[id] || location.pathname.startsWith(LINK_PATHS[id] + '/')}
              onClick={() => navigate(LINK_PATHS[id])}
            />
          ))}
          {isLoggedIn && (
            <>
              <AttendanceDropdown active={location.pathname.startsWith('/attendance') || location.pathname.startsWith('/psychology')} />
              <UsersDropdown active={location.pathname.startsWith('/users')} />
              <OrganizationsDropdown active={location.pathname.startsWith('/organizations') || location.pathname.startsWith('/shifts')} />
              <FinanceDropdown active={location.pathname.startsWith('/finance')} />
              <SettingsDropdown active={location.pathname.startsWith('/settings') || location.pathname.startsWith('/middleware-logs')} />
            </>
          )}
        </nav>

        <div className="desktop-actions" style={{ display: 'flex', alignItems: 'center' }}>
          {/* Messages toggle */}
          {isLoggedIn && (
            <Tooltip content={isRu ? 'Сообщения' : 'Xabarlar'} relationship="label">
              <button onClick={() => setChatOpen(true)} aria-label="Open chat drawer"
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginRight: 'var(--action-btn-margin-right, 8px)', flexShrink: 0,
                  position: 'relative'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
              >
                <ChatRegular fontSize={16} />
                {chatUnreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    background: '#10b981', color: '#fff', fontSize: 9, fontWeight: 'bold',
                    width: 15, height: 15, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 5px rgba(16, 185, 129, 0.6)',
                  }}>
                    {chatUnreadCount}
                  </span>
                )}
              </button>
            </Tooltip>
          )}

          {/* Theme toggle */}
          <Tooltip content={isDark ? t('nav.themeLight') : t('nav.themeDark')} relationship="label">
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Toggle theme"
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginRight: 'var(--action-btn-margin-right, 8px)', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            >
              {isDark ? <WeatherSunnyRegular fontSize={16} /> : <WeatherMoonRegular fontSize={16} />}
            </button>
          </Tooltip>

          {/* Language switcher */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 7,
            padding: 3, marginRight: 'var(--lang-margin-right, 10px)', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {['uz', 'ru'].map(l => (
              <button key={l} onClick={() => handleLangChange(l)} style={{
                padding: 'var(--lang-btn-padding, 3px 11px)', borderRadius: 5, border: 'none',
                background: i18n.language === l ? 'var(--accent)' : 'transparent',
                color: i18n.language === l ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 11.5, fontWeight: i18n.language === l ? 700 : 400,
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{l}</button>
            ))}
          </div>

          {/* Auth button */}
          {isLoggedIn && (
            <Tooltip content={i18n.language === 'ru' ? 'Профиль' : 'Profil'} relationship="label">
              <button onClick={() => navigate('/profile')} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--nav-btn-gap, 6px)',
                padding: 'var(--nav-btn-padding, 5px 13px)', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                color: '#fff', fontSize: 'var(--nav-btn-font-size, 13px)', cursor: 'pointer',
                marginRight: 'var(--action-btn-margin-right, 8px)',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <PersonRegular fontSize={15} />
                {initials || (i18n.language === 'ru' ? 'Профиль' : 'Profil')}
              </button>
            </Tooltip>
          )}

          {isLoggedIn ? (
            <Tooltip content={t('nav.logout')} relationship="label">
              <button onClick={handleLogout} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--nav-btn-gap, 6px)',
                padding: 'var(--nav-btn-padding, 5px 13px)', borderRadius: 6,
                border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)',
                color: '#f87171', fontSize: 'var(--nav-btn-font-size, 13px)', cursor: 'pointer',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
              >
                <SignOutRegular fontSize={15} />
                {t('nav.logout')}
              </button>
            </Tooltip>
          ) : !isLogin ? (
            <button onClick={() => navigate('/login')} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--nav-btn-gap, 6px)',
              padding: 'var(--nav-btn-padding, 5px 13px)', borderRadius: 6,
              border: '1px solid rgba(71,158,245,0.3)', background: 'rgba(71,158,245,0.1)',
              color: '#479ef5', fontSize: 'var(--nav-btn-font-size, 13px)', fontWeight: 600, cursor: 'pointer',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(71,158,245,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(71,158,245,0.1)'}
            >
              <PersonRegular fontSize={15} />
              {t('nav.login')}
            </button>
          ) : null}
        </div>

        {/* Notifications Bell Dropdown */}
        {isLoggedIn && (
          <div ref={notifRef} style={{ position: 'relative', marginRight: 8 }}>
            <Tooltip content={isRu ? 'Уведомления' : 'Bildirishnomalar'} relationship="label">
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} aria-label="Notifications"
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: isNotifOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: activeNotifications.length > 0 ? '#fb7185' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer', flexShrink: 0,
                  position: 'relative',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = activeNotifications.length > 0 ? '#fda4af' : '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = isNotifOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = activeNotifications.length > 0 ? '#fb7185' : 'rgba(255,255,255,0.6)' }}
              >
                <AlertRegular fontSize={18} style={{
                  animation: activeNotifications.length > 0 ? 'pulse 2s infinite' : 'none'
                }} />
                {activeNotifications.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    background: '#e11d48', color: '#fff',
                    fontSize: 9.5, fontWeight: 700,
                    minWidth: 16, height: 16, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', border: `2px solid ${NAV_BG}`,
                    boxShadow: '0 0 10px rgba(225,29,72,0.5)',
                  }}>
                    {activeNotifications.length}
                  </span>
                )}
              </button>
            </Tooltip>

            {isNotifOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: 'rgba(26, 34, 54, 0.95)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '12px 0 8px 0', minWidth: 320, maxWidth: 360,
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                zIndex: 9999, animation: 'fadeInNotif 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 16px 10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                    {isRu ? 'Уведомления' : 'Bildirishnomalar'}
                    {activeNotifications.length > 0 && (
                      <span style={{ marginLeft: 6, color: '#fb7185', fontSize: 12 }}>
                        ({activeNotifications.length})
                      </span>
                    )}
                  </span>
                  {activeNotifications.length > 0 && (
                    <button onClick={async () => {
                      // 1. Mark all system/camera alerts as read locally
                      const systemAlertIds = activeNotifications.filter(n => !n.appealId).map(n => n.id)
                      if (systemAlertIds.length > 0) {
                        const updated = [...dismissedAlerts, ...systemAlertIds]
                        setDismissedAlerts(updated)
                        localStorage.setItem('dismissedAlerts', JSON.stringify(updated))
                      }
                      // 2. Mark all appeals as read on backend
                      const hasAppeals = activeNotifications.some(n => n.appealId)
                      if (hasAppeals) {
                        try {
                          await fetch('/api/settings/contact-messages/read-all', { method: 'POST', credentials: 'include' })
                        } catch (e) {
                          console.error(e)
                        }
                      }
                      fetchNavbarStatus()
                    }} style={{
                      background: 'transparent', border: 'none', color: 'var(--accent)',
                      fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0,
                    }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      {isRu ? 'Прочитать все' : 'Hammasini o\'qish'}
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{
                  maxHeight: 320, overflowY: 'auto', padding: '4px 0',
                }}>
                  {activeNotifications.length === 0 ? (
                    <div style={{
                      padding: '24px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.4)',
                      fontSize: 12.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    }}>
                      <AlertRegular fontSize={24} style={{ opacity: 0.5 }} />
                      <div>{isRu ? 'Новых уведомлений нет' : 'Yangi bildirishnomalar mavjud emas'}</div>
                    </div>
                  ) : (
                    activeNotifications.map(notif => (
                      <div key={notif.id} 
                        onClick={() => {
                          if (notif.path) {
                            navigate(notif.path)
                            setIsNotifOpen(false)
                          }
                        }}
                        style={{
                          display: 'flex', gap: 10, padding: '10px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          cursor: notif.path ? 'pointer' : 'default',
                          transition: 'background 0.15s',
                          background: 'transparent',
                        }}
                        onMouseEnter={e => { if (notif.path) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {notif.icon}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
                            {isRu ? notif.titleRu : notif.titleUz}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                            {isRu ? notif.descRu : notif.descUz}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {notif.isBotOffline ? (
                            <>
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const res = await fetch('/api/telegram/process/start', { method: 'POST', credentials: 'include' })
                                    if (res.ok) {
                                      toast.success(isRu ? 'Telegram-бот успешно запущен' : 'Telegram bot muvaffaqiyatli ishga tushirildi')
                                      window.dispatchEvent(new CustomEvent('navbar-refresh'))
                                    } else {
                                      const errData = await res.json()
                                      toast.error(errData.detail || (isRu ? 'Ошибка при запуске' : 'Ishga tushirishda xatolik'))
                                    }
                                  } catch (err) {
                                    toast.error(err.message)
                                  }
                                }}
                                style={{
                                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                                  color: '#34d399', borderRadius: 5, padding: '3px 8px',
                                  fontSize: 10.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; e.currentTarget.style.color = '#fff' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; e.currentTarget.style.color = '#34d399' }}
                              >
                                {isRu ? 'Запустить' : 'Tiklash'}
                              </button>
                              <button onClick={(e) => {
                                e.stopPropagation()
                                dismissAlert(notif.id)
                              }} style={{
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.6)', borderRadius: 5, padding: '3px 8px',
                                fontSize: 10.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                              }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                              >
                                {isRu ? 'ОК' : 'O\'qildi'}
                              </button>
                            </>
                          ) : (
                            <button onClick={async (e) => {
                              e.stopPropagation() // Prevent navigation if clicking dismiss
                              if (notif.appealId) {
                                try {
                                  const res = await fetch(`/api/settings/contact-messages/${notif.appealId}/read`, { method: 'POST', credentials: 'include' })
                                  if (res.ok) fetchNavbarStatus()
                                } catch (err) {
                                  console.error(err)
                                }
                              } else {
                                dismissAlert(notif.id)
                              }
                            }} style={{
                              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.6)', borderRadius: 5, padding: '3px 8px',
                              fontSize: 10.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                            }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                            >
                              {isRu ? 'ОК' : 'O\'qildi'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            <style>{`
              @keyframes fadeInNotif {
                from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.08); }
                100% { transform: scale(1); }
              }
            `}</style>
          </div>
        )}

        {/* Animated Hamburger Button for Mobile */}
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          style={{
            display: 'none',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 24,
            height: 18,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            boxSizing: 'border-box',
            marginLeft: 'auto',
            zIndex: 210,
          }}
        >
          <span style={{
            width: '100%',
            height: 2,
            background: '#fff',
            borderRadius: 2,
            transition: 'all 0.3s ease',
            transformOrigin: '1px',
            transform: menuOpen ? 'rotate(45deg) translate(2px, 2px)' : 'rotate(0)'
          }} />
          <span style={{
            width: '100%',
            height: 2,
            background: '#fff',
            borderRadius: 2,
            transition: 'all 0.3s ease',
            opacity: menuOpen ? 0 : 1,
            transform: menuOpen ? 'translateX(10px)' : 'translateX(0)'
          }} />
          <span style={{
            width: '100%',
            height: 2,
            background: '#fff',
            borderRadius: 2,
            transition: 'all 0.3s ease',
            transformOrigin: '1px',
            transform: menuOpen ? 'rotate(-45deg) translate(2px, -2px)' : 'rotate(0)'
          }} />
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {menuOpen && (
        <div className="mobile-drawer" style={{
          position: 'absolute',
          top: 52,
          left: 0,
          right: 0,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          zIndex: 199,
          maxHeight: 'calc(100vh - 52px)',
          overflowY: 'auto',
          animation: 'slideDown 0.3s ease-out',
        }}>
          {/* Navigation Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {links.map(id => {
              if (id === 'settings' || id === 'users') return null;
              const active = location.pathname === LINK_PATHS[id] || location.pathname.startsWith(LINK_PATHS[id] + '/');
              return (
                <button key={id} onClick={() => { navigate(LINK_PATHS[id]); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8, border: 'none',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                    fontSize: 14, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                >
                  {LINK_ICONS[id]}
                  {t(`nav.${id}`)}
                </button>
              );
            })}

            {/* Attendance group if logged in */}
            {isLoggedIn && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.35)',
                  textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 14px 6px'
                }}>
                  {isRu ? 'Посещаемость' : 'Davomat'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { id: 'attendance', label: isRu ? 'Посещаемость' : 'Davomat', icon: <ClipboardTaskListLtrRegular fontSize={14} />, path: '/attendance' },
                    { id: 'psychology', label: isRu ? 'Психологический портрет' : 'Psixologik portret', icon: <BrainCircuitRegular fontSize={14} />, path: '/psychology' },
                  ].map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <button key={item.id} onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px 8px 24px', borderRadius: 8, border: 'none',
                          background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: active ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Users group if logged in */}
            {isLoggedIn && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.35)',
                  textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 14px 6px'
                }}>
                  {t('nav.users')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { id: 'usersAdmins', label: t('nav.usersAdmins'), icon: <ShieldRegular fontSize={14} />, path: '/users' },
                    { id: 'usersStaff', label: t('nav.usersStaff'), icon: <PeopleRegular fontSize={14} />, path: '/users/staff' },
                    { id: 'usersStudents', label: t('nav.usersStudents'), icon: <HatGraduationRegular fontSize={14} />, path: '/users/students' },
                  ].map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <button key={item.id} onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px 8px 24px', borderRadius: 8, border: 'none',
                          background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: active ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Organizations group if logged in */}
            {isLoggedIn && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.35)',
                  textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 14px 6px'
                }}>
                  {isRu ? 'Организации' : 'Tashkilotlar'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { id: 'organizations', label: isRu ? 'Организации' : 'Tashkilotlar', icon: <BuildingRegular fontSize={14} />, path: '/organizations' },
                    { id: 'shifts', label: isRu ? 'Смены' : 'Smenalar', icon: <CalendarClockRegular fontSize={14} />, path: '/shifts' },
                  ].map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <button key={item.id} onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px 8px 24px', borderRadius: 8, border: 'none',
                          background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: active ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Finance group if logged in */}
            {isLoggedIn && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.35)',
                  textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 14px 6px'
                }}>
                  {isRu ? 'Финансы' : 'Moliya'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { id: 'financeSalary', label: t('nav.financeSalary'), icon: <MoneyRegular fontSize={14} />, path: '/finance/salary' },
                    { id: 'financeKpi', label: t('nav.financeKpi'), icon: <StarRegular fontSize={14} />, path: '/finance/kpi' },
                    { id: 'financeCashflow', label: t('nav.financeCashflow'), icon: <ArrowSwapRegular fontSize={14} />, path: '/finance/cashflow' },
                    { id: 'financeAccounts', label: t('nav.financeAccounts'), icon: <WalletRegular fontSize={14} />, path: '/finance/accounts' },
                  ].map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <button key={item.id} onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px 8px 24px', borderRadius: 8, border: 'none',
                          background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: active ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Settings group if logged in */}
            {isLoggedIn && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.35)',
                  textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 14px 6px'
                }}>
                  {t('nav.settings')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { id: 'settings', label: isRu ? 'Настройки' : 'Sozlamalar', icon: <SettingsRegular fontSize={14} />, path: '/settings' },
                    { id: 'roles', label: isRu ? 'Роли' : 'Rollar', icon: <ShieldRegular fontSize={14} />, path: '/users' },
                    { id: 'messages', label: isRu ? 'Обращения' : 'Murojaatlar', icon: <MailRegular fontSize={14} />, path: '/settings/messages' },
                    { id: 'middlewareLogs', label: isRu ? 'Логи API' : 'API Jurnali', icon: <HistoryRegular fontSize={14} />, path: '/middleware-logs' },
                    { id: 'isup', label: 'ISUP Server', icon: <ServerRegular fontSize={14} />, path: '/settings/isup' },
                    { id: 'redis', label: 'Redis', icon: <DatabaseRegular fontSize={14} />, path: '/settings/redis' },
                    { id: 'api', label: 'API Helper', icon: <PlugConnectedRegular fontSize={14} />, path: '/settings/api' },
                    { id: 'versions', label: isRu ? 'Версии системы' : 'Versiya nazorati', icon: <TagRegular fontSize={14} />, path: '/settings/versions' },
                  ].map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <button key={item.id} onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px 8px 24px', borderRadius: 8, border: 'none',
                          background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: active ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                          fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

          {/* Actions Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isLoggedIn && (
              <button onClick={() => { setChatOpen(true); setMenuOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', fontSize: 13.5, cursor: 'pointer',
                  position: 'relative', width: '100%'
                }}
              >
                <ChatRegular fontSize={16} />
                {isRu ? 'Сообщения' : 'Xabarlar'}
                {chatUnreadCount > 0 && (
                  <span style={{
                    marginLeft: 6,
                    background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 'bold',
                    padding: '1px 6px', borderRadius: 10,
                    boxShadow: '0 0 5px rgba(16, 185, 129, 0.6)',
                  }}>
                    {chatUnreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Theme and Language Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Theme Toggle Button */}
              <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', fontSize: 13.5, cursor: 'pointer',
                  marginRight: 10,
                }}
              >
                {isDark ? <WeatherSunnyRegular fontSize={16} /> : <WeatherMoonRegular fontSize={16} />}
                {isDark ? t('nav.themeLight') : t('nav.themeDark')}
              </button>

              {/* Language switch */}
              <div style={{
                display: 'flex', background: 'rgba(255, 255, 255, 0.07)', borderRadius: 8,
                padding: 3, border: '1px solid rgba(255, 255, 255, 0.1)',
              }}>
                {['uz', 'ru'].map(l => (
                  <button key={l} onClick={() => handleLangChange(l)} style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: i18n.language === l ? 'var(--accent)' : 'transparent',
                    color: i18n.language === l ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: 12, fontWeight: i18n.language === l ? 700 : 400,
                    cursor: 'pointer', textTransform: 'uppercase',
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Profile & Logout / Login */}
            {isLoggedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.06)', color: '#fff', fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  <PersonRegular fontSize={16} />
                  {initials || (i18n.language === 'ru' ? 'Профиль' : 'Profil')}
                </button>

                <button onClick={() => { handleLogout(); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px', borderRadius: 8, border: '1px solid rgba(248, 113, 113, 0.3)',
                    background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  <SignOutRegular fontSize={16} />
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              !isLogin && (
                <button onClick={() => { navigate('/login'); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px', borderRadius: 8, border: '1px solid rgba(71, 158, 245, 0.3)',
                    background: 'rgba(71, 158, 245, 0.1)', color: '#479ef5', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <PersonRegular fontSize={16} />
                  {t('nav.login')}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Chat Drawer Overlay & Container */}
      {isLoggedIn && chatOpen && (
        <div 
          onClick={() => setChatOpen(false)} 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 1999, backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.2s ease'
          }}
        />
      )}

      {isLoggedIn && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0,
          width: 400, maxWidth: '100%',
          background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          zIndex: 2000, boxShadow: '-5px 0 25px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: chatOpen ? 'translateX(0)' : 'translateX(100%)',
          color: 'var(--text-1)',
        }}>
          {/* Drawer Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 20px', borderBottom: '1px solid var(--border-2)',
            background: 'var(--surface-1)'
          }}>
            {selectedContact ? (
              <button 
                type="button" 
                onClick={() => setSelectedContact(null)} 
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-2)', 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4
                }}
              >
                <ArrowLeftRegular fontSize={18} />
              </button>
            ) : null}

            <div style={{ flex: 1, minWidth: 0 }}>
              {selectedContact ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {selectedContact.name}
                    </div>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: selectedContact.is_online ? '#10b981' : '#9ca3af',
                      boxShadow: selectedContact.is_online ? '0 0 6px #10b981' : 'none',
                      flexShrink: 0
                    }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-4)', marginTop: 2 }}>
                    <span style={{ textTransform: 'uppercase' }}>
                      {selectedContact.role === 'SuperAdmin' ? (isRu ? 'Администратор' : 'Administrator') : selectedContact.organization_name}
                    </span>
                    <span>•</span>
                    <span style={{ color: selectedContact.is_online ? '#10b981' : 'var(--text-4)', fontWeight: 600 }}>
                      {selectedContact.is_online ? (isRu ? 'в сети' : 'onlayn') : (isRu ? 'не в сети' : 'oflayn')}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                  {isRu ? 'Сообщения' : 'Xabarlar'}
                </div>
              )}
            </div>

            <button 
              type="button" 
              onClick={() => setChatOpen(false)} 
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-3)', 
                cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4
              }}
            >
              <DismissRegular fontSize={18} />
            </button>
          </div>

          {/* Contact Search Input (Visible only in contacts list) */}
          {!selectedContact && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
              <input
                type="text"
                value={contactsSearch}
                onChange={e => setContactsSearch(e.target.value)}
                placeholder={isRu ? 'Поиск контактов...' : 'Kontaktlarni qidirish...'}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: '1px solid var(--border-2)', background: 'var(--bg)',
                  color: 'var(--text-1)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* Drawer Body */}
          {selectedContact ? (
            /* Chat window history and input */
            <>
              <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div 
                  ref={chatContainerRef}
                  onScroll={handleScroll}
                  style={{
                    flex: 1, overflowY: 'auto', padding: '16px 20px',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    background: 'var(--bg)'
                  }}
                >
                  {loadingOlder && (
                    <div style={{ textAlign: 'center', padding: '4px 0', color: 'var(--text-4)', fontSize: 11 }}>
                      {isRu ? 'Загрузка сообщений...' : 'Xabarlar yuklanmoqda...'}
                    </div>
                  )}
                  {chatMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginTop: 50 }}>
                      {isRu ? 'Нет сообщений. Начните диалог!' : 'Xabarlar yo\'q. Suhbatni boshlang!'}
                    </div>
                  ) : (
                    chatMessages.map(m => {
                      const isMe = m.sender_id === currentUser?.id;
                      const avatarSrc = isMe
                        ? (currentUser?.image_url || '')
                        : (selectedContact?.image_url || '');
                      const avatarLetter = isMe
                        ? (currentUser?.first_name || currentUser?.name || 'M').charAt(0).toUpperCase()
                        : (selectedContact?.first_name || selectedContact?.name || '?').charAt(0).toUpperCase();
                      const isValidAvatar = avatarSrc && (avatarSrc.startsWith('/static/') || avatarSrc.startsWith('http'));
                      return (
                        <div key={m.id} style={{
                          display: 'flex',
                          flexDirection: isMe ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          gap: 8,
                          width: '100%'
                        }}>
                          {/* Avatar */}
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: isMe ? 'var(--accent)' : 'var(--border-3)',
                            color: '#fff', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 'bold',
                            overflow: 'hidden', position: 'relative',
                          }}>
                            {isValidAvatar && (
                              <img
                                src={avatarSrc}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                                onError={e => { e.target.style.display = 'none' }}
                              />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{avatarLetter}</span>
                          </div>
                          {/* Bubble */}
                          <div style={{
                            maxWidth: '72%',
                            padding: '9px 13px',
                            borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            background: isMe ? 'var(--accent)' : 'var(--surface-2)',
                            color: isMe ? '#fff' : 'var(--text-1)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                          }}>
                            <div style={{ fontSize: 13, lineHeight: '1.4', wordBreak: 'break-word' }}>{m.message}</div>
                            <div style={{
                              fontSize: 9,
                              color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-4)',
                              textAlign: 'right', marginTop: 4,
                              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4
                            }}>
                              {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              {isMe && (
                                m.is_read ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', width: 13, height: 10, marginLeft: 2 }}>
                                    <CheckmarkRegular fontSize={10} style={{ color: '#60a5fa', position: 'absolute', left: 0 }} />
                                    <CheckmarkRegular fontSize={10} style={{ color: '#60a5fa', position: 'absolute', left: 4 }} />
                                  </span>
                                ) : (
                                  <CheckmarkRegular fontSize={10} style={{ color: 'rgba(255,255,255,0.5)' }} />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Scroll Bottom Button */}
                {showScrollBottomBtn && (
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    style={{
                      position: 'absolute',
                      bottom: 16,
                      right: 20,
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border-2)',
                      color: 'var(--text-1)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--surface-2)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--surface)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <ChevronDownRegular fontSize={18} style={{ color: 'var(--accent)' }} />
                  </button>
                )}
              </div>

              {/* Chat Input Form */}
              <form onSubmit={sendMessage} style={{
                padding: '12px 16px', borderTop: '1px solid var(--border-2)',
                display: 'flex', gap: 8, background: 'var(--surface-1)'
              }}>
                <input
                  type="text"
                  value={chatMessageText}
                  onChange={e => setChatMessageText(e.target.value)}
                  placeholder={isRu ? 'Написать сообщение...' : 'Xabar yozing...'}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8,
                    border: '1px solid var(--border-2)', background: 'var(--bg)',
                    color: 'var(--text-1)', fontSize: 13, outline: 'none'
                  }}
                />
                <button type="submit" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 8, background: 'var(--accent)',
                  color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0
                }}>
                  <SendRegular fontSize={14} />
                </button>
              </form>
            </>
          ) : (
            /* Contacts List */
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {(() => {
                const query = contactsSearch.trim().toLowerCase();
                const filtered = chatContacts.filter(c => {
                  const name = (c.name || '').toLowerCase();
                  const firstName = (c.first_name || '').toLowerCase();
                  const lastName = (c.last_name || '').toLowerCase();
                  const middleName = (c.middle_name || '').toLowerCase();
                  const email = (c.email || '').toLowerCase();
                  const phone = (c.phone || '').toLowerCase();
                  return name.includes(query) ||
                         firstName.includes(query) ||
                         lastName.includes(query) ||
                         middleName.includes(query) ||
                         email.includes(query) ||
                         phone.includes(query);
                });
                if (contactsLoading) {
                  return Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton-item" style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderBottom: '1px solid var(--border-2)',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'var(--border-2)', flexShrink: 0
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: '45%', height: 11, background: 'var(--border-2)', borderRadius: 4, marginBottom: 7 }} />
                        <div style={{ width: '70%', height: 9, background: 'var(--border-2)', borderRadius: 3 }} />
                      </div>
                    </div>
                  ));
                }
                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginTop: 50 }}>
                      {query ? (
                        isRu ? 'Такого пользователя нет в системе' : 'Bunday foydalanuvchi tizimda yo\'q'
                      ) : (
                        isRu ? 'Нет доступных контактов' : 'Muloqot uchun kontaktlar mavjud emas'
                      )}
                    </div>
                  );
                }
                return filtered.map(c => {
                  const hasLastMsg = c.last_message && c.last_message.message;
                  const isLastMsgMe = c.last_message?.sender_id === currentUser?.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedContact(c);
                        setChatMessages([]);
                        fetchMessages(c.id, true);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderBottom: '1px solid var(--border-2)',
                        cursor: 'pointer', transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Avatar — rasm yoki initials */}
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: c.role === 'SuperAdmin' ? 'var(--accent)' : 'var(--border-3)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 'bold', flexShrink: 0,
                        position: 'relative', overflow: 'visible'
                      }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute' }}>
                          {c.image_url && (c.image_url.startsWith('/static/') || c.image_url.startsWith('http')) ? (
                            <img
                              src={c.image_url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                              onError={e => { e.target.style.display = 'none' }}
                            />
                          ) : null}
                          <span style={{ position: 'relative', zIndex: 1 }}>
                            {(c.first_name || c.name || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div style={{
                          position: 'absolute', bottom: -1, right: -1,
                          width: 11, height: 11, borderRadius: '50%',
                          background: c.is_online ? '#10b981' : '#9ca3af',
                          border: '2px solid var(--surface-1)',
                          boxShadow: c.is_online ? '0 0 6px #10b981' : 'none',
                          zIndex: 2,
                        }} />
                      </div>
                      {/* Summary details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-1)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </span>
                          {c.last_message?.created_at && (
                            <span style={{ fontSize: 10, color: 'var(--text-4)' }}>
                              {new Date(c.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                            {hasLastMsg ? (isLastMsgMe ? `${isRu ? 'Вы: ' : 'Siz: '}${c.last_message.message}` : c.last_message.message) : (isRu ? 'Нажмите, чтобы начать чат' : 'Suhbatni boshlash uchun bosing')}
                          </span>
                          {c.unread_count > 0 && (
                            <span style={{
                              background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 'bold',
                              minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 0 5px rgba(16, 185, 129, 0.4)'
                            }}>
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 500 }}>
                          {c.role === 'SuperAdmin' ? (isRu ? '★ АДМИН ТИЗЕМА' : '★ TIZIM ADMINI') : c.organization_name}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Global CSS for Navigation Responsiveness */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .skeleton-item {
          animation: pulse 1.5s infinite ease-in-out;
        }

        :root {
          --nav-btn-padding: 5px 13px;
          --nav-btn-gap: 6px;
          --nav-btn-font-size: 13px;
          --header-padding: 0 24px;
          --header-gap: 4px;
          --logo-margin-right: 16px;
          --desktop-nav-gap: 2px;
          --action-btn-margin-right: 8px;
          --lang-margin-right: 10px;
          --lang-btn-padding: 3px 11px;
        }

        @media (max-width: 1418px) {
          :root {
            --nav-btn-padding: 5px 6px;
            --nav-btn-gap: 4px;
            --nav-btn-font-size: 12px;
            --header-padding: 0 10px;
            --header-gap: 2px;
            --logo-margin-right: 8px;
            --desktop-nav-gap: 1px;
            --action-btn-margin-right: 4px;
            --lang-margin-right: 6px;
            --lang-btn-padding: 3px 6px;
          }
          .logo-text {
            display: none !important;
          }
        }

        @media (max-width: 1200px) {
          .desktop-nav {
            display: none !important;
          }
          .desktop-actions {
            display: none !important;
          }
          .hamburger-btn {
            display: flex !important;
          }
        }
      `}</style>
    </>
  )
}
