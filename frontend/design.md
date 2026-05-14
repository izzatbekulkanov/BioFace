# BioFace — Frontend Design System

Ushbu hujjat BioFace React frontendidagi barcha dizayn qoidalari, tokenlar, komponent patternlari va kutubxonalarni tavsiflaydi. Yangi sahifalar yoki komponentlar qo'shishdan oldin shu faylni o'qing.

---

## 1. Tech Stack

| Vazifa | Kutubxona |
|--------|-----------|
| UI Framework | [Microsoft Fluent UI v9](https://react.fluentui.dev/) — `@fluentui/react-components` |
| Ikonkalar | `@fluentui/react-icons` (Regular variant) |
| Routing | `react-router-dom` v7 |
| Multilanguage | `i18next` + `react-i18next` + `i18next-browser-languagedetector` |
| Dark/Light theme | `next-themes` |
| Xarita | `leaflet` + `react-leaflet` |
| Build | Vite + React SWC |

---

## 2. Theme System

### Kutubxona: `next-themes`

```jsx
// main.jsx
<ThemeProvider
  attribute="data-theme"   // html[data-theme="dark|light"]
  defaultTheme="dark"
  storageKey="bf_theme"    // localStorage
  enableSystem={false}
>
```

### Komponentlarda ishlatish

```jsx
import { useTheme } from 'next-themes'

const { resolvedTheme, setTheme } = useTheme()
const isDark = resolvedTheme === 'dark'

// Toggle
setTheme(isDark ? 'light' : 'dark')
```

### Fluent UI sinxronizatsiyasi

`App.jsx` dagi `FluentSync` komponenti `resolvedTheme` ga qarab `webDarkTheme` yoki `webLightTheme` ni `FluentProvider` ga uzatadi.

---

## 3. CSS Tokens (Design Tokens)

Barcha ranglar `index.css` da CSS custom properties sifatida belgilangan. Komponentlarda **hech qachon qattiq hex qiymat yozmang** — `var(--token)` ishlating.

### Struktura tokenlar

| Token | Dark | Light | Vazifa |
|-------|------|-------|--------|
| `--bg` | `#0f0f0f` | `#f3f2f1` | Sahifa asosiy foni |
| `--nav` | `#141414` | `#ffffff` | Navbar foni |
| `--surface` | `#181818` | `#ffffff` | Karta / panel foni |
| `--surface-2` | `#1e1e1e` | `#faf9f8` | Hover, ichki elementlar |
| `--surface-3` | `#111111` | `#f8f7f6` | Eng ichki qatlam |
| `--border` | `#252525` | `#e1dfdd` | Asosiy border |
| `--border-2` | `#2a2a2a` | `#edebe9` | Ikkinchi darajali border |
| `--border-3` | `#2e2e2e` | `#d2d0ce` | Hover border |

### Matn tokenlar

| Token | Dark | Light | Vazifa |
|-------|------|-------|--------|
| `--text-1` | `#e0e0e0` | `#323130` | Asosiy matn |
| `--text-2` | `#adadad` | `#605e5c` | Ikkinchi darajali matn |
| `--text-3` | `#888888` | `#797775` | Sust matn |
| `--text-4` | `#555555` | `#a19f9d` | Label, caption |
| `--text-5` | `#444444` | `#bebbb8` | Eng sust |
| `--white` | `#ffffff` | `#323130` | Sarlavhalar (har doim kontrast) |

### Accent tokenlar

| Token | Dark | Light | Vazifa |
|-------|------|-------|--------|
| `--accent` | `#0078d4` | `#0078d4` | Microsoft Blue (o'zgarmaydi) |
| `--accent-h` | `#106ebe` | `#106ebe` | Hover holati |
| `--accent-bg` | `#1a2c40` | `#eff6fc` | Tinted fon |
| `--accent-bd` | `#1f3a5f` | `#c7e0f4` | Tinted border |
| `--accent-tx` | `#479ef5` | `#0078d4` | Accent matn |

### Holat tokenlar

| Token | Dark | Light | Vazifa |
|-------|------|-------|--------|
| `--green` | `#4ade80` | `#107c10` | Online, present, success |
| `--green-bg` | `#1a2e1a` | `#eef7ee` | Green tinted fon |
| `--green-bd` | `#2a4a2a` | `#bad3ba` | Green tinted border |
| `--red` | `#f87171` | `#d13438` | Offline, absent, error |
| `--red-bg` | `#2e1a1a` | `#fde7e9` | Red tinted fon |
| `--red-bd` | `#4a2a2a` | `#f4b8bb` | Red tinted border |
| `--yellow` | `#fbbf24` | `#835b00` | Late, warning, pending |
| `--yellow-bg` | `#2a2a1a` | `#fff4ce` | Yellow tinted fon |
| `--yellow-bd` | `#4a4a1a` | `#f7d98d` | Yellow tinted border |

### Input tokenlar

| Token | Dark | Light |
|-------|------|-------|
| `--input-bg` | `#1e1e1e` | `#ffffff` |
| `--input-bd` | `#2e2e2e` | `#e1dfdd` |

### Shadow va scroll

| Token | Dark | Light |
|-------|------|-------|
| `--shadow` | `0 8px 40px rgba(0,0,0,0.6)` | `0 4px 24px rgba(0,0,0,0.10)` |
| `--shadow-sm` | `0 2px 12px rgba(0,0,0,0.4)` | `0 2px 8px rgba(0,0,0,0.07)` |
| `--scroll-thumb` | `#2e2e2e` | `#d2d0ce` |

---

## 4. Rang Paleti (Brand Colors)

Ikonka va accent uchun ishlatiladigan 4 ta brand rangi:

```js
const BRAND_COLORS = [
  '#0078d4',  // Microsoft Blue   — primary
  '#038387',  // Teal             — secondary
  '#6264a7',  // Purple           — tertiary
  '#8764b8',  // Violet           — quaternary
]
```

Fon va border uchun alpha versiyalari:

```js
color + '18'  // ~9.4% opacity  — icon background
color + '30'  // ~19% opacity   — icon border
color + '44'  // ~27% opacity   — hover border
color + '55'  // ~33% opacity   — active border
```

---

## 5. Komponent Patternlari

### 5.1 Karta (Card)

Barcha karta komponentlari quyidagi base stildan foydalanadi:

```jsx
const cardStyle = {
  background:   'var(--surface)',
  border:       '1px solid var(--border)',
  borderRadius: 12,          // standart: 12px, katta: 14px
  padding:      '20px',
}

// Hover effekti
onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-bd)'}
onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
```

### 5.2 Sarlavha Badge

Sahifa yuqorisidagi tag badge:

```jsx
<div style={{
  display: 'inline-block',
  background: 'var(--accent-bg)',
  border: '1px solid var(--accent-bd)',
  borderRadius: 100,
  padding: '4px 14px',
  fontSize: 12,
  color: 'var(--accent-tx)',
}}>
  ✦ {t('page.heading')}
</div>
```

### 5.3 Ikonka konteyner

```jsx
// Kichik (36×36) — karta ichida
const iconBox = {
  width: 36, height: 36, borderRadius: 9,
  background: color + '18',
  border: `1px solid ${color}30`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color,
}

// O'rta (42×42) — stat card
const iconBoxMd = {
  width: 42, height: 42, borderRadius: 10,
  // ...same pattern
}
```

### 5.4 Tugma (Button)

**Primary:**
```jsx
<button style={{
  padding: '9px 20px', borderRadius: 7,
  background: 'var(--accent)', border: 'none',
  color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
}}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-h)'}
  onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
/>
```

**Ghost (outline):**
```jsx
<button style={{
  padding: '9px 20px', borderRadius: 7,
  background: 'var(--accent-bg)',
  border: '1px solid var(--accent-bd)',
  color: 'var(--accent-tx)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
}}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bd)'}
  onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-bg)'}
/>
```

**Danger (logout/delete):**
```jsx
<button style={{
  border: '1px solid var(--red-bd-2)',
  background: 'var(--red-bg-2)',
  color: 'var(--red)',
}}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--red-bg)'}
  onMouseLeave={e => e.currentTarget.style.background = 'var(--red-bg-2)'}
/>
```

**Subtle (secondary):**
```jsx
<button style={{
  background: 'var(--surface-2)',
  border: '1px solid var(--border-3)',
  color: 'var(--text-3)',
}}
  onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--text-1)' }}
  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-3)' }}
/>
```

### 5.5 Input maydoni

```jsx
<input style={{
  width: '100%', padding: '10px 13px',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-bd)',
  borderRadius: 8, color: 'var(--text-1)',
  fontSize: 14, outline: 'none',
}}
  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
  onBlur={e => e.target.style.borderColor = 'var(--input-bd)'}
/>
```

### 5.6 Section sarlavhasi

```jsx
const sectionTitle = {
  fontSize: 14, fontWeight: 700,
  color: 'var(--text-1)',
  marginBottom: 16,
  display: 'flex', alignItems: 'center', gap: 8,
  textTransform: 'uppercase', letterSpacing: 0.5,
}
// Odatda <Icon /> + matn birga
```

### 5.7 Status Badge (subscription)

```jsx
// active | pending | expired
const SUB_STYLE = {
  active:  { bg: 'var(--green-bg)',  border: 'var(--green-bd)',  text: 'var(--green)'  },
  pending: { bg: 'var(--yellow-bg)', border: 'var(--yellow-bd)', text: 'var(--yellow)' },
  expired: { bg: 'var(--red-bg)',    border: 'var(--red-bd)',    text: 'var(--red)'    },
}
```

---

## 6. Layout

### Sahifa wrapper

```jsx
<div style={{
  minHeight: 'calc(100vh - 52px)',   // Navbar: 52px
  background: 'var(--bg)',
  color: 'var(--text-1)',
  padding: '32px 24px 80px',
  overflowY: 'auto',
}}>
  <div style={{ maxWidth: 1200, margin: '0 auto' }}>
    {/* content */}
  </div>
</div>
```

### Grid patternlar

```jsx
// Stat kartalar — responsive
gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'

// Org kartalar
gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'

// 2 ustunli sahifa (Contact, Dashboard sidebar)
gridTemplateColumns: '1fr 280px'   // asosiy + sidebar

// 4 ustunli grid (howItWorks, audience)
gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'

// 2 ustunli grid (problems, stack)
gridTemplateColumns: '1fr 1fr'
```

### Navbar

- Balandligi: `52px`
- Sticky, `zIndex: 200`
- `background: var(--nav)`, `borderBottom: 1px solid var(--border)`

---

## 7. Tipografiya

| Element | fontSize | fontWeight | color |
|---------|----------|------------|-------|
| H1 (sahifa) | `30px` | `800` | `var(--white)` |
| H1 (section) | `26px` | `800` | `var(--white)` |
| H2 | `20–22px` | `700` | `var(--white)` |
| Section title | `14px` | `700` | `var(--text-1)` |
| Card title | `14px` | `700` | `var(--text-1)` |
| Body text | `13–14px` | `400` | `var(--text-1)` |
| Description | `12–13px` | `400` | `var(--text-4)`, `lineHeight: 1.6` |
| Label / Caption | `11–12px` | `400–600` | `var(--text-3)` |
| Stat value (big) | `26px` | `800` | `var(--white)`, `letterSpacing: -1` |
| Stat value (mid) | `18–22px` | `700–800` | brand color |

Font: `'Segoe UI', system-ui, -apple-system, sans-serif` (index.css)

---

## 8. Multilanguage (i18n)

### Kutubxona: `i18next` + `react-i18next`

```js
// i18n.js — detection tartibi
detection: {
  order: ['localStorage', 'navigator'],
  lookupLocalStorage: 'bf_lang',
}
```

### Komponentlarda ishlatish

```jsx
import { useTranslation } from 'react-i18next'

const { t, i18n } = useTranslation()

t('dashboard.title')           // → "Boshqaruv Paneli" (uz)
t('dashboard.title')           // → "Управление" (ru)

// Til o'zgartirish
i18n.changeLanguage('ru')
localStorage.setItem('bf_lang', 'ru')
document.cookie = `lang=ru;path=/;max-age=31536000`  // backend cookie
```

### Tarjima fayllari

```
src/locales/
  uz/translation.json    ← O'zbek
  ru/translation.json    ← Rus
```

### Namespace strukturasi

```json
{
  "nav":       { "map", "about", "contact", "dashboard", "login", "logout", "themeLight", "themeDark" },
  "login":     { "subtitle", "username", "password", "submit", "loading", "or", "google", ... },
  "dashboard": { "title", "subtitle", "refresh", "orgs", "employees", "cameras", ... },
  "about":     { "heading", "sub", "howTitle", "steps", "problems", "audience", "stats", ... },
  "contact":   { "heading", "name", "email", "phone", "address", "message", "send", ... },
  "map":       { "devices", "refresh", "lastSeen", "online", "offline" }
}
```

> ⚠️ Yangi sahifa uchun har doim **ikkala faylga** (uz va ru) tarjima qo'shing.

---

## 9. Ikonkalar

**Faqat** `@fluentui/react-icons` dan, **Regular** variantni ishlating:

```jsx
import {
  BuildingRegular,
  CameraRegular,
  PeopleRegular,
  PersonRegular,
  ShieldLockRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ClockRegular,
  GridRegular,          // Dashboard nav
  MapRegular,           // Xarita nav
  InfoRegular,          // Haqida nav
  MailRegular,          // Aloqa nav
  SignOutRegular,       // Logout
  WeatherSunnyRegular,  // Light mode toggle
  WeatherMoonRegular,   // Dark mode toggle
  ArrowSyncRegular,     // Refresh
  ArrowRightRegular,    // CTA / more
  Wifi4Regular,         // Online kamera
  WifiWarningRegular,   // Offline kamera
} from '@fluentui/react-icons'
```

**Standart o'lchamlar:** `fontSize={14}` (nav), `fontSize={17-18}` (karta ikonka), `fontSize={20}` (stat card), `fontSize={28}` (hero)

---

## 10. Animatsiyalar

### CSS transition (barcha tokenlar uchun global)
`index.css` da barcha elementlarga avtomatik qo'llanadi:
```css
transition-property: background-color, border-color, color, box-shadow;
transition-duration: 0.18s;
```

### Spinner (yuklash)
```jsx
import { Spinner } from '@fluentui/react-components'
<Spinner size="small" />              // sahifa yuklash
<Spinner size="tiny" appearance="inverted" />  // tugma ichida
```

### Rotate animatsiyasi (refresh)
```jsx
<style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
<ArrowSyncRegular style={{ animation: spin ? 'spin 0.6s linear infinite' : 'none' }} />
```

### Attendance progress bar
```jsx
transition: 'width 0.6s ease'
```

---

## 11. Sahifalar Ro'yxati

| Route | Fayl | Public/Private |
|-------|------|----------------|
| `/login` | `pages/Login.jsx` | Public |
| `/about` | `pages/About.jsx` | Public |
| `/contact` | `pages/Contact.jsx` | Public |
| `/map` | `pages/MapView.jsx` | Public |
| `/dashboard` | `pages/Dashboard.jsx` | **Private** (login kerak) |

> Login bo'lmaganda Navbar da: Xarita, Haqida, Aloqa  
> Login bo'lganda Navbar da: **faqat** Dashboard + Chiqish

---

## 12. Yangi Sahifa Qo'shish — Checklist

- [ ] `src/pages/NewPage.jsx` yaratish
- [ ] `useTranslation()` import qilish — `lang` prop **uzatmang**
- [ ] Barcha matnlarni `src/locales/uz/translation.json` va `ru/translation.json` ga qo'shish
- [ ] Ranglarni `var(--token)` orqali ishlatish — hardcoded hex **yozmang**
- [ ] Sahifa wrapper: `background: 'var(--bg)'`, `padding: '32px 24px 80px'`
- [ ] Kartalar: `background: 'var(--surface)'`, `border: '1px solid var(--border)'`, `borderRadius: 12`
- [ ] Hover: `onMouseEnter/onMouseLeave` bilan `var(--accent-bd)` border
- [ ] `App.jsx` da `<Route path="/new-page" element={<NewPage />} />`
- [ ] `backend/main.py` da `@app.get("/new-page")` qo'shish (SPA serve uchun)
- [ ] Agar private sahifa bo'lsa: `isLoggedIn ? <NewPage /> : <Navigate to="/login" />`

---

## 13. Fayllar Strukturasi

```
frontend/src/
├── i18n.js                      # i18next konfiguratsiya
├── index.css                    # CSS tokens (dark/light), global styles
├── main.jsx                     # ThemeProvider (next-themes) + i18n init
├── App.jsx                      # Routing + FluentSync
├── locales/
│   ├── uz/translation.json      # O'zbek tarjimalar
│   └── ru/translation.json      # Rus tarjimalar
├── components/
│   └── Navbar.jsx               # Global nav + theme/lang toggles
└── pages/
    ├── Login.jsx
    ├── About.jsx
    ├── Contact.jsx
    ├── MapView.jsx
    └── Dashboard.jsx
```
