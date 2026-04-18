// components/Layout.js — Sidebar + shell matching design/shell.jsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { I, Kbd, Badge, Spinner, Toast } from './UI'

const NAV = [
  { id: 'discover', label: 'Discover', icon: 'inbox',    kbd: '1', href: '/' },
  { id: 'create',   label: 'Create',   icon: 'plus',     kbd: '2', href: '/create' },
  { id: 'youtube',  label: 'YouTube',  icon: 'youtube',  kbd: '3', href: '/youtube' },
  { id: 'history',  label: 'History',  icon: 'history',  kbd: '4', href: '/history' },
  { id: 'settings', label: 'Settings', icon: 'settings', kbd: '5', href: '/settings' },
]

export default function Layout({ children, counts = {}, toast, onToastDone }) {
  const router = useRouter()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState(toast || '')

  // Keyboard shortcuts 1–5 + ⌘K
  useEffect(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); setCmdOpen(true); return }
      const inInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (!inInput && !mod && /^[1-5]$/.test(e.key)) {
        router.push(NAV[parseInt(e.key) - 1].href)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const page = router.pathname === '/' ? 'discover'
    : router.pathname.slice(1) || 'discover'

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <div style={{
        width: 220, flexShrink: 0, background: 'var(--surface)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Brand */}
        <div style={{ padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'var(--ink)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, letterSpacing: '-0.02em', flexShrink: 0,
          }}>1cw</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Writing Console</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>1cw.org</div>
          </div>
        </div>

        {/* Search trigger */}
        <div style={{ padding: '0 10px 10px' }}>
          <button onClick={() => setCmdOpen(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            height: 30, padding: '0 10px', borderRadius: 6,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--muted)', fontSize: 12, cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-2)'}>
            <I name="search" size={13} />
            <span>Search or jump…</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
              <Kbd>⌘</Kbd><Kbd>K</Kbd>
            </span>
          </button>
        </div>

        {/* Nav */}
        <div style={{ padding: '4px 8px', flex: 1, overflow: 'auto' }}>
          <div style={navLabel}>Workspace</div>
          {NAV.map(item => {
            const active = page === item.id
            const count = counts?.[item.id]
            return (
              <button key={item.id} onClick={() => router.push(item.href)}
                className="nav-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '6px 10px', borderRadius: 5, marginBottom: 1,
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 500 : 400,
                  transition: 'background 0.1s', textAlign: 'left',
                  boxShadow: active ? 'inset 0 0 0 1px var(--border)' : 'none',
                }}>
                <I name={item.icon} size={15} color={active ? 'var(--accent)' : 'var(--muted)'} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {count != null && count > 0 && (
                  <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 10 }}>{count}</span>
                )}
                <Kbd>{item.kbd}</Kbd>
              </button>
            )
          })}

          <div style={{ ...navLabel, marginTop: 16 }}>Pipeline</div>
          <PipelineMini counts={counts} />
        </div>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, boxShadow: '0 0 0 3px rgba(22,163,74,0.15)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500 }}>1cw.org</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>WP · Claude Sonnet</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={footerBtn}><I name="user" size={11} /> Account</button>
            <button style={footerBtn} title="Press 1–5 to navigate, ⌘K to search">?</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {children}
      </div>

      {/* Command palette */}
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} onNavigate={href => { router.push(href); setCmdOpen(false) }} />}

      {/* Toast */}
      {toastMsg && <Toast message={toastMsg} onDone={() => { setToastMsg(''); onToastDone?.() }} />}
    </div>
  )
}

function PipelineMini({ counts = {} }) {
  const stages = [
    { label: 'Queued',     count: counts.queued || 0,      color: 'var(--muted)' },
    { label: 'Generating', count: counts.generating || 0,  color: 'var(--accent)', animate: (counts.generating || 0) > 0 },
    { label: 'Review',     count: counts.review || 0,      color: 'var(--warn)' },
    { label: 'Published',  count: counts.published || 0,   color: 'var(--success)' },
  ]
  return (
    <div style={{ padding: '4px 10px 8px' }}>
      {stages.map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 11 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0, animation: s.animate ? 'pulse 1.4s ease-in-out infinite' : 'none' }} />
          <span style={{ color: 'var(--muted)', flex: 1 }}>{s.label}</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)', fontWeight: 500 }}>{s.count}</span>
        </div>
      ))}
    </div>
  )
}

function CommandPalette({ onClose, onNavigate }) {
  const [q, setQ] = useState('')

  const actions = [
    { group: 'Navigate', items: NAV.map(n => ({ label: `Go to ${n.label}`, icon: n.icon, run: () => onNavigate(n.href) })) },
    { group: 'Actions', items: [
      { label: 'Refresh all sources', icon: 'refresh' },
      { label: 'Create article from URL', icon: 'link' },
      { label: 'Test WordPress connection', icon: 'wordpress' },
    ]},
  ]

  const filtered = actions.map(g => ({
    ...g,
    items: g.items.filter(i => !q || i.label.toLowerCase().includes(q.toLowerCase())),
  })).filter(g => g.items.length > 0)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.25)',
      backdropFilter: 'blur(4px)', zIndex: 100,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '90vw', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <I name="search" size={15} color="var(--muted)" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type a command or search…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--ink)' }}
            onKeyDown={e => e.key === 'Escape' && onClose()} />
          <Kbd>esc</Kbd>
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto', padding: '6px 0' }}>
          {filtered.map(group => (
            <div key={group.group}>
              <div style={{ padding: '6px 14px', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.group}</div>
              {group.items.map((it, i) => (
                <div key={i} onClick={() => { it.run?.(); onClose() }}
                  style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <I name={it.icon} size={14} color="var(--muted)" />
                  <span style={{ flex: 1 }}>{it.label}</span>
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No results</div>}
        </div>
      </div>
    </div>
  )
}

const navLabel = {
  fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  padding: '8px 10px 4px', fontWeight: 500,
}

const footerBtn = {
  flex: 1, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4,
  fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
}
