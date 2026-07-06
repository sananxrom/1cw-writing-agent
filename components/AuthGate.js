import { useState, useEffect } from 'react'
import { storage } from '../lib/storage'

const USERS = ['Sanan', 'Eddie']

export default function AuthGate({ children }) {
  const [authed, setAuthed] = useState(null) // null=loading, false=need login
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const profile = storage.getProfile()
    if (profile?.name && profile?.authed) setAuthed(true)
    else setAuthed(false)
  }, [])

  async function login() {
    if (!user || !password) { setError('Select user and enter password'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password })
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Wrong password'); setLoading(false); return }
      storage.setProfile({ slot: d.slot, name: d.name, authed: true })
      setAuthed(true)
    } catch { setError('Server error') }
    setLoading(false)
  }

  if (authed === null) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <img src="/logo.svg" alt="1CW" style={{ width: 48, opacity: 0.5 }} />
    </div>
  )

  if (!authed) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 340, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <img src="/logo.svg" alt="1CW" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, textAlign: 'center' }}>1CW Writing Agent</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 24, textAlign: 'center' }}>Select user to continue</div>

        {/* User select */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {USERS.map(u => (
            <button key={u} onClick={() => setUser(u)} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: `2px solid ${user === u ? 'var(--accent)' : 'var(--border)'}`,
              background: user === u ? 'var(--accent-soft)' : 'var(--surface)', cursor: 'pointer',
              fontSize: 13, fontWeight: user === u ? 600 : 400, color: user === u ? 'var(--accent)' : 'var(--ink)',
              transition: 'all 0.1s',
            }}>{u}</button>
          ))}
        </div>

        {/* Password */}
        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)' }} />

        {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{error}</div>}

        <button onClick={login} disabled={loading} style={{
          width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
        }}>{loading ? 'Checking…' : 'Sign in'}</button>
      </div>
    </div>
  )

  return children
}
