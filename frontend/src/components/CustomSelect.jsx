import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDownRegular, CheckmarkRegular, DismissRegular } from '@fluentui/react-icons'

export default function CustomSelect({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const ref = useRef(null)

  const selectedOption = useMemo(() => options.find(o => String(o.value) === String(value)), [options, value])

  // Sync search input with selected option label when not typing or when value changes
  useEffect(() => {
    if (!isFocused) {
      setSearch(selectedOption ? selectedOption.label : '')
    }
  }, [selectedOption, isFocused])

  // Click outside handler
  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const filteredOptions = useMemo(() => {
    const query = isFocused ? search.trim().toLowerCase() : ''
    // If search matches selected option label, don't filter unless they edited it.
    if (selectedOption && query === selectedOption.label.toLowerCase()) {
      return options
    }
    if (!query) return options
    return options.filter(o => String(o.label).toLowerCase().includes(query))
  }, [options, search, isFocused, selectedOption])

  const handleInputFocus = () => {
    if (disabled) return
    setIsFocused(true)
    setOpen(true)
  }

  const handleOptionClick = (opt) => {
    setOpen(false)
    setIsFocused(false)
    setSearch(opt.label)
    onChange(opt.value)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setSearch('')
    setOpen(false)
    setIsFocused(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: disabled ? 'var(--surface-2)' : 'var(--bg)',
          border: '1px solid',
          borderColor: open ? 'var(--accent)' : 'var(--border-3)',
          borderRadius: 9,
          padding: '0 12px',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          opacity: disabled ? 0.6 : 1,
          boxShadow: open ? '0 0 0 2px rgba(0, 120, 212, 0.15)' : 'none',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onClick={() => !disabled && handleInputFocus()}
      >
        <input
          type="text"
          disabled={disabled}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={handleInputFocus}
          placeholder={placeholder || '— Tanlang —'}
          style={{
            flex: 1,
            padding: '9px 0',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--text-1)',
            cursor: disabled ? 'not-allowed' : 'text',
            width: '100%',
          }}
        />
        
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--text-4)',
              display: 'flex',
              alignItems: 'center',
              marginRight: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-2)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}
          >
            <DismissRegular fontSize={12} />
          </button>
        )}

        <ChevronDownRegular
          fontSize={14}
          style={{
            color: 'var(--text-4)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            if (disabled) return
            e.stopPropagation()
            setOpen(prev => !prev)
          }}
        />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          marginTop: 6, zIndex: 1000,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 6,
          boxShadow: 'var(--shadow)',
          animation: 'slideDownSelect 0.15s cubic-bezier(0,0,0,1)',
        }}>
          <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
            {filteredOptions.length === 0 && (
              <div style={{ padding: '12px', color: 'var(--text-4)', fontSize: 13, textAlign: 'center' }}>
                Hech narsa topilmadi
              </div>
            )}
            {filteredOptions.map((opt) => {
              const active = String(opt.value) === String(value)
              return (
                <div
                  key={opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleOptionClick(opt)
                  }}
                  style={{
                    padding: '9px 12px', borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', fontSize: 13,
                    background: active ? 'var(--accent-bg)' : 'transparent',
                    color: active ? 'var(--accent-tx)' : 'var(--text-1)',
                    fontWeight: active ? 600 : 400,
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {active && <CheckmarkRegular fontSize={14} color="var(--accent-tx)" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDownSelect {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale1; }
        }
      `}</style>
    </div>
  )
}
