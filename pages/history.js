// pages/history.js — DB-backed history with localStorage fallback
import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { Badge, Topbar, EmptyState, Btn, Spinner } from '../components/UI'
import { storage } from '../lib/storage'
import { fetchDbHistory } from '../lib/api'

export default function History() {
  const [history, setHistory] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('db') // 'db' | 'local'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchDbHistory({ limit: 100 })
      if (data.articles?.length > 0) {
        setHistory(data.articles.map(a => ({
          title: a.title,
          primaryCategory: a.primary_category,
          status: a.status,
          sourceUrl: a.source_url,
          sourceName: a.source_name,
          wpPostId: a.wp_post_id,
          url: null,
          timestamp: new Date(a.generated_at).getTime(),
          provider: a.provider,
          model: a.model,
          wordCount: a.word_count,
        })))
        setTotal(data.total)
        setSource('db')
      } else {
        // Fallback to localStorage
        const local = storage.getHistory()
        setHistory(local)
        setTotal(local.length)
        setSource('local')
      }
    } catch {
      const local = storage.getHistory()
      setHistory(local)
      setTotal(local.length)
      setSource('local')
    }
    setLoading(false)
  }

  function clearLocalHistory() {
    if (confirm('Clear local history? This cannot be undone.')) {
      localStorage.removeItem('1cw_history')
      localStorage.removeItem('1cw_seen_urls')
      load()
    }
  }

  return (
    <Layout>
      <Topbar
        title="History"
        subtitle={loading ? 'Loading…' : `${total} articles · ${source === 'db' ? '📦 Postgres' : '💾 Local'}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? <Spinner size={12} /> : '↺'} Refresh
            </Btn>
            {source === 'local' && history.length > 0 && (
              <Btn variant="ghost" size="sm" onClick={clearLocalHistory}>Clear local</Btn>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}><Spinner size={24} /></div>
        )}

        {!loading && history.length === 0 && (
          <EmptyState icon="⊘" title="No history yet" description="Generated articles will appear here" />
        )}

        {!loading && history.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid #edead3', alignItems: 'flex-start' }}>
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
                {item.wordCount && <Badge color="gray">{item.wordCount}w</Badge>}
                {item.provider && <Badge color="accent">{item.provider}</Badge>}
                {item.sourceName && <span style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>{item.sourceName}</span>}
                {item.wpPostId && <span style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>#{item.wpPostId}</span>}
              </div>
            </div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#c8440a', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                View ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </Layout>
  )
}
