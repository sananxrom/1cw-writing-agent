// components/UI.js — Design system components matching design/primitives.jsx

import { useState } from 'react'

// ── Icon (SVG) ──────────────────────────────────────────
export function I({ name, size = 14, color = 'currentColor', strokeWidth = 1.75 }) {
  const paths = {
    discover: <><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5L13 13l-4.5 2.5L11 11z"/></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    youtube: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M10 9v6l5-3z" fill={color} stroke="none"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
    filter: <><path d="M3 6h18M6 12h12M10 18h4"/></>,
    check: <><path d="m5 12 5 5L20 7"/></>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    chevronRight: <><path d="m9 6 6 6-6 6"/></>,
    chevronLeft: <><path d="m15 6-6 6 6 6"/></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    external: <><path d="M7 17 17 7M8 7h9v9"/></>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></>,
    sparkle: <><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></>,
    spark: <><path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10z" fill={color} stroke={color}/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    rss: <><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5" fill={color}/></>,
    play: <><path d="M5 3v18l15-9z" fill={color} stroke="none"/></>,
    dot: <><circle cx="12" cy="12" r="4" fill={color} stroke="none"/></>,
    cmd: <><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    tag: <><path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1" fill={color}/></>,
    wordpress: <><circle cx="12" cy="12" r="9"/><path d="M7 8l3 10 2-5 2 5 3-10"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    more: <><circle cx="12" cy="12" r="1" fill={color}/><circle cx="19" cy="12" r="1" fill={color}/><circle cx="5" cy="12" r="1" fill={color}/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    bolt: <><path d="M13 2 3 14h8l-1 8 10-12h-8z" fill={color} stroke={color}/></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    key: <><circle cx="7" cy="15" r="4"/><path d="m10 12 11-11M15 6l3 3M18 3l3 3"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    link: <><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
      {paths[name] || null}
    </svg>
  )
}

// ── Button ──────────────────────────────────────────────
export function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, style = {}, title, type = 'button', leftIcon, rightIcon, active, fullWidth }) {
  const sizes = {
    xs: { padding: '3px 8px', fontSize: 11, height: 22, borderRadius: 4, gap: 4 },
    sm: { padding: '4px 10px', fontSize: 12, height: 26, borderRadius: 5, gap: 5 },
    md: { padding: '6px 12px', fontSize: 13, height: 30, borderRadius: 6, gap: 6 },
    lg: { padding: '8px 16px', fontSize: 13, height: 36, borderRadius: 6, gap: 6 },
  }
  const variants = {
    primary: { background: 'var(--ink)', color: '#fff', border: '1px solid var(--ink)' },
    accent: { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' },
    secondary: { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)' },
    ghost: { background: active ? 'var(--surface-2)' : 'transparent', color: 'var(--ink-2)', border: '1px solid transparent' },
    danger: { background: 'var(--surface)', color: 'var(--danger)', border: '1px solid var(--border)' },
    success: { background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid #bbf7d0' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 500, whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'background 0.12s, border-color 0.12s, transform 0.05s',
        userSelect: 'none', letterSpacing: '-0.01em',
        width: fullWidth ? '100%' : 'auto',
        ...sizes[size], ...variants[variant], ...style,
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'translateY(0.5px)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}
    >
      {leftIcon && <span style={{ display: 'flex' }}>{leftIcon}</span>}
      {children}
      {rightIcon && <span style={{ display: 'flex' }}>{rightIcon}</span>}
    </button>
  )
}

// ── Badge ───────────────────────────────────────────────
export function Badge({ children, tone, color, size = 'md' }) {
  // Support both tone= (new) and color= (legacy)
  const t = tone || color
  const tones = {
    neutral: { bg: 'var(--surface-2)', color: 'var(--muted)', border: 'var(--border)' },
    gray:    { bg: 'var(--surface-2)', color: 'var(--muted)', border: 'var(--border)' },
    blue:    { bg: 'var(--accent-soft)', color: 'var(--accent)', border: 'var(--accent-border)' },
    accent:  { bg: 'var(--accent-soft)', color: 'var(--accent)', border: 'var(--accent-border)' },
    green:   { bg: 'var(--success-soft)', color: 'var(--success)', border: '#bbf7d0' },
    amber:   { bg: 'var(--warn-soft)', color: 'var(--warn)', border: '#fcd34d' },
    red:     { bg: 'var(--danger-soft)', color: 'var(--danger)', border: '#fecaca' },
    danger:  { bg: 'var(--danger-soft)', color: 'var(--danger)', border: '#fecaca' },
    mono:    { bg: 'transparent', color: 'var(--muted)', border: 'var(--border)' },
    solid:   { bg: 'var(--ink)', color: '#fff', border: 'var(--ink)' },
    purple:  { bg: '#f3e8ff', color: '#7c3aed', border: '#ddd6fe' },
  }
  const s = tones[t] || tones.neutral
  const sz = size === 'sm' ? { padding: '1px 6px', fontSize: 10 } : { padding: '2px 7px', fontSize: 11 }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 4, fontFamily: 'var(--mono)', fontWeight: 500,
      whiteSpace: 'nowrap', letterSpacing: '-0.01em',
      ...sz,
    }}>{children}</span>
  )
}

// ── Spinner ─────────────────────────────────────────────
export function Spinner({ size = 14, color = 'var(--accent)' }) {
  return (
    <div style={{
      width: size, height: size, border: `1.5px solid var(--border)`,
      borderTopColor: color, borderRadius: '50%',
      animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0,
    }} />
  )
}

// ── Checkbox ────────────────────────────────────────────
export function Checkbox({ checked, onChange, size = 16 }) {
  return (
    <div onClick={e => { e.stopPropagation(); onChange(!checked) }}
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: 4,
        border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: checked ? 'var(--accent)' : 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.1s',
      }}>
      {checked && <I name="check" size={size - 6} color="#fff" strokeWidth={3} />}
    </div>
  )
}

// ── Switch ──────────────────────────────────────────────
export function Switch({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{
        width: 32, height: 18, borderRadius: 10, padding: 2,
        background: checked ? 'var(--accent)' : 'var(--border-strong)',
        cursor: 'pointer', transition: 'background 0.15s', flexShrink: 0,
        display: 'flex', alignItems: 'center',
      }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        transform: `translateX(${checked ? 14 : 0}px)`,
        transition: 'transform 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

// ── Kbd ─────────────────────────────────────────────────
export function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 4px',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderBottomWidth: 2, borderRadius: 3,
      fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)',
    }}>{children}</span>
  )
}

// ── TextInput ──────────────────────────────────────────
export function TextInput({ value, onChange, placeholder, mono, icon, size = 'md', style = {}, onKeyDown, autoFocus, type = 'text', rightEl }) {
  const sizes = {
    sm: { height: 26, fontSize: 12, padding: icon ? '0 10px 0 28px' : '0 10px' },
    md: { height: 32, fontSize: 13, padding: icon ? '0 12px 0 32px' : '0 12px' },
    lg: { height: 38, fontSize: 14, padding: icon ? '0 14px 0 38px' : '0 14px' },
  }
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', ...style }}>
      {icon && <span style={{ position: 'absolute', left: size === 'sm' ? 8 : 10, color: 'var(--muted-2)', pointerEvents: 'none' }}><I name={icon} size={size === 'sm' ? 12 : 14} /></span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown} autoFocus={autoFocus}
        style={{
          width: '100%', ...sizes[size],
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          background: 'var(--surface)', color: 'var(--ink)', outline: 'none',
          fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
          transition: 'border-color 0.12s, box-shadow 0.12s',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(31,111,235,0.12)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }}
      />
      {rightEl && <span style={{ position: 'absolute', right: 8 }}>{rightEl}</span>}
    </div>
  )
}

// ── Textarea ───────────────────────────────────────────
export function Textarea({ value, onChange, placeholder, rows = 4, mono, style = {} }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{
        width: '100%', padding: '8px 10px', fontSize: 13, lineHeight: 1.55,
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: 'var(--surface)', color: 'var(--ink)', outline: 'none',
        fontFamily: mono ? 'var(--mono)' : 'var(--sans)', resize: 'vertical',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        ...style,
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(31,111,235,0.12)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }}
    />
  )
}

// ── Select (inline) ────────────────────────────────────
export function InlineSelect({ value, onChange, options, size = 'md', style = {} }) {
  const sizes = { sm: { height: 26, fontSize: 12, padding: '0 24px 0 10px' }, md: { height: 32, fontSize: 13, padding: '0 28px 0 12px' } }
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          ...sizes[size],
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          background: 'var(--surface)', color: 'var(--ink)', outline: 'none',
          appearance: 'none', cursor: 'pointer', fontFamily: 'var(--sans)',
          minWidth: 100,
        }}>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-2)' }}><I name="chevronDown" size={12} /></span>
    </div>
  )
}

// ── Segmented ──────────────────────────────────────────
export function Segmented({ value, onChange, options, size = 'md' }) {
  const h = size === 'sm' ? 26 : 30
  const fs = size === 'sm' ? 12 : 13
  return (
    <div style={{ display: 'inline-flex', padding: 2, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, height: h + 4 }}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        const icon = typeof o === 'string' ? null : o.icon
        return (
          <button key={v} onClick={() => onChange(v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: h, padding: '0 10px', borderRadius: 5, fontSize: fs, fontWeight: 500,
              background: value === v ? 'var(--surface)' : 'transparent',
              color: value === v ? 'var(--ink)' : 'var(--muted)',
              border: 'none', cursor: 'pointer',
              boxShadow: value === v ? 'var(--shadow-sm), 0 0 0 1px var(--border)' : 'none',
              transition: 'all 0.12s',
            }}>
            {icon && <span style={{ display: 'flex' }}>{icon}</span>}
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Tip (tooltip) ──────────────────────────────────────
export function Tip({ label, children }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%, -4px)',
          background: 'var(--ink)', color: '#fff', fontSize: 11, padding: '3px 7px', borderRadius: 4,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 100, fontFamily: 'var(--mono)',
        }}>{label}</span>
      )}
    </span>
  )
}

// ── Toast ──────────────────────────────────────────────
export function Toast({ message, onDone }) {
  const { useEffect } = require('react')
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [message])
  if (!message) return null
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ink)', color: '#fff', padding: '10px 16px', borderRadius: 8,
      fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: 8, animation: 'slideUp 0.2s ease-out',
    }}>
      <I name="check" size={14} color="var(--success)" />
      {message}
    </div>
  )
}

// ── Topbar ─────────────────────────────────────────────
export function Topbar({ title, subtitle, crumbs, actions }) {
  return (
    <div style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '0 20px', height: 48, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexShrink: 0, gap: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {crumbs ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <I name="chevronRight" size={12} color="var(--muted-2)" />}
                <span style={{ color: i === crumbs.length - 1 ? 'var(--ink)' : 'var(--muted)', fontWeight: i === crumbs.length - 1 ? 500 : 400, cursor: c.onClick ? 'pointer' : 'default' }} onClick={c.onClick}>{c.label}</span>
              </span>
            ))}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{subtitle}</div>}
          </>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────
export function EmptyState({ icon, title, description }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--muted)', textAlign: 'center' }}>
      {icon && <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 280 }}>{description}</div>}
    </div>
  )
}

// ── Time helpers ────────────────────────────────────────
export function relTime(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── FieldLabel (for forms) ─────────────────────────────
export function FieldLabel({ label, hint }) {
  return (
    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{hint}</div>}
    </div>
  )
}

// Legacy exports for backward compat
export { TextInput as Input }
export function Select({ label, value, onChange, options, helpText }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <FieldLabel label={label} />}
      <InlineSelect value={value} onChange={onChange} options={options} style={{ width: '100%' }} />
      {helpText && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{helpText}</div>}
    </div>
  )
}

// Card (legacy)
export function Card({ children, style = {} }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', ...style }}>{children}</div>
}
export function CardHeader({ children }) {
  return <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{children}</div>
}
