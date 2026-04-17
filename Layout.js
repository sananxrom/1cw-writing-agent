// components/Layout.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const NAV = [
  { href: '/', label: 'Discover', icon: '◈' },
  { href: '/create', label: 'Create', icon: '✦' },
  { href: '/youtube', label: 'YouTube', icon: '▶' },
  { href: '/history', label: 'History', icon: '≡' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout({ children }) {
  const router = useRouter()
  const [site, setSite] = useState('1cw.org')

  useEffect(() => {
    const s = localStorage.getItem('1cw_wp_url') || 'https://1cw.org'
    try { setSite(new URL(s).hostname) } catch {}
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f3ee', fontFamily: "'Sora', sans-serif" }}>
      {/* Sidebar */}
      <div style={{
        width: 220, flexShrink: 0,
        background: '#fdfcf9', borderRight: '1px solid #dedad2',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #dedad2' }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#0d0d0d', letterSpacing: '-0.3px' }}>
            1CW <span style={{ color: '#c8440a' }}>Agent</span>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9c9a92', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Writing Dashboard
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: '12px 8px', flex: 1 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 12px 4px' }}>
            Modes
          </div>
          {NAV.slice(0, 3).map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 6, marginBottom: 1,
                background: router.pathname === item.href ? '#0d0d0d' : 'transparent',
                color: router.pathname === item.href ? '#fff' : '#5c5b57',
                cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 13,
              }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          ))}

          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '16px 12px 4px' }}>
            Workspace
          </div>
          {NAV.slice(3).map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 6, marginBottom: 1,
                background: router.pathname === item.href ? '#0d0d0d' : 'transparent',
                color: router.pathname === item.href ? '#fff' : '#5c5b57',
                cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 13,
              }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #dedad2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2d9e5a', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, color: '#2e2e2b' }}>{site}</div>
              <div style={{ fontSize: 10, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>Connected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
