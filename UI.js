// components/UI.js
// Reusable UI primitives

export function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, style = {}, type = 'button' }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: '1px solid', fontFamily: "'Sora', sans-serif",
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s', borderRadius: 7, fontWeight: 400,
    whiteSpace: 'nowrap',
  }
  const sizes = {
    sm: { padding: '5px 12px', fontSize: 11 },
    md: { padding: '7px 16px', fontSize: 13 },
    lg: { padding: '9px 20px', fontSize: 14 },
  }
  const variants = {
    primary: { background: '#0d0d0d', color: '#fff', borderColor: '#0d0d0d' },
    accent: { background: '#c8440a', color: '#fff', borderColor: '#c8440a' },
    secondary: { background: '#fdfcf9', color: '#2e2e2b', borderColor: '#dedad2' },
    ghost: { background: 'transparent', color: '#5c5b57', borderColor: 'transparent' },
    danger: { background: '#fdecea', color: '#c0271e', borderColor: '#f5c0bc' },
    success: { background: '#e4f4ec', color: '#1a7a45', borderColor: '#a8dfc0' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

export function Input({ label, value, onChange, placeholder, type = 'text', mono = false, rows, required, helpText }) {
  const inputStyle = {
    width: '100%', padding: '8px 10px',
    border: '1px solid #dedad2', borderRadius: 6,
    fontSize: 13, fontFamily: mono ? "'DM Mono', monospace" : "'Sora', sans-serif",
    background: '#fdfcf9', color: '#0d0d0d', outline: 'none',
  }
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
          {label}{required && <span style={{ color: '#c8440a' }}> *</span>}
        </label>
      )}
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={rows}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          style={inputStyle} />
      )}
      {helpText && <div style={{ fontSize: 11, color: '#9c9a92', marginTop: 4 }}>{helpText}</div>}
    </div>
  )
}

export function Select({ label, value, onChange, options, helpText }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
          {label}
        </label>
      )}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px',
          border: '1px solid #dedad2', borderRadius: 6,
          fontSize: 13, fontFamily: "'Sora', sans-serif",
          background: '#fdfcf9', color: '#0d0d0d', cursor: 'pointer',
        }}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {helpText && <div style={{ fontSize: 11, color: '#9c9a92', marginTop: 4 }}>{helpText}</div>}
    </div>
  )
}

export function Toggle({ label, checked, onChange, helpText }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 13, color: '#2e2e2b' }}>{label}</div>
        {helpText && <div style={{ fontSize: 11, color: '#9c9a92', marginTop: 2 }}>{helpText}</div>}
      </div>
      <div onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: checked ? '#0d0d0d' : '#dedad2',
          position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
        }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </div>
  )
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    gray: { bg: '#f1efe8', color: '#5f5e5a', border: '#d3d1c7' },
    blue: { bg: '#e6f1fb', color: '#185fa5', border: '#b5d4f4' },
    green: { bg: '#e4f4ec', color: '#1a7a45', border: '#a8dfc0' },
    amber: { bg: '#faeeda', color: '#854f0b', border: '#fac775' },
    red: { bg: '#fdecea', color: '#c0271e', border: '#f5c0bc' },
    purple: { bg: '#eeedfe', color: '#3c3489', border: '#cecbf6' },
    accent: { bg: '#fef1eb', color: '#c8440a', border: '#f5c4a8' },
  }
  const c = colors[color] || colors.gray
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontFamily: "'DM Mono', monospace",
      padding: '2px 8px', borderRadius: 20, fontWeight: 500,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {children}
    </span>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fdfcf9', border: '1px solid #dedad2',
      borderRadius: 10, overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  )
}

export function CardHeader({ title, right, style = {} }) {
  return (
    <div style={{
      padding: '12px 16px', borderBottom: '1px solid #dedad2',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      ...style,
    }}>
      <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}

export function Spinner({ size = 16 }) {
  return (
    <div style={{
      width: size, height: size, border: `2px solid #dedad2`,
      borderTopColor: '#c8440a', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', display: 'inline-block',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      {icon && <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>{icon}</div>}
      <div style={{ fontSize: 15, fontWeight: 500, color: '#2e2e2b', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: '#9c9a92', marginBottom: 20 }}>{description}</div>}
      {action}
    </div>
  )
}

export function Topbar({ title, subtitle, actions }) {
  return (
    <div style={{
      background: '#fdfcf9', borderBottom: '1px solid #dedad2',
      padding: '0 28px', height: 52,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#0d0d0d', letterSpacing: '-0.3px' }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}

export function RegenButton({ field, onRegen, loading }) {
  const [showInput, setShowInput] = useState(false)
  const [instruction, setInstruction] = useState('')
  const { useState: useStateLocal } = require('react')

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
      {!showInput ? (
        <button onClick={() => setShowInput(true)}
          title="Regenerate this field"
          style={{
            background: 'none', border: '1px solid #dedad2', borderRadius: 4,
            padding: '1px 6px', fontSize: 10, color: '#9c9a92', cursor: 'pointer',
            fontFamily: "'DM Mono', monospace",
          }}>
          {loading ? '...' : '↺ regen'}
        </button>
      ) : (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input
            autoFocus
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { onRegen(field, instruction); setShowInput(false); setInstruction('') }
              if (e.key === 'Escape') { setShowInput(false); setInstruction('') }
            }}
            placeholder="Instruction... (Enter to run)"
            style={{
              fontSize: 11, padding: '2px 7px', border: '1px solid #c8440a',
              borderRadius: 4, outline: 'none', width: 200,
              fontFamily: "'Sora', sans-serif",
            }}
          />
          <button onClick={() => { onRegen(field, instruction); setShowInput(false); setInstruction('') }}
            style={{ background: '#c8440a', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 11, cursor: 'pointer' }}>
            Run
          </button>
          <button onClick={() => { setShowInput(false); setInstruction('') }}
            style={{ background: 'none', border: '1px solid #dedad2', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer', color: '#9c9a92' }}>
            ✕
          </button>
        </span>
      )}
    </span>
  )
}
