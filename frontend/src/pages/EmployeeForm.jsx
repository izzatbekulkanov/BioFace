import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowSyncRegular,
  CheckmarkRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  ArrowLeftRegular,
  ImageRegular,
  DismissRegular,
  CameraRegular,
  AddRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'

/**
 * Xodim/o'quvchi qo'shish va tahrirlash sahifasi.
 *
 * Marshrutlar:
 *   /users/staff/new       — yangi hodim/o'qituvchi
 *   /users/students/new    — yangi o'quvchi/talaba
 *   /employees/:id/edit    — tahrirlash
 *
 * Backend:
 *   GET  /api/employees/:id          (tahrirlash uchun)
 *   POST /api/employees              (multipart/form-data)
 *   PUT  /api/employees/:id          (multipart/form-data)
 *   GET  /api/organizations
 *   GET  /api/cameras
 */
// Phone mask helper — formats digits into +998 XX XXX XX XX
function applyPhoneMask(raw) {
  const digits = raw.replace(/\D/g, '')
  const body = digits.startsWith('998') ? digits.slice(3) : digits
  const d = body.slice(0, 9)
  let result = '+998'
  if (d.length === 0) return result
  result += ' ' + d.slice(0, 2)
  if (d.length > 2) result += ' ' + d.slice(2, 5)
  if (d.length > 5) result += ' ' + d.slice(5, 7)
  if (d.length > 7) result += ' ' + d.slice(7, 9)
  return result
}

const EMPLOYEE_TYPES = [
  { value: 'hodim',     label_uz: 'Hodim',           label_ru: 'Сотрудник' },
  { value: 'oqituvchi', label_uz: "O'qituvchi",      label_ru: 'Преподаватель' },
  { value: 'oquvchi',   label_uz: "O'quvchi",        label_ru: 'Учащийся' },
  { value: 'talaba',    label_uz: 'Talaba',          label_ru: 'Студент' },
]

export default function EmployeeForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const isEdit = Boolean(id)
  const toast = useToast()

  // mode parametri orqali default tip belgilanadi (URL: ?type=oquvchi)
  const initialType = searchParams.get('type') || 'hodim'

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [orgs, setOrgs] = useState([])
  const [cameras, setCameras] = useState([])

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    personal_id: '',
    department_id: '',
    department: '',
    position_id: '',
    position: '',
    employee_type: initialType,
    start_time: '',
    end_time: '',
    schedule_type: 'organization',
    schedule_id: '',
    organization_id: '',
    branch_id: '',
    camera_ids: [],
    phone: '',
    parent_phone: '',
    region: '',
    district: '',
    address: '',
    birth_date: '',
    gender: '',
    salary: '',
  })

  const [catalogDepts, setCatalogDepts] = useState([])
  const [catalogPoss, setCatalogPoss] = useState([])
  const [schedules, setSchedules] = useState([])
  const [branches, setBranches] = useState([])
  const [checkingFace, setCheckingFace] = useState(false)
  const [faceSuccess, setFaceSuccess] = useState(false)
  const [faceError, setFaceError] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)
  const [trackerReady, setTrackerReady] = useState(false)
  const [faceSelectionData, setFaceSelectionData] = useState(null)
  const [showFaceSelector, setShowFaceSelector] = useState(false)

  const [showAddOrgModal, setShowAddOrgModal] = useState(false)
  const [showAddDeptModal, setShowAddDeptModal] = useState(false)
  const [showAddPosModal, setShowAddPosModal] = useState(false)

  // Modal input states
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgType, setNewOrgType] = useState('boshqa')
  const [newOrgStartTime, setNewOrgStartTime] = useState('09:00')
  const [newOrgEndTime, setNewOrgEndTime] = useState('18:00')
  const [orgTypes, setOrgTypes] = useState([])
  const [newDeptName, setNewDeptName] = useState('')
  const [newPosName, setNewPosName] = useState('')

  // Fetch organization types when org modal is shown
  useEffect(() => {
    if (showAddOrgModal) {
      fetch(`/api/organizations/types?lang=${i18n.language}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(data => setOrgTypes(Array.isArray(data) ? data : []))
        .catch(err => console.error(err))
    }
  }, [showAddOrgModal, i18n.language])

  const handleAddOrg = async (e) => {
    e.preventDefault()
    if (!newOrgName.trim()) {
      toast.error(isRu ? 'Название организации обязательно' : 'Tashkilot nomi majburiy')
      return
    }
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOrgName.trim(),
          organization_type: newOrgType,
          default_start_time: newOrgStartTime,
          default_end_time: newOrgEndTime,
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || `HTTP ${res.status}`)
      }
      const created = await res.json()
      const newOrg = created?.item || created
      if (newOrg?.id) {
        setOrgs(prev => [...prev, newOrg])
        setForm(prev => ({
          ...prev,
          organization_id: String(newOrg.id),
          department_id: '',
          department: '',
          position_id: '',
          position: '',
        }))
        toast.success(isRu ? 'Организация успешно добавлена' : 'Tashkilot muvaffaqiyatli qo\'shildi')
        setShowAddOrgModal(false)
        setNewOrgName('')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleAddDept = async (e) => {
    e.preventDefault()
    if (!newDeptName.trim()) {
      toast.error(isRu ? 'Название обязательно' : 'Nomi majburiy')
      return
    }
    if (!form.organization_id) return
    try {
      const res = await fetch('/api/employee-catalogs/departments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: Number(form.organization_id),
          name: newDeptName.trim(),
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || `HTTP ${res.status}`)
      }
      const created = await res.json()
      const newDept = created?.item || created
      if (newDept?.id) {
        setCatalogDepts(prev => [...prev, newDept])
        setForm(prev => ({
          ...prev,
          department_id: String(newDept.id),
          department: newDept.name,
          position_id: '',
          position: '',
        }))
        toast.success(getDeptToastMessage())
        setShowAddDeptModal(false)
        setNewDeptName('')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleAddPos = async (e) => {
    e.preventDefault()
    if (!newPosName.trim()) {
      toast.error(isRu ? 'Название обязательно' : 'Nomi majburiy')
      return
    }
    if (!form.organization_id || !form.department_id) return
    try {
      const res = await fetch('/api/employee-catalogs/positions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: Number(form.organization_id),
          department_id: Number(form.department_id),
          name: newPosName.trim(),
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || `HTTP ${res.status}`)
      }
      const created = await res.json()
      const newPos = created?.item || created
      if (newPos?.id) {
        setCatalogPoss(prev => [...prev, newPos])
        setForm(prev => ({
          ...prev,
          position_id: String(newPos.id),
          position: newPos.name,
        }))
        toast.success(getPosToastMessage())
        setShowAddPosModal(false)
        setNewPosName('')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const fileRef = useRef(null)
  const initialPidRef = useRef('')

  const setField = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const onPhoneChange = (e) => {
    const masked = applyPhoneMask(e.target.value)
    setForm(prev => ({ ...prev, phone: masked }))
  }

  const onParentPhoneChange = (e) => {
    const masked = applyPhoneMask(e.target.value)
    setForm(prev => ({ ...prev, parent_phone: masked }))
  }

  const handleOrgChange = (val) => {
    setForm(prev => ({
      ...prev,
      organization_id: val,
      branch_id: '',
      department_id: '',
      department: '',
      position_id: '',
      position: '',
      salary: '',
    }))
  }

  const handleDeptChange = (val) => {
    const matched = catalogDepts.find(d => String(d.id) === String(val))
    setForm(prev => ({
      ...prev,
      department_id: val,
      department: matched ? matched.name : '',
      position_id: '',
      position: '',
      salary: '',
    }))
  }

  const handlePosChange = (val) => {
    const matched = catalogPoss.find(p => String(p.id) === String(val))
    setForm(prev => ({
      ...prev,
      position_id: val,
      position: matched ? matched.name : '',
      salary: '',
    }))
  }

  const selectedPos = catalogPoss.find(p => String(p.id) === String(form.position_id))
  const salaryOptions = selectedPos?.salary_options
    ? selectedPos.salary_options.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const hasSalaryOptions = salaryOptions.length > 0

  const formatSpacedSingleNumber = (val) => {
    if (val === undefined || val === null) return ''
    const clean = String(val).replace(/\D/g, '')
    if (!clean) return ''
    return parseInt(clean, 10).toLocaleString('uz-UZ').replace(/,/g, ' ')
  }

  // Initial load
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [orgRes, camRes] = await Promise.all([
          fetch('/api/organizations', { credentials: 'include' }),
          fetch('/api/cameras', { credentials: 'include' }),
        ])
        if (orgRes.ok) {
          const data = await orgRes.json()
          if (alive) setOrgs(Array.isArray(data) ? data : (data?.items || []))
        }
        if (camRes.ok) {
          const data = await camRes.json()
          if (alive) setCameras(Array.isArray(data) ? data : (data?.items || []))
        }

        if (isEdit) {
          const r = await fetch(`/api/employees/${id}`, { credentials: 'include' })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const data = await r.json()
          const it = data?.item
          if (it && alive) {
            initialPidRef.current = it.personal_id || ''
            setForm(prev => ({
              ...prev,
              first_name: it.first_name || '',
              last_name: it.last_name || '',
              middle_name: it.middle_name || '',
              personal_id: it.personal_id || '',
              department_id: it.department_id != null ? String(it.department_id) : '',
              department: it.department || '',
              position_id: it.position_id != null ? String(it.position_id) : '',
              position: it.position || '',
              employee_type: it.employee_type || 'hodim',
              start_time: it.start_time || '',
              end_time: it.end_time || '',
              schedule_type: it.schedule_type || 'organization',
              schedule_id: it.schedule_id != null ? String(it.schedule_id) : '',
              organization_id: it.organization_id != null ? String(it.organization_id) : '',
              branch_id: it.branch_id != null ? String(it.branch_id) : '',
              camera_ids: (it.camera_ids || []).map(Number),
              phone: it.phone || '',
              parent_phone: it.parent_phone || '',
              region: it.region || '',
              district: it.district || '',
              address: it.address || '',
              birth_date: it.birth_date || '',
              gender: it.gender || '',
              salary: it.salary != null ? String(it.salary) : '',
            }))
            if (it.avatar) setImagePreview(it.avatar)
          }
        }
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
  }, [id, isEdit])

  // Fetch departments, positions, and schedules whenever organization_id changes
  useEffect(() => {
    if (!form.organization_id) {
      setCatalogDepts([])
      setCatalogPoss([])
      setSchedules([])
      setBranches([])
      return
    }
    // Immediately set branches from already-loaded orgs data (fast, no network)
    const currentOrg = orgs.find(o => String(o.id) === String(form.organization_id))
    if (currentOrg?.branches?.length > 0) {
      setBranches(currentOrg.branches)
      setForm(prev => {
        if (!prev.branch_id) {
          return { ...prev, branch_id: String(currentOrg.branches[0].id) }
        }
        return prev
      })
    }
    let alive = true
    ;(async () => {
      try {
        const [catRes, schRes, brRes] = await Promise.all([
          fetch(`/api/organizations/${form.organization_id}/employee-catalogs`, { credentials: 'include' }),
          fetch(`/api/organizations/${form.organization_id}/schedules`, { credentials: 'include' }),
          fetch(`/api/organizations/${form.organization_id}/branches`, { credentials: 'include' }),
        ])
        if (catRes.ok) {
          const data = await catRes.json()
          if (alive && data.ok) {
            setCatalogDepts(data.departments || [])
            setCatalogPoss(data.positions || [])
          }
        }
        if (schRes.ok) {
          const data = await schRes.json()
          if (alive && data.ok) {
            setSchedules(data.items || [])
          }
        }
        if (brRes.ok) {
          const data = await brRes.json()
          if (alive) {
            setBranches(Array.isArray(data) ? data : [])
            if (Array.isArray(data) && data.length > 0) {
              setForm(prev => {
                if (!prev.branch_id) {
                  return { ...prev, branch_id: String(data[0].id) }
                }
                return prev
              })
            }
          }
        }
      } catch (err) {
        console.error(err)
      }
    })()
    return () => { alive = false }
  }, [form.organization_id, orgs])

  // Personal ID availability check (debounced)
  const [pidStatus, setPidStatus] = useState({ checking: false, available: null, message: '' })
  const pidCheckRef = useRef(0)

  useEffect(() => {
    const v = (form.personal_id || '').trim()
    // Tahrirlashda boshlang'ich qiymat o'zgarmagan bo'lsa tekshirmaymiz
    if (isEdit && initialPidRef.current === v) {
      setPidStatus({ checking: false, available: null, message: '' })
      return
    }
    if (!v) {
      setPidStatus({ checking: false, available: null, message: '' })
      return
    }
    if (!/^\d{4,12}$/.test(v)) {
      setPidStatus({ checking: false, available: false, message: isRu ? '4–12 цифр' : "4-12 raqam" })
      return
    }
    const ticket = ++pidCheckRef.current
    setPidStatus(prev => ({ ...prev, checking: true }))
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ personal_id: v, allow_legacy: 'true' })
        if (isEdit && id) params.set('exclude_employee_id', String(id))
        const r = await fetch(`/api/employees/personal-id/validate?${params}`, { credentials: 'include' })
        const data = r.ok ? await r.json() : null
        if (ticket !== pidCheckRef.current) return
        if (!data) {
          setPidStatus({ checking: false, available: null, message: `HTTP ${r.status}` })
          return
        }
        setPidStatus({
          checking: false,
          available: !!data.available,
          message: data.message || (data.available
            ? (isRu ? 'ID свободен' : "ID bo'sh")
            : (isRu ? 'ID занят' : 'ID band')),
        })
      } catch (e) {
        if (ticket === pidCheckRef.current) {
          setPidStatus({ checking: false, available: null, message: e.message })
        }
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [form.personal_id, isEdit, id, isRu])

  // Personal ID auto-generate (yangi xodim uchun)
  const generateId = async () => {
    try {
      const r = await fetch('/api/employees/personal-id/generate', { credentials: 'include' })
      if (r.ok) {
        const data = await r.json()
        if (data?.personal_id) {
          setForm(prev => ({ ...prev, personal_id: data.personal_id }))
          toast.info(isRu ? 'ID сгенерирован' : 'ID generatsiya qilindi')
        }
      }
    } catch (e) {
      toast.error(e.message)
    }
  }

  // Load tracking.js face detector dynamically
  useEffect(() => {
    if (window.tracking && window.tracking.ObjectTracker) {
      setTrackerReady(true)
      return
    }

    const script1 = document.createElement('script')
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/tracking.js/1.1.3/tracking-min.js'
    script1.async = true
    script1.onload = () => {
      const script2 = document.createElement('script')
      script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/tracking.js/1.1.3/data/face-min.js'
      script2.async = true
      script2.onload = () => {
        setTrackerReady(true)
      }
      script2.onerror = () => {
        setTrackerReady(true) // fallback
      }
      document.body.appendChild(script2)
    }
    script1.onerror = () => {
      setTrackerReady(true) // fallback
    }
    document.body.appendChild(script1)
  }, [])

  const validateFace = (file) => {
    return new Promise((resolve) => {
      let resolved = false
      const safeResolve = (val) => {
        if (!resolved) {
          resolved = true
          resolve(val)
        }
      }

      // 4-second timeout safety net
      const timeoutId = setTimeout(() => {
        console.warn('Face detection timed out, skipping validation.')
        safeResolve({ ok: true, error: 'timeout' })
      }, 4000)

      if (!trackerReady || !window.tracking || !window.tracking.ObjectTracker) {
        clearTimeout(timeoutId)
        safeResolve({ ok: true, message: 'Tracker not ready or failed to load' })
        return
      }

      try {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            const maxDim = 600
            let w = img.width
            let h = img.height
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w)
                w = maxDim
              } else {
                w = Math.round((w * maxDim) / h)
                h = maxDim
              }
            }
            
            canvas.width = w
            canvas.height = h
            ctx.drawImage(img, 0, 0, w, h)

            // Check if classifier is registered
            if (!window.tracking.ViolaJones || !window.tracking.ViolaJones.classifiers || !window.tracking.ViolaJones.classifiers.face) {
              console.warn('Face classifier not registered in tracking.js, skipping validation.')
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
              try {
                tracker.removeListener('track', onTrack)
                if (trackerTask) trackerTask.stop()
              } catch (e) {
                console.error('Error stopping tracker task:', e)
              }
              clearTimeout(timeoutId)
              
              if (event.data && event.data.length > 0) {
                // If multiple faces are detected, resolve immediately to display selection modal
                if (event.data.length > 1) {
                  safeResolve({ 
                    ok: true, 
                    multiple: true, 
                    faces: event.data, 
                    img, 
                    w, 
                    h 
                  });
                  return;
                }

                // Exactly one face detected: crop it automatically
                const maxFace = event.data[0];
                const scaleX = img.width / w;
                const scaleY = img.height / h;

                const fx = maxFace.x * scaleX;
                const fy = maxFace.y * scaleY;
                const fw = maxFace.width * scaleX;
                const fh = maxFace.height * scaleY;

                let cropW = fw * 2.2; 
                let cropH = cropW * 1.333;

                let cropX = fx - (cropW - fw) / 2;
                let cropY = fy - fh * 0.5;

                if (cropX < 0) cropX = 0;
                if (cropY < 0) cropY = 0;

                if (cropX + cropW > img.width) {
                  cropW = img.width - cropX;
                  cropH = cropW * 1.333;
                }
                if (cropY + cropH > img.height) {
                  cropH = img.height - cropY;
                  cropW = cropH / 1.333;
                  cropX = fx - (cropW - fw) / 2;
                  if (cropX < 0) cropX = 0;
                }

                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = 450;
                cropCanvas.height = 600;
                const cropCtx = cropCanvas.getContext('2d');

                cropCtx.fillStyle = '#ffffff';
                cropCtx.fillRect(0, 0, 450, 600);

                cropCtx.drawImage(
                  img,
                  cropX, cropY, cropW, cropH,
                  0, 0, 450, 600
                );

                cropCanvas.toBlob((blob) => {
                  URL.revokeObjectURL(img.src);
                  if (blob) {
                    const croppedFile = new File([blob], file.name || 'avatar.jpg', {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    });
                    safeResolve({ 
                      ok: true, 
                      faces: event.data, 
                      croppedFile, 
                      previewUrl: URL.createObjectURL(croppedFile) 
                    });
                  } else {
                    safeResolve({ ok: true, faces: event.data });
                  }
                }, 'image/jpeg', 0.92);

              } else {
                URL.revokeObjectURL(img.src);
                safeResolve({ ok: false, error: 'no_face_detected' })
              }
            }

            tracker.on('track', onTrack)
            trackerTask = window.tracking.track(canvas, tracker)
          } catch (innerErr) {
            console.error('Inner face tracking error:', innerErr)
            clearTimeout(timeoutId)
            URL.revokeObjectURL(img.src);
            safeResolve({ ok: true, error: 'exception_inner' })
          }
        }
        img.onerror = () => {
          clearTimeout(timeoutId)
          safeResolve({ ok: false, error: 'invalid_image' })
        }
        img.src = URL.createObjectURL(file)
      } catch (outerErr) {
        console.error('Outer face tracking error:', outerErr)
        clearTimeout(timeoutId)
        safeResolve({ ok: true, error: 'exception_outer' })
      }
    })
  }

  const cropSelectedFace = (face, img, w, h, file) => {
    const scaleX = img.width / w;
    const scaleY = img.height / h;

    const fx = face.x * scaleX;
    const fy = face.y * scaleY;
    const fw = face.width * scaleX;
    const fh = face.height * scaleY;

    // Expand bounding box for passport photo style (3:4 ratio)
    let cropW = fw * 2.2; 
    let cropH = cropW * 1.333;

    // Center face horizontally, position starting above the face (about 50% of face height)
    let cropX = fx - (cropW - fw) / 2;
    let cropY = fy - fh * 0.5;

    // Boundaries clamping
    if (cropX < 0) cropX = 0;
    if (cropY < 0) cropY = 0;

    if (cropX + cropW > img.width) {
      cropW = img.width - cropX;
      cropH = cropW * 1.333;
    }
    if (cropY + cropH > img.height) {
      cropH = img.height - cropY;
      cropW = cropH / 1.333;
      cropX = fx - (cropW - fw) / 2;
      if (cropX < 0) cropX = 0;
    }

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = 450;
    cropCanvas.height = 600;
    const cropCtx = cropCanvas.getContext('2d');

    cropCtx.fillStyle = '#ffffff';
    cropCtx.fillRect(0, 0, 450, 600);

    cropCtx.drawImage(
      img,
      cropX, cropY, cropW, cropH,
      0, 0, 450, 600
    );

    cropCanvas.toBlob((blob) => {
      URL.revokeObjectURL(img.src);
      if (blob) {
        const croppedFile = new File([blob], file.name || 'avatar.jpg', {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        setImageFile(croppedFile);
        setImagePreview(URL.createObjectURL(croppedFile));
        setFaceSuccess(true);
        toast.success(isRu ? 'Лицо успешно выбрано и обрезано!' : 'Yuz muvaffaqiyatli tanlandi va kesib olindi!');
        setTimeout(() => setFaceSuccess(false), 2000);
      } else {
        toast.error('Crop failed');
      }
    }, 'image/jpeg', 0.92);
  };

  const handleCancelFaceSelection = () => {
    if (faceSelectionData?.img) {
      URL.revokeObjectURL(faceSelectionData.img.src);
    }
    setFaceSelectionData(null);
    setShowFaceSelector(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImageFile = async (file) => {
    if (!file) return

    setCheckingFace(true)
    setFaceSuccess(false)
    setFaceError(false)

    const result = await validateFace(file)
    setCheckingFace(false)

    if (result.ok) {
      if (result.multiple) {
        setFaceSelectionData({
          faces: result.faces,
          img: result.img,
          w: result.w,
          h: result.h,
          file
        })
        setShowFaceSelector(true)
      } else {
        const finalFile = result.croppedFile || file
        const finalPreview = result.previewUrl || URL.createObjectURL(file)
        
        setImageFile(finalFile)
        setImagePreview(finalPreview)
        setFaceSuccess(true)
        toast.success(isRu ? 'Лицо успешно обнаружено и обрезано!' : 'Inson yuzi muvaffaqiyatli aniqlandi va kesib olindi!')
        setTimeout(() => setFaceSuccess(false), 2000)
      }
    } else {
      setFaceError(true)
      if (result.error === 'no_face_detected') {
        toast.error(isRu 
          ? 'Лицо не обнаружено или фото нечеткое. Пожалуйста, используйте качественное портретное фото.'
          : 'Yuklangan rasmda yuz aniqlanmadi yoki rasm sifatsiz. Iltimos, sifatliroq portret rasm yuklang.'
        )
      } else {
        toast.error(isRu ? 'Не удалось загрузить изображение.' : 'Tasvirni yuklab bo\'lmadi.')
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

  const snapshotUrl = searchParams.get('snapshot_url')
  useEffect(() => {
    if (snapshotUrl) {
      let alive = true;
      (async () => {
        try {
          if (alive) {
            setCheckingFace(true)
            setFaceSuccess(false)
            setFaceError(false)
          }
          const res = await fetch(snapshotUrl, { credentials: 'include' })
          if (!res.ok) throw new Error('Failed to fetch snapshot')
          const blob = await res.blob()
          const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' })
          
          const result = await validateFace(file)
          if (!alive) return
          setCheckingFace(false)
          if (result.ok) {
            if (result.multiple) {
              setFaceSelectionData({
                faces: result.faces,
                img: result.img,
                w: result.w,
                h: result.h,
                file
              })
              setShowFaceSelector(true)
            } else {
              const finalFile = result.croppedFile || file
              const finalPreview = result.previewUrl || URL.createObjectURL(file)
              setImageFile(finalFile)
              setImagePreview(finalPreview)
              setFaceSuccess(true)
              setTimeout(() => { if (alive) setFaceSuccess(false) }, 2000)
            }
          } else {
            setImageFile(file)
            setImagePreview(URL.createObjectURL(file))
          }
        } catch (err) {
          if (alive) {
            setCheckingFace(false)
            console.error('Failed to load snapshot from url:', err)
          }
        }
      })()
      return () => { alive = false }
    }
  }, [snapshotUrl])

  const nameParam = searchParams.get('name')
  useEffect(() => {
    if (nameParam) {
      const parts = nameParam.trim().split(/\s+/)
      setForm(prev => ({
        ...prev,
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
      }))
    }
  }, [nameParam])

  const onClearImage = () => {
    setImageFile(null)
    setImagePreview('')
    setFaceSuccess(false)
    setFaceError(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggleCamera = (camId) => {
    setForm(prev => {
      const has = prev.camera_ids.includes(camId)
      return { ...prev, camera_ids: has ? prev.camera_ids.filter(x => x !== camId) : [...prev.camera_ids, camId] }
    })
  }

  const cameraSelected = form.camera_ids.length
  const camerasOfOrg = form.organization_id
    ? cameras.filter(c => String(c.organization_id) === String(form.organization_id))
    : cameras

  const validate = () => {
    if (!form.first_name.trim()) return isRu ? 'Имя обязательно' : 'Ism majburiy'
    if (!form.last_name.trim())  return isRu ? 'Фамилия обязательна' : 'Familiya majburiy'
    if (!form.organization_id) {
      if (form.employee_type === 'oquvchi') return isRu ? 'Выберите школу' : 'Maktab tanlanishi shart'
      if (form.employee_type === 'talaba') return isRu ? 'Выберите ВУЗ' : 'OTM tanlanishi shart'
      return isRu ? 'Выберите организацию' : 'Tashkilot tanlanishi shart'
    }
    if (!form.branch_id) {
      return isRu ? 'Выберите филиал' : 'Filial tanlanishi shart'
    }
    const pidValue = (form.personal_id || '').trim()
    if (pidValue && !/^\d{4,12}$/.test(pidValue)) {
      return isRu ? 'ID должен быть 4–12 цифр' : "Shaxsiy ID 4-12 raqam bo'lishi kerak"
    }
    if (pidValue && pidStatus.available === false && !pidStatus.checking) {
      return isRu ? 'Этот ID уже занят' : 'Bu ID allaqachon band'
    }
    if (pidValue && pidStatus.checking) {
      return isRu ? 'Подождите проверку ID' : "ID tekshiruvi tugashini kuting"
    }
    return ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); toast.error(v); return }
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.set('first_name', form.first_name.trim())
      fd.set('last_name', form.last_name.trim())
      if (form.middle_name.trim())  fd.set('middle_name', form.middle_name.trim())
      if (form.personal_id.trim())  fd.set('personal_id', form.personal_id.trim())
      if (form.department_id)       fd.set('department_id', String(form.department_id))
      if (form.department)          fd.set('department', form.department.trim())
      if (form.position_id)         fd.set('position_id', String(form.position_id))
      if (form.position)            fd.set('position', form.position.trim())
      if (form.employee_type)       fd.set('employee_type', form.employee_type)
      if (form.start_time)          fd.set('start_time', form.start_time)
      if (form.end_time)            fd.set('end_time', form.end_time)
      fd.set('schedule_type', form.schedule_type)
      if (form.schedule_id)         fd.set('schedule_id', String(form.schedule_id))
      if (form.organization_id)     fd.set('organization_id', String(form.organization_id))
      if (form.branch_id)           fd.set('branch_id', String(form.branch_id))
      if (form.camera_ids.length)   fd.set('camera_ids', form.camera_ids.join(','))
      if (imageFile)                fd.set('image', imageFile)
      fd.set('phone', form.phone.trim())
      fd.set('parent_phone', form.parent_phone.trim())
      fd.set('region', form.region.trim())
      fd.set('district', form.district.trim())
      fd.set('address', form.address.trim())
      fd.set('birth_date', form.birth_date.trim())
      fd.set('gender', form.gender)
      fd.set('salary', (form.salary || '').trim())

      const url = isEdit ? `/api/employees/${id}` : '/api/employees'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, { method, credentials: 'include', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data?.detail || data?.message || `HTTP ${res.status}`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      toast.success(isEdit
        ? (isRu ? 'Сохранено' : 'Saqlandi')
        : (isRu ? 'Сотрудник добавлен' : "Xodim qo'shildi"))
      // Tegishli ro'yxatga qaytamiz
      const isStudent = ['oquvchi', 'talaba', 'student'].includes(form.employee_type)
      navigate(isStudent ? '/users/students' : '/users/staff')
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const isStudentMode = ['oquvchi', 'talaba', 'student'].includes(form.employee_type)
  const backPath = isStudentMode ? '/users/students' : '/users/staff'

  const getWorkplaceKicker = () => {
    if (form.employee_type === 'oquvchi' || form.employee_type === 'talaba') {
      return isRu ? 'Место учебы' : 'O\'qish joyi'
    }
    return isRu ? 'Рабочее место' : 'Ish joyi'
  }

  const getWorkplaceTitle = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Школа и класс' : 'Maktab va sinf'
    if (form.employee_type === 'talaba') return isRu ? 'ВУЗ и группа' : 'OTM va guruh'
    return isRu ? 'Организация, отдел, должность' : 'Tashkilot, bo\'lim, lavozim'
  }

  const getOrgLabel = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Школа' : 'Maktab'
    if (form.employee_type === 'talaba') return isRu ? 'Высшее учебное заведение (ВУЗ)' : 'Oliy ta\'lim muassasasi (OTM)'
    return isRu ? 'Организация' : 'Tashkilot'
  }

  const getOrgPlaceholder = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Без школы' : 'Maktabsiz'
    if (form.employee_type === 'talaba') return isRu ? 'Без ВУЗа' : 'OTMsiz'
    return isRu ? 'Без организации' : 'Tashkilotsiz'
  }

  const getOrgAddTitle = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Добавить школу' : 'Maktab qo\'shish'
    if (form.employee_type === 'talaba') return isRu ? 'Добавить ВУЗ' : 'OTM qo\'shish'
    return isRu ? 'Добавить организацию' : 'Tashkilot qo\'shish'
  }

  const getDeptLabel = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Класс' : 'Sinf'
    if (form.employee_type === 'talaba') return isRu ? 'Курс' : 'Kurs'
    return isRu ? 'Отдел' : 'Bo\'lim'
  }

  const getDeptPlaceholder = () => {
    if (form.employee_type === 'oquvchi' || form.employee_type === 'talaba') return isRu ? 'Выберите' : 'Tanlang'
    return isRu ? 'Выберите отдел' : 'Bo\'limni tanlang'
  }

  const getDeptAddTitle = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Добавить класс' : 'Sinf qo\'shish'
    if (form.employee_type === 'talaba') return isRu ? 'Добавить курс' : 'Kurs qo\'shish'
    return isRu ? 'Добавить отдел' : 'Bo\'lim qo\'shish'
  }

  const getDeptInputLabel = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Название класса' : 'Sinf nomi'
    if (form.employee_type === 'talaba') return isRu ? 'Название курса / года' : 'Kurs nomi / yili'
    return isRu ? 'Название отдела' : 'Bo\'lim nomi'
  }

  const getDeptInputPlaceholder = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Например: 9' : 'Masalan: 9'
    if (form.employee_type === 'talaba') return isRu ? 'Например: 3-kurs' : 'Masalan: 3-kurs'
    return isRu ? 'Например: Бухгалтерия' : 'Masalan: Buxgalteriya'
  }

  const getPosLabel = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Параллель (буква)' : 'Sinf belgisi / harfi'
    if (form.employee_type === 'talaba') return isRu ? 'Академическая группа' : 'Akademik guruh'
    return isRu ? 'Должность' : 'Lavozim'
  }

  const getPosPlaceholder = () => {
    return isRu ? 'Выберите' : 'Tanlang'
  }

  const getPosAddTitle = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Добавить параллель' : 'Sinf belgisi qo\'shish'
    if (form.employee_type === 'talaba') return isRu ? 'Добавить группу' : 'Guruh qo\'shish'
    return isRu ? 'Добавить должность' : 'Lavozim qo\'shish'
  }

  const getPosInputLabel = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Название параллели (буквы)' : 'Sinf belgisi (harfi)'
    if (form.employee_type === 'talaba') return isRu ? 'Название группы' : 'Guruh nomi'
    return isRu ? 'Название должности' : 'Lavozim nomi'
  }

  const getPosInputPlaceholder = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Например: А' : 'Masalan: A'
    if (form.employee_type === 'talaba') return isRu ? 'Например: 310-guruh' : 'Masalan: 310-guruh'
    return isRu ? 'Например: Бухгалтер' : 'Masalan: Buxgalter'
  }

  const getDeptToastMessage = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Класс успешно добавлен' : 'Sinf muvaffaqiyatli qo\'shildi'
    if (form.employee_type === 'talaba') return isRu ? 'Курс успешно добавлен' : 'Kurs muvaffaqiyatli qo\'shildi'
    return isRu ? 'Отдел успешно добавлен' : 'Bo\'lim muvaffaqiyatli qo\'shildi'
  }

  const getPosToastMessage = () => {
    if (form.employee_type === 'oquvchi') return isRu ? 'Параллель успешно добавлена' : 'Sinf belgisi muvaffaqiyatli qo\'shildi'
    if (form.employee_type === 'talaba') return isRu ? 'Группа успешно добавлена' : 'Guruh muvaffaqiyatli qo\'shildi'
    return isRu ? 'Должность успешно добавлена' : 'Lavozim muvaffaqiyatli qo\'shildi'
  }

  try {
    if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero badge="✦" title={isEdit ? (isRu ? 'Редактирование' : 'Tahrirlash') : (isRu ? 'Новый' : 'Yangi')} backPath={backPath} />
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
        .emp-form-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        .emp-form-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px;
        }
        .emp-grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .emp-grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        @media (max-width: 900px) {
          .emp-form-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 600px) {
          .emp-form-container {
            padding: 16px 16px 60px !important;
          }
          .emp-grid-2, .emp-grid-3 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <PageHero
        badge={isEdit ? (isRu ? '✦ Редактирование' : '✦ Tahrirlash') : (isRu ? '✦ Новый сотрудник' : '✦ Yangi xodim')}
        title={isEdit
          ? (isRu ? 'Редактировать данные' : "Ma'lumotlarni tahrirlash")
          : (isRu ? 'Добавить сотрудника' : "Xodim qo'shish")}
        sub={isStudentMode
          ? (isRu ? 'Учащийся / студент' : "O'quvchi yoki talaba")
          : (isRu ? 'Сотрудник или преподаватель' : "Hodim yoki o'qituvchi")}
        backPath={backPath}
        right={
          <button type="button" onClick={() => navigate(backPath)} style={heroBtnStyle}>
            <ArrowLeftRegular fontSize={16} />
            {isRu ? 'К списку' : "Ro'yxatga"}
          </button>
        }
      />

      <form onSubmit={onSubmit} className="emp-form-container">
        {error && <div style={errBannerStyle}>{error}</div>}

        <div className="emp-form-layout">
          {/* MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Shaxsiy ma'lumotlar */}
            <Section
              kicker={isRu ? 'Личные данные' : "Shaxsiy ma'lumotlar"}
              title={isRu ? 'ФИО и ID' : "F.I.SH va ID"}
            >
              <div className="emp-grid-3">
                <Field label={isRu ? 'Имя' : 'Ism'} required>
                  <input value={form.first_name} onChange={setField('first_name')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Фамилия' : 'Familiya'} required>
                  <input value={form.last_name} onChange={setField('last_name')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Отчество' : 'Otasining ismi'}>
                  <input value={form.middle_name} onChange={setField('middle_name')} style={inpStyle} />
                </Field>
              </div>

              <div className="emp-grid-2" style={{ marginTop: 12 }}>
                <Field
                  label={isRu ? 'Личный ID (для камеры)' : 'Shaxsiy ID (kamera uchun)'}
                  hint={
                    pidStatus.message ||
                    (isRu
                      ? '7-значный ID. Если оставите пустым — будет сгенерирован.'
                      : "7 xonali ID. Bo'sh qoldirsangiz avtomatik generatsiya qilinadi.")
                  }
                  hintTone={
                    pidStatus.checking ? 'muted'
                    : pidStatus.available === true ? 'ok'
                    : pidStatus.available === false ? 'err'
                    : 'muted'
                  }
                >
                  <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        value={form.personal_id}
                        onChange={isEdit && initialPidRef.current ? undefined : setField('personal_id')}
                        readOnly={isEdit && !!initialPidRef.current}
                        style={{
                          ...inpStyle,
                          paddingRight: 36,
                          background: (isEdit && !!initialPidRef.current) ? 'var(--surface-2)' : inpStyle.background,
                          cursor: (isEdit && !!initialPidRef.current) ? 'not-allowed' : 'text',
                          color: (isEdit && !!initialPidRef.current) ? 'var(--text-3)' : inpStyle.color,
                        }}
                        placeholder="1234567"
                        inputMode="numeric"
                      />
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        {isEdit && initialPidRef.current
                          ? <span style={{ fontSize: 14 }}>🔒</span>
                          : pidStatus.checking
                            ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                            : pidStatus.available === true
                              ? <CheckmarkCircleRegular fontSize={16} style={{ color: '#10b981' }} />
                              : pidStatus.available === false
                                ? <WarningRegular fontSize={14} style={{ color: '#f43f5e' }} />
                                : null}
                      </span>
                    </div>
                    {!(isEdit && !!initialPidRef.current) && (
                      <button type="button" onClick={generateId} style={smallBtn('subtle')} title={isRu ? 'Сгенерировать' : 'Generatsiya'}>
                        <ArrowSyncRegular fontSize={13} />
                      </button>
                    )}
                  </div>
                  {isEdit && initialPidRef.current && (
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                      {isRu ? '🔒 ID tahrirlash mumkin emas' : "🔒 ID o'zgartirib bo'lmaydi"}
                    </div>
                  )}
                </Field>
                <Field label={isRu ? 'Тип' : 'Tip'}>
                  <CustomSelect
                    value={form.employee_type}
                    onChange={(val) => setForm(prev => ({ ...prev, employee_type: val }))}
                    options={EMPLOYEE_TYPES.map(t => ({
                      value: t.value,
                      label: isRu ? t.label_ru : t.label_uz
                    }))}
                  />
                </Field>
              </div>

              <div className="emp-grid-2" style={{ marginTop: 12 }}>
                <Field label={isRu ? 'Дата рождения' : "Tug'ilgan sana"}>
                  <input type="date" value={form.birth_date} onChange={setField('birth_date')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Пол' : 'Jinsi'}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { value: 'male', labelUz: '👨 Erkak', labelRu: '👨 Мужской' },
                      { value: 'female', labelUz: '👩 Ayol', labelRu: '👩 Женский' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, gender: prev.gender === opt.value ? '' : opt.value }))}
                        style={{
                          flex: 1, padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                          border: form.gender === opt.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: form.gender === opt.value ? 'var(--accent-bg)' : 'var(--bg)',
                          color: form.gender === opt.value ? 'var(--accent)' : 'var(--text-2)',
                          fontWeight: form.gender === opt.value ? 700 : 400,
                          fontSize: 13, transition: 'all 0.18s ease',
                        }}
                      >
                        {isRu ? opt.labelRu : opt.labelUz}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </Section>

            {/* Aloqa va manzil */}
            <Section
              kicker={isRu ? 'Контакты и адрес' : 'Aloqa va manzil'}
              title={isRu ? 'Контактная информация' : "Aloqa va manzil ma'lumotlari"}
            >
              <div className="emp-grid-2">
                <Field label={isRu ? 'Номер телефона' : 'Telefon raqami'}>
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
                    placeholder="+998 90 123 45 67"
                    maxLength={17}
                    style={inpStyle}
                  />
                </Field>
                <Field label={isRu ? 'Телефон родителей' : 'Ota-onasining telefon raqami'}>
                  <input
                    type="tel"
                    value={form.parent_phone}
                    onChange={onParentPhoneChange}
                    onFocus={(e) => {
                      if (!e.target.value) setForm(prev => ({ ...prev, parent_phone: '+998 ' }))
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '+998 ') setForm(prev => ({ ...prev, parent_phone: '' }))
                    }}
                    placeholder="+998 90 123 45 67"
                    maxLength={17}
                    style={inpStyle}
                  />
                </Field>
              </div>
              <div className="emp-grid-3" style={{ marginTop: 12 }}>
                <Field label={isRu ? 'Область' : 'Viloyat'}>
                  <input value={form.region} onChange={setField('region')} placeholder={isRu ? 'Ташкентская область' : 'Toshkent viloyati'} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Район' : 'Tuman'}>
                  <input value={form.district} onChange={setField('district')} placeholder={isRu ? 'Зангиатинский район' : 'Zangiota tumani'} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Адрес' : 'Manzil'}>
                  <input value={form.address} onChange={setField('address')} placeholder={isRu ? 'ул. Мукими, 12' : 'Muqimiy ko\'chasi, 12'} style={inpStyle} />
                </Field>
              </div>
            </Section>

            {/* 2. Ish joyi */}
            <Section
              kicker={getWorkplaceKicker()}
              title={getWorkplaceTitle()}
            >
              <div className="emp-grid-2">
                <Field label={getOrgLabel()}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect
                        value={form.organization_id ? String(form.organization_id) : ''}
                        onChange={handleOrgChange}
                        options={orgs.map(o => ({ value: String(o.id), label: o.name }))}
                        placeholder={getOrgPlaceholder()}
                      />
                    </div>
                    <button type="button" onClick={() => setShowAddOrgModal(true)} style={smallBtn('subtle')} title={getOrgAddTitle()}>
                      <AddRegular fontSize={14} />
                    </button>
                  </div>
                </Field>
                <Field label={isRu ? 'Филиал' : 'Filial'} required>
                  <CustomSelect
                    value={form.branch_id ? String(form.branch_id) : ''}
                    onChange={val => setForm(prev => ({ ...prev, branch_id: val }))}
                    disabled={!form.organization_id}
                    options={branches.map(b => ({ value: String(b.id), label: b.name }))}
                    placeholder={isRu ? '— Выберите филиал —' : '— Filialni tanlang —'}
                  />
                </Field>
                <Field label={getDeptLabel()}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect
                        value={form.department_id ? String(form.department_id) : ''}
                        onChange={handleDeptChange}
                        disabled={!form.organization_id}
                        options={catalogDepts.map(d => ({ value: String(d.id), label: d.name }))}
                        placeholder={getDeptPlaceholder()}
                      />
                    </div>
                    <button type="button" onClick={() => setShowAddDeptModal(true)} disabled={!form.organization_id} style={smallBtn('subtle')} title={getDeptAddTitle()}>
                      <AddRegular fontSize={14} />
                    </button>
                  </div>
                </Field>
                <Field label={getPosLabel()}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect
                        value={form.position_id ? String(form.position_id) : ''}
                        onChange={handlePosChange}
                        disabled={!form.department_id}
                        options={catalogPoss
                          .filter(p => String(p.department_id) === String(form.department_id))
                          .map(p => ({ value: String(p.id), label: p.name }))}
                        placeholder={getPosPlaceholder()}
                      />
                    </div>
                    <button type="button" onClick={() => setShowAddPosModal(true)} disabled={!form.department_id} style={smallBtn('subtle')} title={getPosAddTitle()}>
                      <AddRegular fontSize={14} />
                    </button>
                  </div>
                </Field>
                {!isStudentMode && (
                  <Field
                    label={isRu ? 'Оклад (Месячный)' : 'Oylik ish haqi'}
                    hint={form.salary ? `${parseInt(form.salary, 10).toLocaleString('uz-UZ')} UZS` : null}
                  >
                    {hasSalaryOptions ? (
                      <CustomSelect
                        value={form.salary || ''}
                        onChange={(val) => setForm(prev => ({ ...prev, salary: val }))}
                        options={salaryOptions.map(opt => ({
                          value: opt,
                          label: `${parseInt(opt, 10).toLocaleString('uz-UZ')} UZS`
                        }))}
                        placeholder={isRu ? 'Не указан' : 'Ko\'rsatilmagan'}
                      />
                    ) : (
                      <CustomSelect
                        disabled
                        value=""
                        onChange={() => {}}
                        options={[]}
                        placeholder={form.position_id 
                          ? (isRu ? 'Для выбранной должности нет вариантов оклада' : 'Tanlangan lavozim uchun oylik variantlari belgilanmagan') 
                          : (isRu ? 'Сначала выберите должность' : 'Avval lavozimni tanlang')}
                      />
                    )}
                  </Field>
                )}
              </div>
            </Section>

            {/* 3. Ish vaqti rejimi */}
            <Section
              kicker={isRu ? 'Режим работы' : 'Ish vaqti rejimi'}
              title={isRu ? 'Настройка графика работы' : 'Ish vaqtini sozlash'}
              hint={isRu ? 'Выберите один из трех режимов определения времени прихода и ухода' : 'Kelish va ketish vaqtini aniqlash uchun uchta rejimdan birini tanlang'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 3 ta rejim tanlovi */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <label style={{
                    display: 'flex', flexDirection: 'column', padding: '12px 16px', borderRadius: 8,
                    border: form.schedule_type === 'organization' ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: form.schedule_type === 'organization' ? 'var(--accent-bg)' : 'var(--surface-1)',
                    cursor: 'pointer', transition: 'all 0.2s ease', gap: 4
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: form.schedule_type === 'organization' ? 'var(--accent)' : 'var(--text-1)' }}>
                      <input type="radio" name="schedule_type" value="organization" checked={form.schedule_type === 'organization'} onChange={(e) => setForm(prev => ({ ...prev, schedule_type: e.target.value }))} style={{ accentColor: 'var(--accent)' }} />
                      {isRu ? 'Организация' : 'Tashkilot rejimi'}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {isRu ? 'Используется стандартное время организации' : 'Tashkilotning standart kirish-chiqish vaqti ishlatiladi'}
                    </span>
                  </label>

                  <label style={{
                    display: 'flex', flexDirection: 'column', padding: '12px 16px', borderRadius: 8,
                    border: form.schedule_type === 'shift' ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: form.schedule_type === 'shift' ? 'var(--accent-bg)' : 'var(--surface-1)',
                    cursor: 'pointer', transition: 'all 0.2s ease', gap: 4
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: form.schedule_type === 'shift' ? 'var(--accent)' : 'var(--text-1)' }}>
                      <input type="radio" name="schedule_type" value="shift" checked={form.schedule_type === 'shift'} onChange={(e) => setForm(prev => ({ ...prev, schedule_type: e.target.value }))} style={{ accentColor: 'var(--accent)' }} />
                      {isRu ? 'Смена' : 'Smena biriktirish'}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {isRu ? 'Выбор одной из созданных смен организации' : 'Tashkilot smenalaridan birini tanlash'}
                    </span>
                  </label>

                  <label style={{
                    display: 'flex', flexDirection: 'column', padding: '12px 16px', borderRadius: 8,
                    border: form.schedule_type === 'individual' ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: form.schedule_type === 'individual' ? 'var(--accent-bg)' : 'var(--surface-1)',
                    cursor: 'pointer', transition: 'all 0.2s ease', gap: 4
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: form.schedule_type === 'individual' ? 'var(--accent)' : 'var(--text-1)' }}>
                      <input type="radio" name="schedule_type" value="individual" checked={form.schedule_type === 'individual'} onChange={(e) => setForm(prev => ({ ...prev, schedule_type: e.target.value }))} style={{ accentColor: 'var(--accent)' }} />
                      {isRu ? 'Индивидуальный' : 'Individual vaqt'}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {isRu ? 'Указание отдельного времени прихода и ухода' : 'Alohida kirish va chiqish vaqtini belgilash'}
                    </span>
                  </label>
                </div>

                {/* Organization default schedule time display */}
                {form.schedule_type === 'organization' && form.organization_id && (() => {
                  const selectedOrgData = orgs.find(o => String(o.id) === String(form.organization_id))
                  return selectedOrgData ? (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>
                        {isRu ? 'Режим ташкилота:' : 'Tashkilot rejimi:'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 8, padding: '6px 14px' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                          🕐 {selectedOrgData.default_start_time || '09:00'} — {selectedOrgData.default_end_time || '18:00'}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {isRu ? 'Это стандартное рабочее время организации' : 'Bu tashkilotning standart ish vaqti'}
                      </span>
                    </div>
                  ) : null
                })()}

                {/* Smena tanlash qismi */}
                {form.schedule_type === 'shift' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <Field label={isRu ? 'Выберите смену' : 'Smenani tanlang'} required>
                      <CustomSelect
                        value={form.schedule_id ? String(form.schedule_id) : ''}
                        onChange={(val) => setForm(prev => ({ ...prev, schedule_id: val }))}
                        disabled={!form.organization_id}
                        options={schedules.map(sch => ({
                          value: String(sch.id),
                          label: `${sch.name} (${sch.start_time} - ${sch.end_time})`
                        }))}
                        placeholder={isRu ? 'Выберите смену' : 'Smenani tanlang'}
                      />
                      {!form.organization_id && (
                        <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, display: 'block' }}>
                          {isRu ? 'Сначала выберите организацию' : 'Avval tashkilotni tanlang'}
                        </span>
                      )}
                    </Field>
                  </div>
                )}

                {/* Individual vaqt kiritish qismi */}
                {form.schedule_type === 'individual' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div className="emp-grid-2">
                      <Field label={isRu ? 'Время прихода (Начало)' : 'Kelish vaqti (Boshlanish)'} required>
                        <input type="time" value={form.start_time || ''} onChange={setField('start_time')} style={inpStyle} />
                      </Field>
                      <Field label={isRu ? 'Время ухода (Конец)' : 'Ketish vaqti (Tugash)'} required>
                        <input type="time" value={form.end_time || ''} onChange={setField('end_time')} style={inpStyle} />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            </Section>

          </div>

          {/* SIDE COLUMN — Avatar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Section kicker="Avatar" title={isRu ? 'Фотография' : 'Rasm'}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <style>{`
                  @keyframes avatarScan {
                    0% { transform: translateY(-75px); opacity: 0.3; }
                    50% { transform: translateY(75px); opacity: 1; }
                    100% { transform: translateY(-75px); opacity: 0.3; }
                  }
                  @keyframes avatarShake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-8px); }
                    40%, 80% { transform: translateX(8px); }
                  }
                  @keyframes borderRotate {
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes pulseGreen {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                  }
                  @keyframes pulseRed {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                  }
                  .dashed-ring {
                    position: absolute;
                    inset: -8px;
                    border: 1.5px dashed var(--border-3);
                    border-radius: 50%;
                    animation: borderRotate 24s linear infinite;
                    opacity: 0.7;
                    pointer-events: none;
                    transition: all 0.3s;
                  }
                  .dashed-ring.checking {
                    animation: borderRotate 4s linear infinite;
                    border-color: var(--accent);
                    opacity: 1;
                  }
                  .dashed-ring.success {
                    border-color: #10b981;
                    animation: borderRotate 30s linear infinite;
                    opacity: 0.9;
                  }
                  .dashed-ring.error {
                    border-color: #ef4444;
                    animation: none;
                    opacity: 0.9;
                  }
                `}</style>
                
                <div 
                  onClick={() => !checkingFace && fileRef.current?.click()}
                  onMouseEnter={() => setAvatarHovered(true)}
                  onMouseLeave={() => setAvatarHovered(false)}
                  style={{
                    width: 150, height: 150, borderRadius: '50%',
                    background: 'var(--surface-2)', 
                    border: `2px solid ${faceSuccess ? '#10b981' : (faceError ? '#ef4444' : (checkingFace ? 'var(--accent)' : 'var(--border-3)'))}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'visible', flexShrink: 0,
                    position: 'relative',
                    cursor: checkingFace ? 'wait' : 'pointer',
                    boxShadow: faceSuccess ? '0 0 18px rgba(16, 185, 129, 0.5)' : (faceError ? '0 0 18px rgba(239, 68, 68, 0.5)' : (checkingFace ? '0 0 18px rgba(0, 120, 212, 0.4)' : 'none')),
                    animation: faceSuccess ? 'pulseGreen 2s infinite' : (faceError ? 'avatarShake 0.4s ease, pulseRed 2s infinite' : 'none'),
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {/* Dashed outer ring */}
                  <div className={`dashed-ring ${checkingFace ? 'checking' : (faceSuccess ? 'success' : (faceError ? 'error' : ''))}`} />
                  
                  {/* Inside circle container with overflow hidden */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--surface-1)'
                  }}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImagePreview('')} />
                    ) : (
                      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 75, height: 75, opacity: 0.35, color: 'var(--text-3)' }}>
                        <path d="M50,15 C35,15 25,25 25,45 C25,65 32,75 50,85 C68,75 75,65 75,45 C75,25 65,15 50,15 Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="38" cy="42" r="3.5" fill="currentColor"/>
                        <circle cx="62" cy="42" r="3.5" fill="currentColor"/>
                        <path d="M50,42 L50,54 L46,54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M42,65 Q50,69 58,65" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <ellipse cx="50" cy="50" rx="43" ry="43" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.4"/>
                      </svg>
                    )}

                    {/* Face scanning loader overlay */}
                    {checkingFace && (
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(10, 15, 28, 0.82)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 600, gap: 8, zIndex: 10,
                        backdropFilter: 'blur(3px)'
                      }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, height: '4px',
                          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                          boxShadow: '0 0 10px var(--accent), 0 0 20px var(--accent)',
                          animation: 'avatarScan 2s infinite linear'
                        }} />
                        <ArrowSyncRegular fontSize={22} style={{ animation: 'spin 1.2s linear infinite', color: 'var(--accent)' }} />
                        <span style={{ fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent)' }}>
                          {isRu ? 'Анализ...' : 'Tekshirilmoqda...'}
                        </span>
                      </div>
                    )}

                    {/* Pro-level hover edit overlay */}
                    {!checkingFace && avatarHovered && (
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.65)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 600, gap: 6,
                        animation: 'fadeIn 0.25s ease',
                        zIndex: 5,
                        backdropFilter: 'blur(1px)'
                      }}>
                        <CameraRegular fontSize={24} style={{ color: '#fff' }} />
                        <span style={{ fontSize: 10, letterSpacing: '0.5px' }}>
                          {imagePreview ? (isRu ? 'Изменить' : 'O\'zgartirish') : (isRu ? 'Загрузить' : 'Yuklash')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <input type="file" ref={fileRef} accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    type="button" 
                    onClick={() => !checkingFace && fileRef.current?.click()} 
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 8,
                      background: 'var(--accent-bg)', color: 'var(--accent-tx)',
                      border: '1px solid var(--accent-bd)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
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
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-bg)'; e.currentTarget.style.opacity = '0.9' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '1' }}
                    >
                      <DismissRegular fontSize={13} />
                      {isRu ? 'Удалить' : "O'chirish"}
                    </button>
                  )}
                </div>

                {/* Photo Guidelines block */}
                <div style={{
                  marginTop: 8,
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-2)',
                  width: '100%',
                  fontSize: 11,
                  lineHeight: '1.6',
                  color: 'var(--text-2)',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckmarkCircleRegular fontSize={14} style={{ color: '#10b981' }} />
                    {isRu ? 'Требования к фотографии:' : 'Sifatsiz rasm yuklash taqiqlanadi:'}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>{isRu ? 'Лицо должно быть по центру' : 'Inson yuzi markazda va to\'g\'riga qaragan bo\'lishi kerak'}</li>
                    <li>{isRu ? 'Хорошее освещение, без размытия' : 'Rasm tiniq va yaxshi yoritilgan bo\'lishi shart'}</li>
                    <li>{isRu ? 'Однотонный светлый фон предпочтителен' : 'Yuzda soyalar bo\'lmasligi va rasm sifatsiz bo\'lmasligi kerak'}</li>
                  </ul>
                </div>
              </div>
            </Section>

            {/* 4. Kameralar */}
            <Section
              kicker={isRu ? 'Камеры' : 'Kameralar'}
              title={isRu ? 'Доступ к камерам' : 'Kameralarga ruxsat'}
              hint={isRu
                ? 'Сотрудник будет добавлен в выбранные камеры после сохранения.'
                : "Saqlangach xodim tanlangan kameralarga qo'shiladi."}
            >
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-3)' }}>
                {cameraSelected} / {camerasOfOrg.length} {isRu ? 'выбрано' : 'tanlangan'}
              </div>
              {camerasOfOrg.length === 0 ? (
                <div style={{ color: 'var(--text-4)', fontSize: 13 }}>
                  {form.organization_id
                    ? (isRu ? 'У выбранной организации нет камер' : "Tanlangan tashkilotda kamera yo'q")
                    : (isRu ? 'Сначала выберите организацию' : "Avval tashkilotni tanlang")}
                </div>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 8, maxHeight: 240, overflowY: 'auto',
                  padding: 8, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  {camerasOfOrg.map(c => {
                    const checked = form.camera_ids.includes(Number(c.id))
                    return (
                      <label key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 7,
                        background: checked ? 'var(--accent-bg)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--accent-bd)' : 'var(--border-2)'}`,
                        cursor: 'pointer', fontSize: 13,
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCamera(Number(c.id))} style={{ accentColor: 'var(--accent)' }} />
                        <CameraRegular fontSize={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </Section>
          </aside>
        </div>

        {/* Action bar */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)',
        }}>
          <button type="button" onClick={() => navigate(backPath)} disabled={saving} style={btnStyle('subtle')}>
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

      {showAddOrgModal && (
        <Modal
          title={isRu ? 'Добавить организацию' : 'Yangi tashkilot qo\'shish'}
          onClose={() => setShowAddOrgModal(false)}
        >
          <form onSubmit={handleAddOrg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={isRu ? 'Название организации' : 'Tashkilot nomi'} required>
              <input
                type="text"
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                placeholder={isRu ? 'Например: Школа №10' : 'Masalan: 10-maktab'}
                style={inpStyle}
                required
              />
            </Field>

            <Field label={isRu ? 'Тип организации' : 'Tashkilot turi'} required>
              <CustomSelect
                value={newOrgType}
                onChange={setNewOrgType}
                options={orgTypes.map(t => ({ value: t.value, label: t.label }))}
                placeholder={isRu ? 'Выберите тип' : 'Turini tanlang'}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={isRu ? 'Начало работы (по умолчанию)' : 'Ish boshlanishi (standart)'} required>
                <input
                  type="time"
                  value={newOrgStartTime}
                  onChange={e => setNewOrgStartTime(e.target.value)}
                  style={inpStyle}
                  required
                />
              </Field>
              <Field label={isRu ? 'Конец работы (по умолчанию)' : 'Ish tugashi (standart)'} required>
                <input
                  type="time"
                  value={newOrgEndTime}
                  onChange={e => setNewOrgEndTime(e.target.value)}
                  style={inpStyle}
                  required
                />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setShowAddOrgModal(false)} style={smallBtn('subtle')}>
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button type="submit" style={smallBtn('accent')}>
                <CheckmarkRegular fontSize={14} />
                {isRu ? 'Добавить' : 'Qo\'shish'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAddDeptModal && (
        <Modal
          title={getDeptAddTitle()}
          onClose={() => setShowAddDeptModal(false)}
        >
          <form onSubmit={handleAddDept} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={getDeptInputLabel()} required>
              <input
                type="text"
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                placeholder={getDeptInputPlaceholder()}
                style={inpStyle}
                required
              />
            </Field>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setShowAddDeptModal(false)} style={smallBtn('subtle')}>
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button type="submit" style={smallBtn('accent')}>
                <CheckmarkRegular fontSize={14} />
                {isRu ? 'Добавить' : 'Qo\'shish'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAddPosModal && (
        <Modal
          title={getPosAddTitle()}
          onClose={() => setShowAddPosModal(false)}
        >
          <form onSubmit={handleAddPos} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={getPosInputLabel()} required>
              <input
                type="text"
                value={newPosName}
                onChange={e => setNewPosName(e.target.value)}
                placeholder={getPosInputPlaceholder()}
                style={inpStyle}
                required
              />
            </Field>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setShowAddPosModal(false)} style={smallBtn('subtle')}>
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button type="submit" style={smallBtn('accent')}>
                <CheckmarkRegular fontSize={14} />
                {isRu ? 'Добавить' : 'Qo\'shish'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showFaceSelector && faceSelectionData && (
        <Modal
          title={isRu ? 'Выберите лицо сотрудника' : 'Xodimning yuzini tanlang'}
          onClose={handleCancelFaceSelection}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: '1.5' }}>
              {isRu 
                ? 'На изображении обнаружено несколько лиц. Пожалуйста, выберите лицо сотрудника для обрезки:' 
                : 'Yuklangan rasmda bir nechta yuzlar aniqlandi. Iltimos, xodimning yuzini tanlang:'}
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
              padding: '10px 0',
              maxHeight: 320,
              overflowY: 'auto'
            }}>
              {faceSelectionData.faces.map((face, index) => (
                <FaceThumbnail
                  key={index}
                  img={faceSelectionData.img}
                  face={face}
                  w={faceSelectionData.w}
                  h={faceSelectionData.h}
                  onClick={() => {
                    cropSelectedFace(
                      face,
                      faceSelectionData.img,
                      faceSelectionData.w,
                      faceSelectionData.h,
                      faceSelectionData.file
                    );
                    setFaceSelectionData(null);
                    setShowFaceSelector(false);
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button 
                type="button" 
                onClick={handleCancelFaceSelection} 
                style={smallBtn('subtle')}
              >
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
    )
  } catch (err) {
    console.error("Render error in EmployeeForm:", err)
    return (
      <div style={{ padding: 32, background: 'var(--bg)', color: 'var(--red)', minHeight: '100vh' }}>
        <h2 style={{ color: '#f43f5e', marginBottom: 12 }}>⚠️ Render Error in EmployeeForm</h2>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
          {err.stack || err.message}
        </div>
        <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          Reload Page
        </button>
      </div>
    )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function Section({ kicker, title, hint, children }) {
  return (
    <section style={cardStyle}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-tx)', textTransform: 'uppercase', letterSpacing: 0.7 }}>{kicker}</div>
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
  height: 36,
}
const heroBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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

function smallBtn(kind) {
  const map = {
    accent: { bg: 'var(--accent)', color: '#fff' },
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 12px', borderRadius: 7,
    background: t.bg, color: t.color,
    border: t.border || 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    minWidth: 36, height: 36, flexShrink: 0,
  }
}

function Modal({ title, onClose, children }) {
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
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
            <DismissRegular fontSize={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FaceThumbnail({ img, face, w, h, onClick }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !img) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const scaleX = img.width / w;
    const scaleY = img.height / h;

    const fx = face.x * scaleX;
    const fy = face.y * scaleY;
    const fw = face.width * scaleX;
    const fh = face.height * scaleY;

    // Passport style crop for the thumbnail preview (3:4 ratio)
    let cropW = fw * 2.2;
    let cropH = cropW * 1.333;
    let cropX = fx - (cropW - fw) / 2;
    let cropY = fy - fh * 0.5;

    if (cropX < 0) cropX = 0;
    if (cropY < 0) cropY = 0;
    if (cropX + cropW > img.width) cropW = img.width - cropX;
    if (cropY + cropH > img.height) cropH = img.height - cropY;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    try {
      ctx.drawImage(
        img,
        cropX, cropY, cropW, cropH,
        0, 0, canvas.width, canvas.height
      );
    } catch (e) {
      console.error(e);
    }
  }, [img, face, w, h]);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '2px solid var(--border-3)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--surface-2)',
        cursor: 'pointer',
        padding: 0,
        width: 100,
        height: 133,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 120, 212, 0.25)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-3)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
      }}
    >
      <canvas ref={canvasRef} width={96} height={128} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
      {/* Zoom / Pick icon badge */}
      <div style={{
        position: 'absolute', right: 6, bottom: 6, width: 20, height: 20, borderRadius: '50%',
        background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 11, fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        ✓
      </div>
    </button>
  );
}
