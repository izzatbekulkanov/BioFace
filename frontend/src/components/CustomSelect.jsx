import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDownRegular, CheckmarkRegular, SearchRegular } from '@fluentui/react-icons'

export default function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  // Clicking outside to close
  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // Clear search when closed
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const selectedOption = options.find(o => o.value === value)
  
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const lower = search.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(lower))
  }, [options, search])

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '9px 12px',
          background: 'var(--bg)', border: '1px solid',
          borderColor: open ? 'var(--accent)' : 'var(--border-3)',
          borderRadius: 9, color: selectedOption ? 'var(--text-1)' : 'var(--text-4)',
          fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', outline: 'none', transition: 'border-color 0.2s',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : (placeholder || '— Tanlang —')}
        </span>
        <ChevronDownRegular
          fontSize={16}
          style={{
            color: 'var(--text-4)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          marginTop: 6, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 6,
          boxShadow: 'var(--shadow)',
          animation: 'slideDownSelect 0.15s cubic-bezier(0,0,0,1)',
        }}>
          {/* Search Input */}
          <div style={{ padding: '4px 6px', marginBottom: 6 }}>
            <div style={{ position: 'relative' }}>
              <SearchRegular fontSize={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Qidirish..."
                style={{
                  width: '100%', padding: '7px 10px 7px 30px',
                  background: 'var(--bg)', border: '1px solid var(--border-3)',
                  borderRadius: 6, color: 'var(--text-1)', fontSize: 13,
                  outline: 'none', boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-3)'}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
            {filteredOptions.length === 0 && (
              <div style={{ padding: '12px', color: 'var(--text-4)', fontSize: 13, textAlign: 'center' }}>
                Hech narsa topilmadi
              </div>
            )}
            {filteredOptions.map((opt) => {
              const active = opt.value === value
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
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
          from { opacity: 0; transform: translateY(-4px) scale0.98; }
          to { opacity: 1; transform: translateY(0) scale1; }
        }
      `}</style>
    </div>
  )
}
