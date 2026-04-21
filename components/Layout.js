// components/Layout.js — Slim sidebar (Option 3)
// Brand + pipeline status + Create + Sources + Settings only
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { I, Kbd, Spinner, Toast } from './UI'

export default function Layout({ children, counts = {}, onCreateClick, onSourcesClick }) {
  const router = useRouter()
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); setCmdOpen(true) }
      const inInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (!inInput && !mod && e.key === '1') router.push('/')
      if (!inInput && !mod && e.key === '2') router.push('/settings')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isDiscover = router.pathname === '/'
  const isSettings = router.pathname === '/settings'

  const generatingCount = counts.generating || 0

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Slim sidebar */}
      <div style={{
        width: 52, flexShrink: 0, background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 0', gap: 4,
      }}>
        {/* Brand mark */}
        <div onClick={() => router.push('/')} style={{
          width: 30, height: 30, borderRadius: 6,
          background: 'var(--ink)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 10, letterSpacing: '-0.02em',
          cursor: 'pointer', marginBottom: 8, flexShrink: 0,
        }}>1cw</div>

        {/* Discover */}
        <NavIcon icon="inbox" label="Discover" active={isDiscover} kbd="1" onClick={() => router.push('/')} />

        <div style={{ flex: 1 }} />

        {/* Pipeline mini — dots showing status */}
        <PipelineDots counts={counts} />

        <div style={{ height: 8 }} />

        {/* Settings */}
        <NavIcon icon="settings" label="Settings" active={isSettings} kbd="2" onClick={() => router.push('/settings')} />

        {/* WP status dot */}
        <div title="1cw.org connected" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', margin: '8px 0 4px', boxShadow: '0 0 0 3px rgba(22,163,74,0.15)' }} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {children}
      </div>

      {/* Command palette */}
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} onNavigate={href => { router.push(href); setCmdOpen(false) }} />}
    </div>
  )
}

function NavIcon({ icon, label, active, kbd, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={`${label} (${kbd})`}
      style={{
        width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--surface-2)' : hover ? 'var(--surface-2)' : 'transparent',
        boxShadow: active ? 'inset 0 0 0 1px var(--border)' : 'none',
        transition: 'all 0.1s', position: 'relative',
      }}>
      <I name={icon} size={16} color={active ? 'var(--accent)' : 'var(--muted)'} />
      {hover && (
        <div style={{
          position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
          marginLeft: 8, background: 'var(--ink)', color: '#fff',
          fontSize: 11, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 100, fontFamily: 'var(--mono)',
        }}>{label}</div>
      )}
    </button>
  )
}

function PipelineDots({ counts }) {
  const stages = [
    { label: 'Queued',     color: 'var(--muted-2)',  count: counts.queued || 0 },
    { label: 'Generating', color: 'var(--accent)',    count: counts.generating || 0, pulse: true },
    { label: 'Review',     color: 'var(--warn)',      count: counts.review || 0 },
    { label: 'Published',  color: 'var(--success)',   count: counts.published || 0 },
  ].filter(s => s.count > 0)

  if (!stages.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      {[
        { color: 'var(--muted-2)', label: 'Queued 0' },
        { color: 'var(--accent)', label: 'Generating 0' },
        { color: 'var(--warn)', label: 'Review 0' },
        { color: 'var(--success)', label: 'Published 0' },
      ].map((s, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, opacity: 0.2 }} />
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {stages.map((s, i) => (
        <div key={i} title={`${s.label}: ${s.count}`} style={{
          width: 22, height: 18, borderRadius: 4,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          cursor: 'default',
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0, animation: s.pulse && s.count > 0 ? 'pulse 1.4s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--ink-2)', fontWeight: 600 }}>{s.count}</span>
        </div>
      ))}
    </div>
  )
}

function CommandPalette({ onClose, onNavigate }) {
  const [q, setQ] = useState('')
  const actions = [
    { group: 'Navigate', items: [
      { label: 'Go to Discover', icon: 'inbox',    run: () => onNavigate('/') },
      { label: 'Go to Settings', icon: 'settings', run: () => onNavigate('/settings') },
    ]},
    { group: 'Actions', items: [
      { label: 'Refresh sources',         icon: 'refresh' },
      { label: 'Create article from URL', icon: 'link' },
      { label: 'Test WordPress',          icon: 'wordpress' },
    ]},
  ]
  const filtered = actions.map(g => ({ ...g, items: g.items.filter(i => !q || i.label.toLowerCase().includes(q.toLowerCase())) })).filter(g => g.items.length)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.25)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '90vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <I name="search" size={15} color="var(--muted)" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type a command…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--ink)' }}
            onKeyDown={e => e.key === 'Escape' && onClose()} />
        </div>
        <div style={{ maxHeight: 360, overflow: 'auto', padding: '6px 0' }}>
          {filtered.map(group => (
            <div key={group.group}>
              <div style={{ padding: '6px 14px', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.group}</div>
              {group.items.map((it, i) => (
                <div key={i} onClick={() => { it.run?.(); onClose() }} style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <I name={it.icon} size={14} color="var(--muted)" />{it.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
