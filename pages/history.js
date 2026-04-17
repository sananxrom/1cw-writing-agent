// pages/history.js
import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { Badge, Topbar, EmptyState, Btn } from '../components/UI'
import { storage } from '../lib/storage'

export default function History() {
  const [history, setHistory] = useState([])

  useEffect(() => {
    setHistory(storage.getHistory())
  }, [])

  function clearHistory() {
    if (confirm('Clear all history? This cannot be undone.')) {
      localStorage.removeItem('1cw_history')
      localStorage.removeItem('1cw_seen_urls')
      setHistory([])
    }
  }

  return (
    <Layout>
      <Topbar
        title="History"
        subtitle={`${history.length} articles generated`}
        actions={
          history.length > 0 && (
            <Btn variant="ghost" size="sm" onClick={clearHistory}>Clear all</Btn>
          )
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {history.length === 0 && (
          <EmptyState icon="≡" title="No history yet" description="Generated articles will appear here" />
        )}

        {history.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid #edeae3', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#bbb', minWidth: 80, marginTop: 2 }}>
              {new Date(item.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              <br />
              {new Date(item.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d0d', marginBottom: 4, lineHeight: 1.4 }}>
                {item.title}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {item.primaryCategory && <Badge color="blue">{item.primaryCategory}</Badge>}
                {item.status && <Badge color={item.status === 'publish' ? 'green' : 'gray'}>{item.status}</Badge>}
                {item.sourceName && <span style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>{item.sourceName}</span>}
                {item.wpPostId && <span style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>#{item.wpPostId}</span>}
              </div>
            </div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#c8440a', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                View →
              </a>
            )}
          </div>
        ))}
      </div>
    </Layout>
  )
}
