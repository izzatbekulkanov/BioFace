import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowSyncRegular,
  CheckmarkRegular,
  EyeRegular,
  EyeOffRegular,
  ArrowLeftRegular,
  ImageRegular,
  DismissRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  CameraRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

// Email domain suggestions shown after "@"
const EMAIL_DOMAINS = [
  'gmail.com', 'mail.ru', 'inbox.uz', 'yahoo.com',
  'outlook.com', 'hotmail.com', 'yandex.ru', 'bk.ru', 'list.ru'
]

// Phone mask helper — formats digits into +998 XX XXX XX XX
function applyPhoneMask(raw) {
  // Keep only digits
  const digits = raw.replace(/\D/g, '')
  // Always start with 998
  const body = digits.startsWith('998') ? digits.slice(3) : digits
  const d = body.slice(0, 9) // max 9 digits after country code
  let result = '+998'
  if (d.length === 0) return result
  result += ' ' + d.slice(0, 2)
  if (d.length > 2) result += ' ' + d.slice(2, 5)
  if (d.length > 5) result += ' ' + d.slice(5, 7)
  if (d.length > 7) result += ' ' + d.slice(7, 9)
  return result
}

/**
 * Foydalanuvchini qo'shish / tahrirlash sahifasi (alohida sahifa, modal emas).
 *
 * Marshrutlar:
 *   /users/new        — yangi foydalanuvchi yaratish
 *   /users/:id/edit   — mavjud foydalanuvchini tahrirlash
 *
 * Bo'limlar:
 *   1. Shaxsiy ma'lumotlar  — Ism, Familiya, Otasining ismi
 *   2. Kirish ma'lumotlari   — Username (tekshirish bilan), Parol, Parolni tasdiqlash
 *   3. Kontakt va rol        — Email, Telefon, Rol, Status
 *   4. Tashkilot             — multi-select tashkilotlar
 *   5. Google OAuth          — toggle
 *   6. Avatar                — fayl yuklash + URL
 *
 * Backend:
 *   POST /api/users          (multipart/form-data)
 *   PUT  /api/users/{id}     (multipart/form-data)
 *   GET  /api/users          ro'yxatdan ma'lumot olish (tahrirlashda)
 *   GET  /api/organizations
 *   GET  /api/users/username/check?username=...
 */

const ROLES = [
  { value: 'SuperAdmin',     label_uz: 'Asosiy Administrator', label_ru: 'Главный администратор' },
  { value: 'MahallaAdmin',   label_uz: 'Mahalla Admini',       label_ru: 'Махаллинский админ' },
  { value: 'MaktabAdmin',    label_uz: 'Maktab Admini',        label_ru: 'Школьный админ' },
  { value: 'KollejAdmin',    label_uz: 'Kollej Admini',        label_ru: 'Колледжский админ' },
  { value: 'TashkilotAdmin', label_uz: 'Tashkilot Admini',     label_ru: 'Админ организации' },
  { value: 'KorxonaAdmin',   label_uz: 'Korxona Admini',       label_ru: 'Админ предприятия' },
  { value: 'Kadr',           label_uz: 'Kadr bo\'limi',        label_ru: 'Кадровый специалист' },
  { value: 'Buxgalter',      label_uz: 'Buxgalter',            label_ru: 'Бухгалтер' },
  { value: 'Psixolog',       label_uz: 'Psixolog',             label_ru: 'Психолог' },
]

const STATUSES = [
  { value: 'active',   label_uz: 'Faol (Active)',          label_ru: 'Активен' },
  { value: 'pending',  label_uz: 'Kutilmoqda (Pending)',   label_ru: 'Ожидает' },
  { value: 'inactive', label_uz: 'Nofaol (Inactive)',      label_ru: 'Неактивен' },
]

const LIMITED_ADMIN_DEFAULTS = [
  'dashboard',
  'devices',
  'commands',
  'staff',
  'students',
  'shifts',
  'attendance',
  'psychological_portrait',
  'reports',
  'user_approvals',
  'settings',
  'about'
]

const ALL_PERMISSION_KEYS = [
  'dashboard', 'about', 'devices', 'commands', 'staff', 'students', 'shifts',
  'attendance', 'psychological_portrait', 'reports', 'organizations', 'users',
  'user_approvals', 'settings', 'isup_server', 'redis_monitor', 'middleware_logs',
  'api_helper'
]

const PERMISSION_GROUPS = [
  {
    key: 'general',
    title_uz: 'Umumiy',
    title_ru: 'Общее',
    items: [
      { key: 'dashboard', label_uz: 'Boshqaruv paneli', label_ru: 'Панель управления', desc_uz: 'Asosiy dashboard va statistika', desc_ru: 'Главный дашборд и статистика' },
      { key: 'about', label_uz: 'Tizim haqida', label_ru: 'О системе', desc_uz: 'Platforma haqida ma\'lumotlar', desc_ru: 'Информация о платформе' },
    ]
  },
  {
    key: 'cameras',
    title_uz: 'Kameralar',
    title_ru: 'Камеры',
    items: [
      { key: 'devices', label_uz: 'Kameralar', label_ru: 'Камеры', desc_uz: 'Kameralar ro\'yxati va boshqaruvi', desc_ru: 'Список и управление камерами' },
      { key: 'commands', label_uz: 'Kamera buyruqlari', label_ru: 'Команды камеры', desc_uz: 'Kameraga yuboriladigan buyruqlar', desc_ru: 'Команды, отправляемые на камеры' },
    ]
  },
  {
    key: 'employees',
    title_uz: 'Asosiy bo\'lim',
    title_ru: 'Основной раздел',
    items: [
      { key: 'staff', label_uz: 'Hodimlar', label_ru: 'Сотрудники', desc_uz: 'Hodimlar va o\'qituvchilar kartalari', desc_ru: 'Карточки и данные сотрудников' },
      { key: 'students', label_uz: 'O\'quvchi talabalar', label_ru: 'Ученики и студенты', desc_uz: 'O\'quvchilar ro\'yxati va ma\'lumotlari', desc_ru: 'Список и данные учеников' },
      { key: 'shifts', label_uz: 'Smenalar', label_ru: 'Смены', desc_uz: 'Ish va o\'qish vaqti smenalari', desc_ru: 'Смены и рабочее время' },
      { key: 'attendance', label_uz: 'Davomat', label_ru: 'Посещаемость', desc_uz: 'Jonli va saqlangan davomat yozuvlari', desc_ru: 'Живая и сохраненная посещаемость' },
      { key: 'psychological_portrait', label_uz: 'Psixologik portret', label_ru: 'Психологический портрет', desc_uz: 'AI holat profillari va foizlari', desc_ru: 'AI-профили состояний и проценты' },
      { key: 'reports', label_uz: 'Hisobotlar', label_ru: 'Отчеты', desc_uz: 'Kechikish va faoliyat hisobotlari', desc_ru: 'Отчеты по опозданиям и активности' },
    ]
  },
  {
    key: 'management',
    title_uz: 'Boshqaruv',
    title_ru: 'Управление',
    items: [
      { key: 'organizations', label_uz: 'Tashkilotlar', label_ru: 'Организации', desc_uz: 'Tashkilotlar ro\'yxati va boshqaruvi', desc_ru: 'Список и управление организациями' },
      { key: 'users', label_uz: 'Foydalanuvchilar', label_ru: 'Пользователи', desc_uz: 'Tizim foydalanuvchilari va rollari', desc_ru: 'Системные пользователи и роли' },
      { key: 'user_approvals', label_uz: 'Tasdiqlash navbati', label_ru: 'Очередь подтверждения', desc_uz: 'Google orqali kirgan kutilayotganlar', desc_ru: 'Пользователи, ожидающие подтверждения' },
      { key: 'settings', label_uz: 'Sozlamalar', label_ru: 'Настройки', desc_uz: 'Umumiy tizim sozlamalari', desc_ru: 'Общие системные настройки' },
    ]
  },
  {
    key: 'system',
    title_uz: 'Tizim',
    title_ru: 'Система',
    items: [
      { key: 'isup_server', label_uz: 'ISUP server', label_ru: 'ISUP сервер', desc_uz: 'ISUP holati va integratsiya boshqaruvi', desc_ru: 'Состояние ISUP и управление интеграцией' },
      { key: 'redis_monitor', label_uz: 'Redis monitor', label_ru: 'Монитор Redis', desc_uz: 'Redis holati va navbatlar tahlili', desc_ru: 'Состояние Redis и очереди' },
      { key: 'middleware_logs', label_uz: 'Tizim loglari', label_ru: 'Системные логи', desc_uz: 'HTTP va middleware loglari jurnali', desc_ru: 'HTTP и middleware-логи' },
      { key: 'api_helper', label_uz: 'API helper', label_ru: 'API helper', desc_uz: 'Texnik API yordamchi sahifa', desc_ru: 'Техническая страница API helper' },
    ]
  }
]

export default function UserForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const isEdit = Boolean(id)
  const toast = useToast()

  const [permissionGroups, setPermissionGroups] = useState(PERMISSION_GROUPS)
  const [allPermissionKeys, setAllPermissionKeys] = useState(ALL_PERMISSION_KEYS)
  const [limitedAdminDefaults, setLimitedAdminDefaults] = useState(LIMITED_ADMIN_DEFAULTS)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [orgs, setOrgs] = useState([])

  // Employee import state (faqat yangi foydalanuvchi yaratishda)
  const [importId, setImportId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importedEmp, setImportedEmp] = useState(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    username: '',
    password: '',
    password_confirm: '',
    email: '',
    phone: '',
    role: 'TashkilotAdmin',
    status: 'active',
    organization_ids: [],
    branch_id: '',
    google_oauth_enabled: false,
    is_staff: true,
    google_sub: '',
    last_login_provider: '',
    image_url: '',
    menu_permissions: LIMITED_ADMIN_DEFAULTS,
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [clearImage, setClearImage] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)
  const [imgError, setImgError] = useState('')
  const fileRef = useRef(null)

  // Face detection states
  const [checkingFace, setCheckingFace] = useState(false)
  const [faceSuccess, setFaceSuccess] = useState(false)
  const [faceError, setFaceError] = useState(false)
  const [trackerReady, setTrackerReady] = useState(false)
  const [faceSelectionData, setFaceSelectionData] = useState(null)
  const [showFaceSelector, setShowFaceSelector] = useState(false)

  // Username availability
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, message: '' })
  const usernameCheckRef = useRef(0)

  // Password reveals
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)

  // Email domain suggestions
  const [emailSuggestions, setEmailSuggestions] = useState([])
  const [showEmailSugg, setShowEmailSugg] = useState(false)
  const emailRef = useRef(null)

  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)

  useEffect(() => {
    let active = true
    const orgId = form.organization_ids[0]
    if (form.organization_ids.length === 1 && orgId) {
      setLoadingBranches(true)
      fetch(`/api/organizations/${orgId}/branches`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (active) {
            setBranches(Array.isArray(data) ? data : [])
            setLoadingBranches(false)
          }
        })
        .catch(err => {
          console.error('Error fetching branches:', err)
          if (active) setLoadingBranches(false)
        })
    } else {
      setBranches([])
      setForm(prev => ({ ...prev, branch_id: '' }))
    }
    return () => { active = false }
  }, [form.organization_ids])

  // Load schema + orgs + (in edit mode) user data
  useEffect(() => {
    let alive = true
    ;(async () => {
      let currentAllKeys = ALL_PERMISSION_KEYS
      let currentLimitedDefaults = LIMITED_ADMIN_DEFAULTS

      try {
        const schemaRes = await fetch('/api/users/permissions-schema', { credentials: 'include' })
        if (schemaRes.ok && alive) {
          const data = await schemaRes.json()
          
          const groups = [
            { key: 'general', title_uz: 'Umumiy', title_ru: 'Общее', items: [] },
            { key: 'cameras', title_uz: 'Kameralar', title_ru: 'Камеры', items: [] },
            { key: 'employees', title_uz: 'Asosiy bo\'lim', title_ru: 'Основной раздел', items: [] },
            { key: 'management', title_uz: 'Boshqaruv', title_ru: 'Управление', items: [] },
            { key: 'system', title_uz: 'Tizim', title_ru: 'Система', items: [] },
          ]
          
          data.metadata.forEach(item => {
            const groupObj = groups.find(g => g.key === item.group)
            if (groupObj) {
              groupObj.items.push({
                key: item.key,
                label_uz: item.titles.uz,
                label_ru: item.titles.ru,
                desc_uz: item.descriptions.uz,
                desc_ru: item.descriptions.ru,
              })
            }
          })
          
          const filteredGroups = groups.filter(g => g.items.length > 0)
          const allKeys = data.metadata.map(m => m.key)
          
          currentAllKeys = allKeys
          currentLimitedDefaults = data.limited_admin_defaults

          setPermissionGroups(filteredGroups)
          setAllPermissionKeys(allKeys)
          setLimitedAdminDefaults(data.limited_admin_defaults)

          if (!isEdit) {
            setForm(prev => ({
              ...prev,
              menu_permissions: data.limited_admin_defaults
            }))
          }
        }
      } catch (err) {
        console.error('Error fetching permissions schema:', err)
      }

      try {
        const orgRes = await fetch('/api/organizations', { credentials: 'include' })
        if (orgRes.ok) {
          const data = await orgRes.json()
          if (alive) setOrgs(Array.isArray(data) ? data : (data?.items || []))
        }
        if (isEdit) {
          // /api/users qaytaradi to'liq ro'yxatni — ichidan keraklisini tanlaymiz
          const uRes = await fetch('/api/users', { credentials: 'include' })
          if (uRes.ok) {
            const list = await uRes.json()
            const u = (Array.isArray(list) ? list : []).find(x => String(x.id) === String(id))
            if (u && alive) {
              const uRole = ROLES.find(r => r.label_uz.includes(u.role) || r.value.toLowerCase() === String(u.role || '').toLowerCase())?.value
                || u.role
                || 'TashkilotAdmin';
              
              let parsedPerms = [];
              if (u.menu_permissions) {
                try {
                  const parsed = JSON.parse(u.menu_permissions);
                  parsedPerms = Array.isArray(parsed) ? parsed : [];
                } catch {
                  parsedPerms = u.menu_permissions.split(',').map(x => x.trim()).filter(Boolean);
                }
              }
              if (parsedPerms.length === 0) {
                parsedPerms = uRole === 'SuperAdmin' ? currentAllKeys : currentLimitedDefaults;
              }

              setForm(prev => ({
                ...prev,
                first_name: u.first_name || '',
                last_name: u.last_name || '',
                middle_name: u.middle_name || '',
                username: u.name || '',
                email: u.email || '',
                phone: u.phone || '',
                role: uRole,
                status: u.status || 'active',
                organization_ids: (u.organization_ids || []).map(String),
                branch_id: u.branch_id ? String(u.branch_id) : '',
                google_oauth_enabled: !!u.google_oauth_enabled,
                is_staff: u.is_staff !== undefined ? !!u.is_staff : true,
                google_sub: u.google_sub || '',
                last_login_provider: u.last_login_provider || '',
                image_url: u.image_url || '',
                menu_permissions: parsedPerms,
              }))
              const imgUrl = u.image_url || ''
              const isValidImg = imgUrl.startsWith('/static/') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://')
              setImagePreview(isValidImg ? imgUrl : '')
            } else if (alive) {
              setError(isRu ? 'Пользователь не найден' : 'Foydalanuvchi topilmadi')
            }
          }
        }
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, isEdit, isRu])

  // Username live check
  useEffect(() => {
    const u = form.username
    if (!u) {
      setUsernameStatus({ checking: false, available: null, message: '' })
      return
    }
    const regex = /^[a-zA-Z0-9]+$/
    if (!regex.test(u)) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: isRu 
          ? 'Только латинские буквы и цифры, без пробелов' 
          : "Faqat lotin harflari va raqamlar bo'lishi kerak, bo'shliqlarsiz"
      })
      return
    }
    if (u.length < 3) {
      setUsernameStatus({ checking: false, available: false, message: isRu ? 'Минимум 3 символа' : "Kamida 3 ta belgi" })
      return
    }
    const ticket = ++usernameCheckRef.current
    setUsernameStatus(prev => ({ ...prev, checking: true }))
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ username: u })
        if (isEdit && id) params.set('exclude_user_id', String(id))
        const res = await fetch(`/api/users/username/check?${params}`, { credentials: 'include' })
        const data = res.ok ? await res.json() : { available: false, message: `HTTP ${res.status}` }
        if (ticket === usernameCheckRef.current) {
          setUsernameStatus({ checking: false, available: !!data.available, message: data.message || '' })
        }
      } catch (e) {
        if (ticket === usernameCheckRef.current) {
          setUsernameStatus({ checking: false, available: null, message: e.message })
        }
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [form.username, isEdit, id, isRu])

  const setField = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(prev => ({ ...prev, [k]: v }))
  }

  // Translit: o'zbek/kirill harflarini lotin username ga aylantirish
  const toLatinUsername = (name) => {
    const map = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j',
      'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
      'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts',
      'ч':'ch','ш':'sh','щ':'sh','ъ':'','ы':'i','ь':'','э':'e','ю':'yu','я':'ya',
      'ʻ':'','ʼ':'',"'": '',"'": '',
      'ğ':'g','ş':'sh','ç':'ch','ı':'i','ö':'o','ü':'u','ñ':'n',
    }
    return name.toLowerCase()
      .split('')
      .map(c => map[c] ?? (/[a-z0-9]/.test(c) ? c : ''))
      .join('')
      .replace(/[^a-z0-9]/g, '')
  }

  // Hodim shaxsiy ID bo'yicha ma'lumotlarni import qilish
  const handleImportFromEmployee = async () => {
    const pid = importId.trim()
    if (!pid) {
      toast.error(isRu ? 'Введите ID сотрудника' : "Xodim ID'sini kiriting")
      return
    }
    setImporting(true)
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(pid)}&page_size=5`, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const items = Array.isArray(data) ? data : (data?.items || [])
      // personal_id ga to'liq mos keluvchisini topamiz
      const emp = items.find(e => String(e.personal_id) === String(pid)) || items[0]
      if (!emp) {
        toast.error(isRu ? 'Сотрудник не найден' : "Xodim topilmadi")
        return
      }

      const firstName = emp.first_name || ''
      const lastName  = emp.last_name  || ''
      const middleName = emp.middle_name || ''

      // Username: ismidan lotin username generatsiya
      const baseUsername = toLatinUsername(firstName + (lastName ? lastName : ''))
      const username = baseUsername || `user${pid}`

      // Tashkilot
      const orgId = emp.organization_id ? String(emp.organization_id) : ''
      const orgIds = orgId ? [orgId] : []

      // Email: firstname.lastname@bioface.uz
      const emailFirst = toLatinUsername(firstName)
      const emailLast  = toLatinUsername(lastName)
      const autoEmail  = emp.email ||
        (emailFirst && emailLast
          ? `${emailFirst}.${emailLast}@bioface.uz`
          : emailFirst
            ? `${emailFirst}@bioface.uz`
            : '')

      setForm(prev => ({
        ...prev,
        first_name:       firstName,
        last_name:        lastName,
        middle_name:      middleName,
        username:         username,
        password:         'bioface2026',
        password_confirm: 'bioface2026',
        phone:            emp.phone || prev.phone,
        email:            autoEmail || prev.email,
        organization_ids: orgIds.length ? orgIds : prev.organization_ids,
        image_url:        emp.image_url || prev.image_url,
      }))

      // Avatar preview
      if (emp.image_url) {
        const isValid = emp.image_url.startsWith('/static/') || emp.image_url.startsWith('http')
        if (isValid) setImagePreview(emp.image_url)
      }

      setImportedEmp(emp)
      toast.success(
        isRu
          ? `Ma'lumotlar yuklandi: ${firstName} ${lastName}`
          : `Ma'lumotlar yuklandi: ${firstName} ${lastName}`
      )
    } catch (e) {
      toast.error(e.message)
    } finally {
      setImporting(false)
    }
  }

  const onRoleChange = (e) => {
    const nextRole = e.target.value
    setForm(prev => {
      const isSuper = nextRole === 'SuperAdmin'
      return {
        ...prev,
        role: nextRole,
        menu_permissions: isSuper ? allPermissionKeys : limitedAdminDefaults
      }
    })
  }

  const toggleOrg = (orgId) => {
    setForm(prev => {
      const sid = String(orgId)
      const has = prev.organization_ids.includes(sid)
      return { ...prev, organization_ids: has ? prev.organization_ids.filter(x => x !== sid) : [...prev.organization_ids, sid] }
    })
  }

  // Load tracking.js face detector dynamically
  useEffect(() => {
    if (window.tracking && window.tracking.ObjectTracker) {
      setTrackerReady(true)
      return
    }
    const s1 = document.createElement('script')
    s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/tracking.js/1.1.3/tracking-min.js'
    s1.async = true
    s1.onload = () => {
      const s2 = document.createElement('script')
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/tracking.js/1.1.3/data/face-min.js'
      s2.async = true
      s2.onload = () => setTrackerReady(true)
      s2.onerror = () => setTrackerReady(true)
      document.body.appendChild(s2)
    }
    s1.onerror = () => setTrackerReady(true)
    document.body.appendChild(s1)
  }, [])

  const validateFace = (file) => {
    return new Promise((resolve) => {
      let resolved = false
      const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val) } }
      const timeoutId = setTimeout(() => safeResolve({ ok: true, error: 'timeout' }), 4000)

      if (!trackerReady || !window.tracking || !window.tracking.ObjectTracker) {
        clearTimeout(timeoutId)
        safeResolve({ ok: true, message: 'Tracker not ready' })
        return
      }
      try {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const maxDim = 600
            let w = img.width, h = img.height
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
              else { w = Math.round(w * maxDim / h); h = maxDim }
            }
            canvas.width = w; canvas.height = h
            ctx.drawImage(img, 0, 0, w, h)

            if (!window.tracking.ViolaJones?.classifiers?.face) {
              clearTimeout(timeoutId)
              safeResolve({ ok: true, message: 'Classifier not registered' })
              return
            }
            const tracker = new window.tracking.ObjectTracker('face')
            tracker.setInitialScale(4)
            tracker.setStepSize(2)
            tracker.setEdgesDensity(0.1)
            let trackerTask
            const onTrack = (event) => {
              try { tracker.removeListener('track', onTrack); if (trackerTask) trackerTask.stop() } catch (e) {}
              clearTimeout(timeoutId)
              if (event.data && event.data.length > 0) {
                if (event.data.length > 1) {
                  safeResolve({ ok: true, multiple: true, faces: event.data, img, w, h })
                  return
                }
                const maxFace = event.data[0]
                const scaleX = img.width / w, scaleY = img.height / h
                const fx = maxFace.x * scaleX, fy = maxFace.y * scaleY
                const fw = maxFace.width * scaleX, fh = maxFace.height * scaleY
                let cropW = fw * 2.2, cropH = cropW * 1.333
                let cropX = fx - (cropW - fw) / 2, cropY = fy - fh * 0.5
                if (cropX < 0) cropX = 0
                if (cropY < 0) cropY = 0
                if (cropX + cropW > img.width) { cropW = img.width - cropX; cropH = cropW * 1.333 }
                if (cropY + cropH > img.height) { cropH = img.height - cropY; cropW = cropH / 1.333; cropX = fx - (cropW - fw) / 2; if (cropX < 0) cropX = 0 }
                const cc = document.createElement('canvas')
                cc.width = 450; cc.height = 600
                const cctx = cc.getContext('2d')
                cctx.fillStyle = '#fff'; cctx.fillRect(0, 0, 450, 600)
                cctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 450, 600)
                cc.toBlob((blob) => {
                  URL.revokeObjectURL(img.src)
                  if (blob) {
                    const croppedFile = new File([blob], file.name || 'avatar.jpg', { type: 'image/jpeg', lastModified: Date.now() })
                    safeResolve({ ok: true, faces: event.data, croppedFile, previewUrl: URL.createObjectURL(croppedFile) })
                  } else safeResolve({ ok: true, faces: event.data })
                }, 'image/jpeg', 0.92)
              } else {
                URL.revokeObjectURL(img.src)
                safeResolve({ ok: false, error: 'no_face_detected' })
              }
            }
            tracker.on('track', onTrack)
            trackerTask = window.tracking.track(canvas, tracker)
          } catch (e) {
            clearTimeout(timeoutId)
            safeResolve({ ok: true, error: 'exception_inner' })
          }
        }
        img.onerror = () => { clearTimeout(timeoutId); safeResolve({ ok: false, error: 'invalid_image' }) }
        img.src = URL.createObjectURL(file)
      } catch (e) {
        clearTimeout(timeoutId)
        safeResolve({ ok: true, error: 'exception_outer' })
      }
    })
  }

  const cropSelectedFace = (face, img, w, h, file) => {
    const scaleX = img.width / w, scaleY = img.height / h
    const fx = face.x * scaleX, fy = face.y * scaleY
    const fw = face.width * scaleX, fh = face.height * scaleY
    let cropW = fw * 2.2, cropH = cropW * 1.333
    let cropX = fx - (cropW - fw) / 2, cropY = fy - fh * 0.5
    if (cropX < 0) cropX = 0
    if (cropY < 0) cropY = 0
    if (cropX + cropW > img.width) { cropW = img.width - cropX; cropH = cropW * 1.333 }
    if (cropY + cropH > img.height) { cropH = img.height - cropY; cropW = cropH / 1.333; cropX = fx - (cropW - fw) / 2; if (cropX < 0) cropX = 0 }
    const cc = document.createElement('canvas')
    cc.width = 450; cc.height = 600
    const cctx = cc.getContext('2d')
    cctx.fillStyle = '#fff'; cctx.fillRect(0, 0, 450, 600)
    cctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 450, 600)
    cc.toBlob((blob) => {
      URL.revokeObjectURL(img.src)
      if (blob) {
        const croppedFile = new File([blob], file.name || 'avatar.jpg', { type: 'image/jpeg', lastModified: Date.now() })
        setImageFile(croppedFile)
        setImagePreview(URL.createObjectURL(croppedFile))
        setFaceSuccess(true)
        setImgError('')
        toast.success(isRu ? 'Лицо успешно выбрано и обрезано!' : 'Yuz muvaffaqiyatli tanlandi va kesib olindi!')
        setTimeout(() => setFaceSuccess(false), 2000)
      } else toast.error('Crop failed')
    }, 'image/jpeg', 0.92)
  }

  const handleCancelFaceSelection = () => {
    if (faceSelectionData?.img) URL.revokeObjectURL(faceSelectionData.img.src)
    setFaceSelectionData(null)
    setShowFaceSelector(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleImageFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImgError(isRu ? 'Faqat rasm fayllari qabul qilinadi' : 'Faqat rasm fayllari qabul qilinadi')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImgError(isRu ? 'Rasm hajmi 5 MB dan oshmasin' : 'Rasm hajmi 5 MB dan oshmasin')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setImgError('')
    setCheckingFace(true)
    setFaceSuccess(false)
    setFaceError(false)
    const result = await validateFace(file)
    setCheckingFace(false)
    if (result.ok) {
      if (result.multiple) {
        setFaceSelectionData({ faces: result.faces, img: result.img, w: result.w, h: result.h, file })
        setShowFaceSelector(true)
      } else {
        const finalFile = result.croppedFile || file
        const finalPreview = result.previewUrl || URL.createObjectURL(file)
        setImageFile(finalFile)
        setImagePreview(finalPreview)
        setFaceSuccess(true)
        toast.success(isRu ? 'Юз муваффақиятли аниқланди ва кесиб олинди!' : 'Inson yuzi muvaffaqiyatli aniqlandi va kesib olindi!')
        setTimeout(() => setFaceSuccess(false), 2000)
      }
    } else {
      setFaceError(true)
      if (result.error === 'no_face_detected') {
        toast.error(isRu
          ? 'Лицо не обнаружено или фото нечеткое. Используйте качественное портретное фото.'
          : 'Rasmda yuz aniqlanmadi yoki rasm sifatsiz. Sifatli portret rasm yuklang.')
      } else {
        toast.error(isRu ? 'Не удалось загрузить изображение.' : "Tasvirni yuklab bo'lmadi.")
      }
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => setFaceError(false), 2000)
    }
  }

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleImageFile(file)
    }
  }

  // Paste image handler from clipboard
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return

      let hasImage = false
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            hasImage = true
            await handleImageFile(file)
            break
          }
        }
      }

      if (!hasImage) {
        // Check for pasted text URL or base64 data
        const text = e.clipboardData?.getData('text')
        if (text) {
          const trimmed = text.trim()
          if (trimmed.startsWith('data:image/')) {
            e.preventDefault()
            try {
              const res = await fetch(trimmed)
              const blob = await res.blob()
              const file = new File([blob], 'pasted_image.jpg', { type: blob.type })
              await handleImageFile(file)
            } catch {
              // silent
            }
          } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            e.preventDefault()
            try {
              const res = await fetch(trimmed, { referrerPolicy: 'no-referrer' })
              if (!res.ok) throw new Error('Fetch failed')
              const blob = await res.blob()
              if (!blob.type.startsWith('image/')) {
                toast.error(isRu ? 'URL не является изображением' : 'URL rasm manzili emas')
                return
              }
              const file = new File([blob], 'pasted_image.jpg', { type: blob.type })
              await handleImageFile(file)
            } catch (err) {
              toast.error(isRu 
                ? 'Не удалось загрузить изображение по ссылке из-за ограничений безопасности (CORS). Пожалуйста, скопируйте саму картинку или скачайте её.' 
                : 'CORS xavfsizlik cheklovlari sababli rasmni havola orqali yuklab bo\'lmadi. Iltimos, rasmni o\'zini nusxalab (copy) oling yoki yuklab oling.'
              )
            }
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isRu, validateFace])

  const onClearImage = () => {
    setImageFile(null)
    setImagePreview('')
    setImgError('')
    setFaceSuccess(false)
    setFaceError(false)
    setForm(prev => ({ ...prev, image_url: '' }))
    if (isEdit) setClearImage(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Phone mask handler
  const onPhoneChange = (e) => {
    const masked = applyPhoneMask(e.target.value)
    setForm(prev => ({ ...prev, phone: masked }))
  }

  // Email suggestions
  const onEmailChange = (e) => {
    const val = e.target.value
    setForm(prev => ({ ...prev, email: val }))
    const atIdx = val.indexOf('@')
    if (atIdx !== -1) {
      const after = val.slice(atIdx + 1).toLowerCase()
      const prefix = val.slice(0, atIdx + 1)
      const filtered = EMAIL_DOMAINS
        .filter(d => d.startsWith(after))
        .map(d => prefix + d)
      setEmailSuggestions(filtered)
      setShowEmailSugg(filtered.length > 0)
    } else {
      setEmailSuggestions([])
      setShowEmailSugg(false)
    }
  }
  const validate = () => {
    if (!form.first_name.trim()) return isRu ? 'Имя обязательно' : 'Ism majburiy'
    if (!form.username.trim()) return 'Username majburiy'
    if (usernameStatus.available === false) return usernameStatus.message || (isRu ? 'Username недоступен' : "Username band")
    if (!form.email.trim()) return 'Email majburiy'
    if (!isEdit && !form.password.trim()) return isRu ? 'Пароль обязателен' : 'Parol majburiy'
    if (form.password.trim() && form.password !== form.password_confirm) {
      return isRu ? 'Пароли не совпадают' : 'Parollar mos kelmaydi'
    }
    return ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); return }
    setError('')
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('first_name', form.first_name.trim())
      fd.set('last_name', form.last_name.trim())
      fd.set('middle_name', form.middle_name.trim())
      fd.set('username', form.username.trim())
      fd.set('email', form.email.trim())
      fd.set('phone', form.phone.trim())
      if (form.password.trim()) fd.set('password', form.password.trim())
      fd.set('role', form.role)
      fd.set('status', form.status)
      fd.set('google_oauth_enabled', form.google_oauth_enabled ? '1' : '0')
      fd.set('is_staff', form.is_staff ? '1' : '0')
      fd.set('menu_permissions', JSON.stringify(form.menu_permissions))
      const orgIds = form.organization_ids.map(Number).filter(Boolean)
      if (orgIds.length) {
        fd.set('organization_ids', orgIds.join(','))
        fd.set('organization_id', String(orgIds[0]))
      } else {
        fd.set('organization_ids', '')
      }
      if (orgIds.length === 1 && form.branch_id) {
        fd.set('branch_id', String(form.branch_id))
      } else {
        fd.set('branch_id', '')
      }
      if (imageFile) {
        fd.set('image', imageFile)
      } else if (form.image_url.trim() && (form.image_url.trim().startsWith('http://') || form.image_url.trim().startsWith('https://') || form.image_url.trim().startsWith('/static/'))) {
        fd.set('image_url', form.image_url.trim())
      }
      if (isEdit && clearImage && !imageFile) fd.set('clear_image', '1')

      const url = isEdit ? `/api/users/${id}` : '/api/users'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, { method, credentials: 'include', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data?.detail || data?.message || `HTTP ${res.status}`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      toast.success(isEdit
        ? (isRu ? 'Пользователь обновлён' : 'Foydalanuvchi yangilandi')
        : (isRu ? 'Пользователь создан' : 'Foydalanuvchi yaratildi'))
      navigate('/users')
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero
          badge="✦"
          title={isEdit ? (isRu ? 'Редактировать пользователя' : 'Foydalanuvchini tahrirlash') : (isRu ? 'Новый пользователь' : 'Yangi foydalanuvchi')}
          backPath="/users"
        />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
          <div style={cardStyle}>
            <Skeleton width={140} height={14} />
            <div style={{ marginTop: 14 }}><Skeleton.Stats count={6} /></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .usr-form-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        .usr-form-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px;
        }
        .usr-grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .usr-grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        @media (max-width: 900px) {
          .usr-form-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 600px) {
          .usr-form-container {
            padding: 16px 16px 60px !important;
          }
          .usr-grid-2, .usr-grid-3 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <PageHero
        badge={isEdit ? (isRu ? '✦ Редактирование' : '✦ Tahrirlash') : (isRu ? '✦ Новый пользователь' : '✦ Yangi foydalanuvchi')}
        title={isEdit ? (isRu ? 'Редактировать пользователя' : 'Foydalanuvchini tahrirlash') : (isRu ? 'Новый пользователь' : 'Yangi foydalanuvchi')}
        sub={isRu
          ? 'Заполните данные системного пользователя'
          : "Tizim foydalanuvchisi ma'lumotlarini to'ldiring"}
        backPath="/users"
        right={
          <button
            type="button"
            onClick={() => navigate('/users')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowLeftRegular fontSize={16} />
            {isRu ? 'К списку' : "Ro'yxatga"}
          </button>
        }
      />

      <form onSubmit={onSubmit} className="usr-form-container">
        {error && (
          <div style={errBannerStyle}>{error}</div>
        )}

        <div className="usr-form-layout">
          {/* MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 0. Hodimdan import (faqat yangi foydalanuvchi yaratishda) */}
            {!isEdit && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PersonRegular fontSize={18} style={{ color: '#6366f1' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                      {isRu ? 'Импортировать из базы сотрудников' : "Xodimlar bazasidan import qilish"}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                      {isRu
                        ? 'Введите Личный ID сотрудника — форма заполнится автоматически'
                        : "Xodimning Shaxsiy ID'sini kiriting — forma avtomatik to'ldiriladi"}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>
                      {isRu ? 'Личный ID сотрудника' : "Xodim Shaxsiy ID'si"}
                    </label>
                    <input
                      type="text"
                      value={importId}
                      onChange={e => setImportId(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleImportFromEmployee())}
                      placeholder={isRu ? 'Напр. 7971488' : 'Mas. 7971488'}
                      style={{ ...inpStyle, fontFamily: 'monospace', letterSpacing: 1 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleImportFromEmployee}
                    disabled={importing || !importId.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: importing || !importId.trim() ? 'rgba(99,102,241,0.4)' : '#6366f1',
                      border: 'none', color: '#fff', cursor: importing || !importId.trim() ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s', flexShrink: 0,
                    }}
                  >
                    {importing
                      ? <ArrowSyncRegular fontSize={15} style={{ animation: 'spin 1s linear infinite' }} />
                      : <CheckmarkRegular fontSize={15} />}
                    {importing ? (isRu ? 'Загрузка...' : 'Yuklanmoqda...') : (isRu ? 'Импортировать' : 'Import qilish')}
                  </button>
                </div>

                {/* Yuklangan hodim preview */}
                {importedEmp && (
                  <div style={{
                    marginTop: 14, padding: '10px 14px', borderRadius: 9,
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    {importedEmp.image_url && (
                      <img
                        src={importedEmp.image_url}
                        alt=""
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(16,185,129,0.3)', flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                        {importedEmp.full_name || `${importedEmp.first_name} ${importedEmp.last_name}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {importedEmp.personal_id && <span>ID: {importedEmp.personal_id}</span>}
                        {importedEmp.department && <span>{importedEmp.department}</span>}
                        {importedEmp.position && <span>{importedEmp.position}</span>}
                        {importedEmp.organization_name && <span>{importedEmp.organization_name}</span>}
                      </div>
                    </div>
                    <CheckmarkCircleRegular fontSize={20} style={{ color: '#10b981', flexShrink: 0 }} />
                  </div>
                )}
              </div>
            )}

            {/* 1. Shaxsiy ma'lumotlar */}
            <Section
              kicker={isRu ? 'Личные данные' : "Shaxsiy ma'lumotlar"}
              title={isRu ? 'Имя пользователя' : "Foydalanuvchi ma'lumotlari"}
            >
              <div className="usr-grid-3">
                <Field label={isRu ? 'Имя' : 'Ism'} required>
                  <input value={form.first_name} onChange={setField('first_name')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Фамилия' : 'Familiya'}>
                  <input value={form.last_name} onChange={setField('last_name')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Отчество' : 'Otasining ismi'}>
                  <input value={form.middle_name} onChange={setField('middle_name')} style={inpStyle} />
                </Field>
              </div>
            </Section>

            {/* 2. Kirish ma'lumotlari */}
            <Section
              kicker={isRu ? 'Учётные данные' : "Kirish ma'lumotlari"}
              title={isRu ? 'Логин, пароль' : 'Login, parol'}
            >
              <div className="usr-grid-3">
                <Field label="Username" required hint={
                  usernameStatus.message ||
                  (isRu ? 'Должно быть уникальным в системе' : "Tizimda yagona bo'lishi kerak")
                } hintTone={usernameStatus.checking ? 'muted' : (usernameStatus.available === true ? 'ok' : usernameStatus.available === false ? 'err' : 'muted')}>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={form.username}
                      onChange={(e) => {
                        // Strip anything that is not a Latin letter or digit
                        const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, '')
                        setForm(prev => ({ ...prev, username: cleaned }))
                      }}
                      style={{ ...inpStyle, paddingRight: 36 }}
                      placeholder="username"
                      autoComplete="username"
                      spellCheck={false}
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                      {usernameStatus.checking
                        ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                        : usernameStatus.available === true
                          ? <CheckmarkCircleRegular fontSize={16} style={{ color: '#10b981' }} />
                          : usernameStatus.available === false
                            ? <WarningRegular fontSize={14} style={{ color: '#f43f5e' }} />
                            : null}
                    </span>
                  </div>
                </Field>

                <Field
                  label={isRu ? 'Пароль' : 'Parol'}
                  required={!isEdit}
                  hint={isEdit
                    ? (isRu ? 'Оставьте пустым, чтобы не менять' : "O'zgartirmaslik uchun bo'sh qoldiring")
                    : (isRu ? 'Минимум 8 символов, 1 буква и 1 цифра' : "Kamida 8 ta belgi, 1 harf va 1 raqam")}
                >
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={form.password}
                      onChange={setField('password')}
                      style={{ ...inpStyle, paddingRight: 36 }}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPwd(s => !s)} style={eyeBtn} aria-label="toggle">
                      {showPwd ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
                    </button>
                  </div>
                </Field>

                <Field
                  label={isRu ? 'Подтверждение пароля' : 'Parol tasdiqlash'}
                  required={!isEdit}
                  hint={isRu ? 'Должен совпадать с паролем' : "Parol bilan bir xil bo'lishi kerak"}
                  hintTone={form.password_confirm && form.password === form.password_confirm ? 'ok' : (form.password_confirm ? 'err' : 'muted')}
                >
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPwd2 ? 'text' : 'password'}
                      value={form.password_confirm}
                      onChange={setField('password_confirm')}
                      style={{ ...inpStyle, paddingRight: 36 }}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPwd2(s => !s)} style={eyeBtn} aria-label="toggle">
                      {showPwd2 ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
                    </button>
                  </div>
                </Field>
              </div>
            </Section>

            {/* 3. Kontakt va rol */}
            <Section
              kicker={isRu ? 'Контакты и роль' : 'Kontakt va rol'}
              title={isRu ? 'Email, роль, статус' : 'Email, rol, status'}
            >
              <div className="usr-grid-2">
                <Field label="Email" required>
                  <div style={{ position: 'relative' }} ref={emailRef}>
                    <input
                      type="text"
                      inputMode="email"
                      value={form.email}
                      onChange={onEmailChange}
                      onFocus={() => {
                        if (emailSuggestions.length > 0) setShowEmailSugg(true)
                      }}
                      onBlur={() => setTimeout(() => setShowEmailSugg(false), 150)}
                      style={inpStyle}
                      placeholder="user@example.com"
                      autoComplete="email"
                      spellCheck={false}
                    />
                    {showEmailSugg && emailSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        background: 'var(--surface)', border: '1px solid var(--border-2)',
                        borderRadius: 8, marginTop: 4, overflow: 'hidden',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      }}>
                        {emailSuggestions.map(s => (
                          <div
                            key={s}
                            onMouseDown={() => {
                              setForm(prev => ({ ...prev, email: s }))
                              setShowEmailSugg(false)
                              setEmailSuggestions([])
                            }}
                            style={{
                              padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                              color: 'var(--text-1)', borderBottom: '1px solid var(--border)',
                              display: 'flex', alignItems: 'center', gap: 8,
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ color: 'var(--text-4)', fontSize: 12 }}>@</span>
                            <span>{s.split('@')[1]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <Field
                  label={isRu ? 'Телефон' : 'Telefon'}
                  hint="+998 XX XXX XX XX"
                >
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={onPhoneChange}
                    onFocus={(e) => {
                      if (!e.target.value) setForm(prev => ({ ...prev, phone: '+998 ' }))
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '+998 ') setForm(prev => ({ ...prev, phone: '' }))
                    }}
                    style={inpStyle}
                    placeholder="+998 90 123 45 67"
                    maxLength={17}
                  />
                </Field>
                <Field label={isRu ? 'Роль' : 'Huquqi'} required>
                  <CustomSelect
                    value={form.role}
                    onChange={(val) => onRoleChange({ target: { value: val } })}
                    options={ROLES.map(r => ({ value: r.value, label: isRu ? r.label_ru : r.label_uz }))}
                    placeholder={isRu ? '— Rol tanlang —' : '— Rol tanlang —'}
                  />
                </Field>
                <Field label="Status" required>
                  <CustomSelect
                    value={form.status}
                    onChange={(val) => setForm(prev => ({ ...prev, status: val }))}
                    options={STATUSES.map(s => ({ value: s.value, label: isRu ? s.label_ru : s.label_uz }))}
                    placeholder={isRu ? '— Status —' : '— Status —'}
                  />
                </Field>
              </div>
            </Section>

            {/* 4. Tashkilot */}
            <Section
              kicker={isRu ? 'Организация' : 'Tashkilot'}
              title={isRu ? 'Доступ к организациям' : 'Tashkilotlarga ruxsat'}
              hint={isRu ? 'Можно выбрать несколько организаций' : "Bir nechta tashkilot tanlanishi mumkin"}
            >
              {orgs.length === 0 ? (
                <div style={{ color: 'var(--text-4)', fontSize: 13 }}>
                  {isRu ? 'Сначала создайте организацию' : "Avval tashkilot yarating"}
                </div>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 8, maxHeight: 260, overflowY: 'auto',
                  padding: 8, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  {orgs.map(o => {
                    const checked = form.organization_ids.includes(String(o.id))
                    return (
                      <label key={o.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 7,
                        background: checked ? 'var(--accent-bg)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--accent-bd)' : 'var(--border-2)'}`,
                        cursor: 'pointer', fontSize: 13,
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleOrg(o.id)} style={{ accentColor: 'var(--accent)' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </Section>

            {form.organization_ids.length === 1 && (
              <Section
                kicker={isRu ? 'Филиал' : 'Filial'}
                title={isRu ? 'Доступ к конкретному филиалу' : 'Muayyan filialga ruxsat'}
                hint={isRu ? 'Если выбрано, доступ пользователя будет ограничен этим филиалом' : 'Agar tanlansa, foydalanuvchi ruxsati faqat shu filial bilan cheklanadi'}
              >
                {loadingBranches ? (
                  <Skeleton width="100%" height={38} />
                ) : branches.length === 0 ? (
                  <div style={{ color: 'var(--text-4)', fontSize: 13 }}>
                    {isRu ? 'У этой организации нет филиалов' : "Ushbu tashkilotda filiallar mavjud emas"}
                  </div>
                ) : (
                  <CustomSelect
                    value={form.branch_id}
                    onChange={(val) => setForm(prev => ({ ...prev, branch_id: val }))}
                    options={[
                      { value: '', label: isRu ? 'Все филиалы (Организация целиком)' : 'Barcha filiallar (Tashkilot darajasida)' },
                      ...branches.map(b => ({ value: String(b.id), label: b.name }))
                    ]}
                    placeholder={isRu ? '— Filial tanlang —' : '— Filial tanlang —'}
                  />
                )}
              </Section>
            )}



          </div>

          {/* SIDE COLUMN — Avatar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Section
              kicker="Avatar"
              title={isRu ? 'Фотография' : 'Rasm'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <style>{`
                  @keyframes avatarScanUsr {
                    0% { transform: translateY(-70px); opacity: 0.3; }
                    50% { transform: translateY(70px); opacity: 1; }
                    100% { transform: translateY(-70px); opacity: 0.3; }
                  }
                  @keyframes avatarShakeUsr {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-8px); }
                    40%, 80% { transform: translateX(8px); }
                  }
                  @keyframes borderRotateUsr {
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes pulseGreenUsr {
                    0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
                    100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
                  }
                  @keyframes pulseRedUsr {
                    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
                    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
                  }
                  .dashed-ring-usr {
                    position: absolute;
                    inset: -8px;
                    border: 1.5px dashed var(--border-3);
                    border-radius: 50%;
                    animation: borderRotateUsr 24s linear infinite;
                    opacity: 0.7;
                    pointer-events: none;
                    transition: all 0.3s;
                  }
                  .dashed-ring-usr.checking {
                    animation: borderRotateUsr 4s linear infinite;
                    border-color: var(--accent);
                    opacity: 1;
                  }
                  .dashed-ring-usr.success {
                    border-color: #10b981;
                    animation: borderRotateUsr 30s linear infinite;
                    opacity: 0.9;
                  }
                  .dashed-ring-usr.error {
                    border-color: #ef4444;
                    animation: none;
                    opacity: 0.9;
                  }
                `}</style>

                {/* Avatar circle */}
                <div
                  onClick={() => !checkingFace && fileRef.current?.click()}
                  onMouseEnter={() => setAvatarHovered(true)}
                  onMouseLeave={() => setAvatarHovered(false)}
                  style={{
                    width: 150, height: 150, borderRadius: '50%',
                    background: 'var(--surface-2)',
                    border: `2px solid ${faceSuccess ? '#10b981' : (faceError ? '#ef4444' : (checkingFace ? 'var(--accent)' : (imagePreview ? 'var(--accent)' : 'var(--border-3)')))}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'visible', flexShrink: 0, position: 'relative',
                    cursor: checkingFace ? 'wait' : 'pointer',
                    boxShadow: faceSuccess ? '0 0 18px rgba(16,185,129,0.5)' : (faceError ? '0 0 18px rgba(239,68,68,0.5)' : (checkingFace ? '0 0 18px rgba(0,120,212,0.4)' : 'none')),
                    animation: faceSuccess ? 'pulseGreenUsr 2s infinite' : (faceError ? 'avatarShakeUsr 0.4s ease, pulseRedUsr 2s infinite' : 'none'),
                    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  {/* Dashed rotating ring */}
                  <div className={`dashed-ring-usr ${checkingFace ? 'checking' : (faceSuccess ? 'success' : (faceError ? 'error' : ''))}`} />

                  {/* Inner circle */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--surface-1)'
                  }}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImagePreview('')} />
                    ) : (
                      <PersonRegular fontSize={52} style={{ color: 'var(--text-4)', opacity: 0.4 }} />
                    )}

                    {/* Face scanning loader overlay */}
                    {checkingFace && (
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(10,15,28,0.82)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 600, gap: 8, zIndex: 10,
                        backdropFilter: 'blur(3px)'
                      }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, height: '4px',
                          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                          boxShadow: '0 0 10px var(--accent), 0 0 20px var(--accent)',
                          animation: 'avatarScanUsr 2s infinite linear'
                        }} />
                        <ArrowSyncRegular fontSize={22} style={{ animation: 'spin 1.2s linear infinite', color: 'var(--accent)' }} />
                        <span style={{ fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent)' }}>
                          {isRu ? 'Анализ...' : 'Tekshirilmoqda...'}
                        </span>
                      </div>
                    )}

                    {/* Hover overlay (only when not checking) */}
                    {!checkingFace && avatarHovered && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', gap: 6,
                        backdropFilter: 'blur(1px)',
                        animation: 'fadeIn 0.2s ease',
                      }}>
                        <CameraRegular fontSize={24} />
                        <span style={{ fontSize: 10, letterSpacing: '0.5px', fontWeight: 600 }}>
                          {imagePreview ? (isRu ? 'Изменить' : "O'zgartirish") : (isRu ? 'Загрузить' : 'Yuklash')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <input type="file" ref={fileRef} accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />

                {/* Error message */}
                {imgError && (
                  <div style={{ color: '#f43f5e', fontSize: 11, textAlign: 'center', padding: '0 8px' }}>
                    {imgError}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => !checkingFace && fileRef.current?.click()}
                    disabled={checkingFace}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 8,
                      background: 'var(--accent-bg)', color: 'var(--accent-tx)',
                      border: '1px solid var(--accent-bd)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <ImageRegular fontSize={13} />
                    {isRu ? 'Выбрать фото' : 'Rasm tanlash'}
                  </button>

                  {imagePreview && (
                    <button
                      type="button"
                      onClick={onClearImage}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 12px', borderRadius: 8,
                        background: 'transparent', color: 'var(--red)',
                        border: '1px solid var(--red-bd)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-bg)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <DismissRegular fontSize={13} />
                      {isRu ? 'Удалить' : "O'chirish"}
                    </button>
                  )}
                </div>

                {/* Photo guidelines */}
                <div style={{
                  marginTop: 4, padding: '12px 14px', borderRadius: 8,
                  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                  width: '100%', fontSize: 11, lineHeight: '1.6', color: 'var(--text-2)',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckmarkCircleRegular fontSize={14} style={{ color: '#10b981' }} />
                    {isRu ? 'Требования к фото:' : 'Rasm talablari:'}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>{isRu ? 'Формат: JPG, PNG, WEBP' : 'Format: JPG, PNG, WEBP'}</li>
                    <li>{isRu ? 'Максимум 5 МБ' : 'Maksimal hajm: 5 MB'}</li>
                    <li>{isRu ? 'Лицо чёткое и по центру' : 'Yuz aniq va markazda bo\'lsin'}</li>
                  </ul>
                </div>

                {/* Optional URL input */}
                <div style={{ width: '100%' }}>
                  {(() => {
                    const urlVal = form.image_url.trim()
                    const isValidUrl = !urlVal || urlVal.startsWith('http://') || urlVal.startsWith('https://') || urlVal.startsWith('/static/')
                    return (
                      <Field
                        label={isRu ? 'URL изображения' : 'Rasm URL'}
                        hint={urlVal && !isValidUrl
                          ? (isRu ? '⚠ Noto\'g\'ri URL — faqat https:// yoki http:// dan boshlanishi kerak' : '⚠ Noto\'g\'ri URL — https:// yoki http:// bilan boshlang')
                          : (isRu ? 'Ixtiyoriy' : 'Ixtiyoriy')}
                        hintTone={urlVal && !isValidUrl ? 'err' : 'muted'}
                      >
                        <input
                          value={form.image_url}
                          onChange={(e) => {
                            const v = e.target.value
                            setForm(prev => ({ ...prev, image_url: v }))
                            // Faqat valid URL bo'lsa preview ko'rsatamiz
                            if (!imageFile) {
                              const isValid = v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/static/')
                              setImagePreview(isValid ? v : '')
                            }
                          }}
                          style={{
                            ...inpStyle,
                            borderColor: form.image_url.trim() && !form.image_url.trim().startsWith('http') && !form.image_url.trim().startsWith('/static/')
                              ? '#ef4444' : undefined
                          }}
                          placeholder="https://example.com/photo.jpg"
                        />
                      </Field>
                    )
                  })()}
                </div>
              </div>
            </Section>

            {/* 5. Tizim sozlamalari */}
            <Section
              kicker={isRu ? 'Система' : 'Tizim'}
              title={isRu ? 'Системные настройки' : 'Tizim sozlamalari'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Google OAuth */}
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border-2)', background: 'var(--bg)',
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--surface-2)', color: 'var(--text-1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 14, flexShrink: 0,
                    }}>G</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Google OAuth</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                        {isRu ? 'Разрешить вход через Google' : "Google orqali kirish ruxsati"}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.google_oauth_enabled}
                    onChange={setField('google_oauth_enabled')}
                    style={{ accentColor: 'var(--accent)', width: 18, height: 18 }}
                  />
                </label>

                {/* is_staff */}
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border-2)', background: 'var(--bg)',
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--surface-2)', color: 'var(--text-1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 14, flexShrink: 0,
                    }}>S</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {isRu ? 'Доступ к веб-панели (Staff)' : 'Veb-panelga kirish (Staff)'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                        {isRu ? 'Вход разрешен на bioface.uz' : 'bioface.uz veb-interfeysiga kirish ruxsati'}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.is_staff}
                    onChange={setField('is_staff')}
                    style={{ accentColor: 'var(--accent)', width: 18, height: 18 }}
                  />
                </label>

                {/* Extra read-only system details */}
                {form.google_sub && (
                  <div style={{
                    fontSize: 12, padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg)', border: '1px solid var(--border-2)',
                    marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Google Subject ID:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-4)', fontSize: 11, wordBreak: 'break-all' }}>{form.google_sub}</span>
                  </div>
                )}

                {form.last_login_provider && (
                  <div style={{
                    fontSize: 12, padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg)', border: '1px solid var(--border-2)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{isRu ? 'Вход выполнен через:' : 'Oxirgi kirish turi:'}</span>
                    <span style={{
                      fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 6,
                      background: form.last_login_provider === 'google' ? 'rgba(66, 133, 244, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: form.last_login_provider === 'google' ? '#4285f4' : '#10b981'
                    }}>
                      {form.last_login_provider === 'google' ? 'Google' : (isRu ? 'Пароль' : 'Parol')}
                    </span>
                  </div>
                )}
              </div>
            </Section>
          </aside>
        </div>

        {/* Action bar */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)',
        }}>
          <button type="button" onClick={() => navigate('/users')} disabled={saving} style={btnStyle('subtle')}>
            {isRu ? 'Отмена' : 'Bekor qilish'}
          </button>
          <button type="submit" disabled={saving} style={btnStyle('accent')}>
            {saving
              ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <CheckmarkRegular fontSize={14} />}
            {saving ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Сохранить' : 'Saqlash')}
          </button>
        </div>
      </form>

      {/* Face selector modal — shown when multiple faces detected */}
      {showFaceSelector && faceSelectionData && (
        <UsrModal
          title={isRu ? 'Foydalanuvchi yuzini tanlang' : 'Foydalanuvchi yuzini tanlang'}
          onClose={handleCancelFaceSelection}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: '1.5' }}>
              {isRu
                ? 'На изображении обнаружено несколько лиц. Пожалуйста, выберите нужное:'
                : 'Rasmda bir nechta yuz aniqlandi. Iltimos, foydalanuvchining yuzini tanlang:'}
            </p>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 12,
              justifyContent: 'center', padding: '10px 0',
              maxHeight: 320, overflowY: 'auto'
            }}>
              {faceSelectionData.faces.map((face, idx) => (
                <UsrFaceThumbnail
                  key={idx}
                  img={faceSelectionData.img}
                  face={face}
                  w={faceSelectionData.w}
                  h={faceSelectionData.h}
                  onClick={() => {
                    cropSelectedFace(face, faceSelectionData.img, faceSelectionData.w, faceSelectionData.h, faceSelectionData.file)
                    setFaceSelectionData(null)
                    setShowFaceSelector(false)
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={handleCancelFaceSelection} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 7,
                background: 'var(--surface-2)', color: 'var(--text-1)',
                border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
            </div>
          </div>
        </UsrModal>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers and styles
// ────────────────────────────────────────────────────────────────────────────


function Section({ kicker, title, hint, children }) {
  return (
    <section style={cardStyle}>
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--accent-tx)',
          textTransform: 'uppercase', letterSpacing: 0.7,
        }}>{kicker}</div>
        <h2 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{title}</h2>
        {hint && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-4)' }}>{hint}</div>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, hintTone = 'muted', required, children }) {
  const hintColor = hintTone === 'ok' ? '#10b981' : hintTone === 'err' ? '#f43f5e' : 'var(--text-4)'
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: '#f43f5e' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: hintColor }}>{hint}</span>}
    </label>
  )
}

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }
const errBannerStyle = { marginBottom: 18, padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }
const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
const inpStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const eyeBtn = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: 'none',
  color: 'var(--text-3)', cursor: 'pointer', padding: 4,
  display: 'flex', alignItems: 'center',
}

function btnStyle(kind) {
  const map = {
    accent: { bg: 'var(--accent)', color: '#fff' },
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 8,
    background: t.bg, color: t.color,
    border: t.border || 'none',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function UsrModal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 24, maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 20 }}>
            <DismissRegular fontSize={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── FaceThumbnail ───────────────────────────────────────────────────────────
function UsrFaceThumbnail({ img, face, w, h, onClick }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !img) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const scaleX = img.width / w, scaleY = img.height / h
    const fx = face.x * scaleX, fy = face.y * scaleY
    const fw = face.width * scaleX, fh = face.height * scaleY
    let cropW = fw * 2.2, cropH = cropW * 1.333
    let cropX = fx - (cropW - fw) / 2, cropY = fy - fh * 0.5
    if (cropX < 0) cropX = 0
    if (cropY < 0) cropY = 0
    if (cropX + cropW > img.width) cropW = img.width - cropX
    if (cropY + cropH > img.height) cropH = img.height - cropY
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    try { ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height) } catch (e) {}
  }, [img, face, w, h])

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '2px solid var(--border-3)', borderRadius: 10, overflow: 'hidden',
        background: 'var(--surface-2)', cursor: 'pointer', padding: 0,
        width: 100, height: 133,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,120,212,0.25)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-3)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
    >
      <canvas ref={canvasRef} width={96} height={128} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{
        position: 'absolute', right: 6, bottom: 6, width: 20, height: 20, borderRadius: '50%',
        background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 11, fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>✓</div>
    </button>
  )
}
