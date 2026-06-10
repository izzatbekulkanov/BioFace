/**
 * RichEditor — Custom Markdown toolbar + textarea + preview
 * Tashqi kutubxonasiz, o'z ichiga olgan komponent.
 */
import { useState, useRef, useCallback } from 'react'

const TOOLBAR = [
  { icon: 'H1', title: 'Sarlavha 1', wrap: ['# ', ''] },
  { icon: 'H2', title: 'Sarlavha 2', wrap: ['## ', ''] },
  { icon: 'H3', title: 'Sarlavha 3', wrap: ['### ', ''] },
  { sep: true },
  { icon: 'B',  title: 'Bold',       wrap: ['**', '**'],   style: { fontWeight: 700 } },
  { icon: 'I',  title: 'Italic',     wrap: ['_', '_'],     style: { fontStyle: 'italic' } },
  { icon: '~~', title: 'Strikethrough', wrap: ['~~', '~~'] },
  { icon: '`',  title: 'Inline code', wrap: ['`', '`'],   style: { fontFamily: 'monospace' } },
  { sep: true },
  { icon: '•',  title: 'Bullet list', prefix: '- ' },
  { icon: '1.', title: 'Numbered list', prefix: '1. ' },
  { icon: '[ ]',title: 'Checkbox',    prefix: '- [ ] ' },
  { sep: true },
  { icon: '```',title: 'Code block',  block: '```\n{selection}\n```' },
  { icon: '—',  title: 'Divider',     insert: '\n---\n' },
  { icon: '🔗', title: 'Link',        block: '[{selection}](url)' },
]

// Very lightweight Markdown → HTML renderer
function mdToHtml(md = '') {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // code blocks
    .replace(/```([\s\S]*?)```/g, (_, c) => `<pre style="background:var(--bg);padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;border:1px solid var(--border)"><code>${c.trim()}</code></pre>`)
    // headings
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:14px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:17px;font-weight:700;margin:16px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:20px;font-weight:800;margin:18px 0 10px">$1</h1>')
    // hr
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0"/>')
    // checkboxes
    .replace(/^- \[x\] (.+)$/gm, '<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="color:#10b981;font-size:16px">✅</span><span style="text-decoration:line-through;color:var(--text-3)">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm,'<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="font-size:16px">⬜</span><span>$1</span></div>')
    // bullet lists
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
    // numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:3px 0;list-style-type:decimal;padding-left:4px">$1</li>')
    // wrap consecutive <li> items
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul style="padding-left:20px;margin:8px 0">${m}</ul>`)
    // bold, italic, strikethrough, inline code, links
    .replace(/\*\*(.+?)\*\*/g,  '<strong>$1</strong>')
    .replace(/_(.+?)_/g,        '<em>$1</em>')
    .replace(/~~(.+?)~~/g,      '<del>$1</del>')
    .replace(/`(.+?)`/g,        '<code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:12px;font-family:monospace;border:1px solid var(--border)">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#818cf8;text-decoration:underline" target="_blank">$1</a>')
    // paragraphs
    .replace(/\n\n+/g, '</p><p style="margin:8px 0">')
    .replace(/\n/g, '<br/>')
  return `<p style="margin:8px 0">${html}</p>`
}

export default function RichEditor({ value = '', onChange, placeholder = '', minRows = 10 }) {
  const [tab, setTab] = useState('write')  // 'write' | 'preview'
  const taRef = useRef(null)

  const insert = useCallback((item) => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const sel   = value.slice(start, end)
    let newVal, cursor

    if (item.insert) {
      newVal = value.slice(0, start) + item.insert + value.slice(end)
      cursor = start + item.insert.length
    } else if (item.prefix) {
      // prefix each selected line
      const lines = sel ? sel.split('\n').map(l => item.prefix + l).join('\n') : item.prefix
      newVal = value.slice(0, start) + lines + value.slice(end)
      cursor = start + lines.length
    } else if (item.block) {
      const replaced = item.block.replace('{selection}', sel || 'text')
      newVal = value.slice(0, start) + replaced + value.slice(end)
      cursor = start + replaced.length
    } else if (item.wrap) {
      const [pre, post] = item.wrap
      if (sel) {
        newVal = value.slice(0, start) + pre + sel + post + value.slice(end)
        cursor = start + pre.length + sel.length + post.length
      } else {
        newVal = value.slice(0, start) + pre + post + value.slice(end)
        cursor = start + pre.length
      }
    } else return

    onChange(newVal)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(cursor, cursor) }, 0)
  }, [value, onChange])

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10,
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '6px 10px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexWrap: 'wrap',
      }}>
        {TOOLBAR.map((item, i) =>
          item.sep
            ? <div key={i} style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
            : (
              <button
                key={i}
                type="button"
                title={item.title}
                onClick={() => { setTab('write'); insert(item) }}
                style={{
                  padding: '3px 7px', borderRadius: 6,
                  background: 'transparent', border: '1px solid transparent',
                  color: 'var(--text-2)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: item.style?.fontFamily || 'inherit',
                  fontStyle: item.style?.fontStyle,
                  fontWeight: item.style?.fontWeight || 600,
                  minWidth: 26, textAlign: 'center',
                  transition: 'all .12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(99,102,241,.12)'
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,.3)'
                  e.currentTarget.style.color = '#818cf8'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.color = 'var(--text-2)'
                }}
              >
                {item.icon}
              </button>
            )
        )}

        {/* Tab switcher */}
        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--bg)', borderRadius: 7, padding: 2, gap: 2 }}>
          {['write', 'preview'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '3px 12px', borderRadius: 5, border: 'none',
                background: tab === t ? 'rgba(99,102,241,.18)' : 'transparent',
                color: tab === t ? '#818cf8' : 'var(--text-3)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                textTransform: 'capitalize', letterSpacing: 0.3,
              }}
            >
              {t === 'write' ? '✏️ Yozish' : '👁 Ko\'rish'}
            </button>
          ))}
        </div>
      </div>

      {/* Write tab */}
      {tab === 'write' ? (
        <textarea
          ref={taRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '14px 16px', border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-1)',
            fontSize: 13, lineHeight: 1.75, fontFamily: 'monospace',
            resize: 'vertical',
          }}
        />
      ) : (
        <div
          style={{
            padding: '14px 18px', minHeight: minRows * 22,
            color: 'var(--text-1)', fontSize: 13, lineHeight: 1.75,
            overflowY: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: value.trim() ? mdToHtml(value) : `<span style="color:var(--text-4);font-style:italic">Kontent yo'q…</span>` }}
        />
      )}

      {/* Footer bar */}
      <div style={{
        padding: '4px 12px', borderTop: '1px solid var(--border)',
        background: 'var(--surface)', fontSize: 11, color: 'var(--text-4)',
        display: 'flex', gap: 12,
      }}>
        <span>Markdown qo'llab-quvvatlanadi</span>
        <span>{value.length} belgi</span>
        <span>{value.split('\n').length} qator</span>
      </div>
    </div>
  )
}
