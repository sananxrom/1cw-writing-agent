// pages/history.js — DB-backed history with filters + image display
import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Badge, Topbar, EmptyState, Btn, Spinner } from '../components/UI'
import { storage } from '../lib/storage'
import { fetchDbHistory } from '../lib/api'

export default function History() {
  const [history, setHistory] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('db')
  const [editingArticle, setEditingArticle] = useState(null)
  const [loadingArticle, setLoadingArticle] = useState(null)
  const [showImages, setShowImages] = useState(false)
  // Filters
  const [filterSearch, setFilterSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchDbHistory({ limit: 200 })
      if (data.articles?.length > 0) {
        setHistory(data.articles.map(a => ({
          _dbId: a.id,
          title: a.title,
          slug: a.slug,
          primaryCategory: a.primary_category,
          status: a.status,
          sourceUrl: a.source_url,
          sourceName: a.source_name,
          wpPostId: a.wp_post_id,
          timestamp: new Date(a.generated_at).getTime(),
          provider: a.provider,
          model: a.model,
          wordCount: a.word_count,
          excerpt: a.excerpt,
          featuredImageUrl: a.meta?.featuredImageUrl || '',
          tags: a.tags || [],
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
    } catch (err) { alert('Failed to load: ' + err.message) }
    setLoadingArticle(null)
  }

  const allCategories = [...new Set(history.filter(h => h.primaryCategory).map(h => h.primaryCategory))]
  const allProviders = [...new Set(history.filter(h => h.provider).map(h => h.provider))]

  const displayHistory = history.filter(item => {
    if (filterSearch && !item.title?.toLowerCase().includes(filterSearch.toLowerCase())) return false
    if (filterCategory && item.primaryCategory !== filterCategory) return false
    if (filterStatus && item.status !== filterStatus) return false
    if (filterProvider && item.provider !== filterProvider) return false
    if (filterDate) {
      const cutoff = { today: new Date().setHours(0,0,0,0), week: Date.now() - 7*86400000, month: Date.now() - 30*86400000 }[filterDate]
      if (item.timestamp < cutoff) return false
    }
    return true
  })

  if (editingArticle) return (
    <Layout>
      <ArticleEditor article={editingArticle} onBack={() => { setEditingArticle(null); load() }} onSaved={() => { setEditingArticle(null); load() }} />
    </Layout>
  )

  return (
    <Layout>
      <Topbar
        title="History"
        subtitle={loading ? 'Loading…' : `${total} articles · ${source === 'db' ? '📦 Postgres' : '💾 Local'}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={() => setShowImages(v => !v)}>
              {showImages ? '🖼 Hide images' : '🖼 Show images'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? <Spinner size={12} /> : '↺'} Refresh
            </Btn>
          </div>
        }
      />

      {/* Filter bar */}
      <div style={{ borderBottom: '1px solid #dedad2', background: '#f9f8f5', padding: '8px 20px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search titles…"
          style={{ padding: '4px 10px', border: '1px solid #dedad2', borderRadius: 5, fontSize: 12, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', outline: 'none', width: 160 }} />
        <select value={filterDate} onChange={e => setFilterDate(e.target.value)} style={fsel}>
          <option value="">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={fsel}>
          <option value="">All categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={fsel}>
          <option value="">All status</option>
          <option value="draft">Draft</option>
          <option value="publish">Published</option>
        </select>
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} style={fsel}>
          <option value="">All providers</option>
          {allProviders.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(filterSearch || filterDate || filterCategory || filterStatus || filterProvider) && (
          <button onClick={() => { setFilterSearch(''); setFilterDate(''); setFilterCategory(''); setFilterStatus(''); setFilterProvider('') }}
            style={{ fontSize: 11, color: '#c8440a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Clear</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>{displayHistory.length} articles</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 48 }}><Spinner size={24} /></div>}
        {!loading && displayHistory.length === 0 && <EmptyState icon="⊘" title="No history" description="Generated articles appear here" />}

        {!loading && displayHistory.map((item, i) => (
          <div key={i} onClick={() => item._dbId && openArticle(item)}
            style={{
              display: 'flex', gap: 14, padding: '13px 10px', borderBottom: '1px solid #edead3',
              borderRadius: 7, marginBottom: 2, cursor: item._dbId ? 'pointer' : 'default',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (item._dbId) e.currentTarget.style.background = '#f5f3ee' }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* Image */}
            {showImages && (
              <div style={{ width: 72, height: 50, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: '#edeae3' }}>
                {item.featuredImageUrl
                  ? <img src={item.featuredImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, opacity: 0.2 }}>🖼</div>
                }
              </div>
            )}

            {/* Date */}
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#bbb', minWidth: 68, marginTop: 2, flexShrink: 0 }}>
              {new Date(item.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              <br />
              {new Date(item.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d0d', marginBottom: 4, lineHeight: 1.4 }}>
                {item.title}
                {loadingArticle === item._dbId && <Spinner size={12} style={{ marginLeft: 8 }} />}
              </div>
              {item.excerpt && (
                <div style={{ fontSize: 11, color: '#9c9a92', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{item.excerpt}</div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {item.primaryCategory && <Badge color="blue">{item.primaryCategory}</Badge>}
                {item.status && <Badge color={item.status === 'publish' ? 'green' : 'gray'}>{item.status}</Badge>}
                {item.wordCount > 0 && <Badge color="gray">{item.wordCount}w</Badge>}
                {item.provider && <Badge color="accent">{item.provider}</Badge>}
                {item.tags?.slice(0, 2).map(t => <Badge key={t} color="gray">{t}</Badge>)}
                {item.sourceName && <span style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>{item.sourceName}</span>}
                {item.wpPostId && <span style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>#{item.wpPostId}</span>}
              </div>
            </div>

            {item._dbId && (
              <div style={{ fontSize: 12, color: '#9c9a92', fontFamily: "'DM Mono', monospace", flexShrink: 0, marginTop: 2, fontWeight: 500 }}>
                Edit →
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  )
}

const fsel = { padding: '4px 8px', border: '1px solid #dedad2', borderRadius: 5, fontSize: 12, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', cursor: 'pointer' }
