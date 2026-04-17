// pages/history.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Badge, Topbar, EmptyState, Btn, Spinner } from '../components/UI'
import { storage } from '../lib/storage'
import { fetchDbHistory } from '../lib/api'

const REGION_TAGS = ['India','North America','Europe','Asia-Pacific','China','Latin America','Middle East & Africa']

export default function History() {
  const [history, setHistory] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('db')
  const [editingArticle, setEditingArticle] = useState(null)
  const [loadingArticle, setLoadingArticle] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchDbHistory({ limit: 100 })
      if (data.articles?.length > 0) {
        setHistory(data.articles.map(a => ({
          _dbId: a.id,
          title: a.title,
          primaryCategory: a.primary_category,
          status: a.status,
          sourceUrl: a.source_url,
          sourceName: a.source_name,
          wpPostId: a.wp_post_id,
          timestamp: new Date(a.generated_at).getTime(),
          provider: a.provider,
          model: a.model,
          wordCount: a.word_count,
        })))
        setTotal(data.total)
        setSource('db')
      } else {
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

  async function openArticle(item) {
    if (!item._dbId) return
    setLoadingArticle(item._dbId)
    try {
      const r = await fetch(`/api/get-article?id=${item._dbId}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setEditingArticle(data)
    } catch (err) {
      alert('Failed to load article: ' + err.message)
    }
    setLoadingArticle(null)
  }

  function clearLocalHistory() {
    if (confirm('Clear local history?')) {
      localStorage.removeItem('1cw_history')
      localStorage.removeItem('1cw_seen_urls')
      load()
    }
  }

  if (editingArticle) {
    return (
      <Layout>
        <ArticleEditor
          article={editingArticle}
          onBack={() => { setEditingArticle(null); load() }}
          onSaved={() => { setEditingArticle(null); load() }}
        />
      </Layout>
    )
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
        {loading && <div style={{ textAlign: 'center', padding: 48 }}><Spinner size={24} /></div>}
        {!loading && history.length === 0 && (
          <EmptyState icon="⊘" title="No history yet" description="Generated articles will appear here" />
        )}

        {!loading && history.map((item, i) => (
          <div key={i}
            onClick={() => item._dbId && openArticle(item)}
            style={{
              display: 'flex', gap: 16, padding: '14px 12px', borderBottom: '1px solid #edead3',
              alignItems: 'flex-start', borderRadius: 8, marginBottom: 2,
              cursor: item._dbId ? 'pointer' : 'default',
              background: loadingArticle === item._dbId ? '#f5f3ee' : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (item._dbId) e.currentTarget.style.background = '#f5f3ee' }}
            onMouseLeave={e => { if (loadingArticle !== item._dbId) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#bbb', minWidth: 72, marginTop: 2 }}>
              {new Date(item.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              <br />
              {new Date(item.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d0d', marginBottom: 5, lineHeight: 1.4 }}>
                {item.title}
                {loadingArticle === item._dbId && <Spinner size={12} style={{ marginLeft: 8 }} />}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {item.primaryCategory && <Badge color="blue">{item.primaryCategory}</Badge>}
                {item.status && <Badge color={item.status === 'publish' ? 'green' : 'gray'}>{item.status}</Badge>}
                {item.wordCount > 0 && <Badge color="gray">{item.wordCount}w</Badge>}
                {item.provider && <Badge color="accent">{item.provider}</Badge>}
                {item.sourceName && <span style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>{item.sourceName}</span>}
                {item.wpPostId && <span style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>#{item.wpPostId}</span>}
              </div>
            </div>

            {item._dbId && (
              <div style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace", flexShrink: 0, marginTop: 2 }}>
                Edit ›
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  )
}
