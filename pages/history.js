// pages/history.js — History page matching design/other-pages.jsx HistoryPage
import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Topbar, Badge, Btn, Spinner, EmptyState, I, TextInput, Segmented, InlineSelect, relTime } from '../components/UI'
import { storage } from '../lib/storage'
import { fetchDbHistory } from '../lib/api'

export default function History() {
  const [history, setHistory] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [editingArticle, setEditingArticle] = useState(null)
  const [loadingArticle, setLoadingArticle] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchDbHistory({ limit: 200 })
      if (data.articles?.length > 0) {
        setHistory(data.articles.map(a => ({
          _dbId: a.id, title: a.title, slug: a.slug,
          primaryCategory: a.primary_category, status: a.status,
          sourceUrl: a.source_url, sourceName: a.source_name,
          wpPostId: a.wp_post_id, timestamp: new Date(a.generated_at).getTime(),
          provider: a.provider, model: a.model, wordCount: a.word_count,
          excerpt: a.excerpt, image: a.meta?.featuredImageUrl || '',
          tags: a.tags || [],
        })))
        setTotal(data.total)
      } else {
        const local = storage.getHistory()
        setHistory(local); setTotal(local.length)
      }
    } catch {
      const local = storage.getHistory()
      setHistory(local); setTotal(local.length)
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
    if (search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCategory && item.primaryCategory !== filterCategory) return false
    if (filterStatus && item.status !== filterStatus) return false
    if (filterProvider && item.provider !== filterProvider) return false
    if (filterDate) {
      const cutoff = { today: new Date().setHours(0,0,0,0), week: Date.now() - 7*86400000, month: Date.now() - 30*86400000 }[filterDate]
      if (item.timestamp < cutoff) return false
    }
    return true
  })

  // Group by day
  const grouped = {}
  displayHistory.forEach(h => {
    const d = new Date(h.timestamp).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
    grouped[d] = grouped[d] || []
    grouped[d].push(h)
  })

  if (editingArticle) return (
    <Layout>
      <ArticleEditor article={editingArticle} onBack={() => { setEditingArticle(null); load() }} onSaved={() => { setEditingArticle(null); load() }} />
    </Layout>
  )

  return (
    <Layout>
      <Topbar title="History" subtitle={loading ? 'Loading…' : `${total} articles`}
        actions={
          <>
            <TextInput size="sm" icon="search" placeholder="Search…" value={search} onChange={setSearch} style={{ width: 220 }} />
            <Segmented size="sm" value={view} onChange={setView} options={[
              { value: 'list', label: '', icon: <I name="list" size={13} /> },
              { value: 'grid', label: '', icon: <I name="grid" size={13} /> },
            ]} />
          </>
        }
      />

      {/* Filter bar */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '7px 20px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        <InlineSelect size="sm" value={filterDate} onChange={setFilterDate}
          options={[{value:'',label:'All time'},{value:'today',label:'Today'},{value:'week',label:'This week'},{value:'month',label:'This month'}]} />
        <InlineSelect size="sm" value={filterCategory} onChange={setFilterCategory}
          options={[{value:'',label:'All categories'}, ...allCategories.map(c => ({value:c,label:c}))]} />
        <InlineSelect size="sm" value={filterStatus} onChange={setFilterStatus}
          options={[{value:'',label:'All status'},{value:'draft',label:'Draft'},{value:'publish',label:'Published'}]} />
        <InlineSelect size="sm" value={filterProvider} onChange={setFilterProvider}
          options={[{value:'',label:'All providers'}, ...allProviders.map(p => ({value:p,label:p}))]} />
        {(filterDate || filterCategory || filterStatus || filterProvider) && (
          <button onClick={() => { setFilterDate(''); setFilterCategory(''); setFilterStatus(''); setFilterProvider('') }}
            style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)' }}>Clear</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{displayHistory.length} articles</span>
        <Btn variant="ghost" size="sm" onClick={load} disabled={loading}>{loading ? <Spinner size={12} /> : <I name="refresh" size={13} />}</Btn>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 48 }}><Spinner size={24} /></div>}
        {!loading && displayHistory.length === 0 && <EmptyState icon="⊘" title="No history" description="Generated articles appear here" />}

        {!loading && Object.entries(grouped).map(([day, items]) => (
          <div key={day} style={{ marginBottom: 28, maxWidth: 1000 }}>
            {/* Day divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{day}</div>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)' }}>{items.length}</div>
            </div>

            {view === 'list' ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
                {items.map((h, i) => (
                  <div key={h._dbId || i} onClick={() => openArticle(h)}
                    style={{ display: 'flex', gap: 12, padding: 12, borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', cursor: h._dbId ? 'pointer' : 'default', transition: 'background 0.1s' }}
                    onMouseEnter={e => h._dbId && (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div style={{ width: 60, height: 44, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0, border: '1px solid var(--border)' }}>
                      {h.image ? <img src={h.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}><I name="image" size={18} /></div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.title}
                        {loadingArticle === h._dbId && <Spinner size={12} color="var(--muted)" style={{ marginLeft: 8 }} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                        {h.primaryCategory && <Badge tone="blue" size="sm">{h.primaryCategory.split('&')[0].trim()}</Badge>}
                        {h.sourceName && <span>{h.sourceName}</span>}
                        {h.wordCount > 0 && <><span>·</span><span>{h.wordCount}w</span></>}
                        <span>·</span>
                        <span>{new Date(h.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {h.status === 'publish' ? <Badge tone="green" size="sm">Published</Badge> : <Badge tone="amber" size="sm">Draft</Badge>}
                      {h.wpPostId && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)' }}>#{h.wpPostId}</span>}
                      {h._dbId && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>Edit →</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {items.map((h, i) => (
                  <div key={h._dbId || i} onClick={() => openArticle(h)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', cursor: h._dbId ? 'pointer' : 'default', transition: 'box-shadow 0.1s' }}
                    onMouseEnter={e => h._dbId && (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                    <div style={{ aspectRatio: '16/10', background: 'var(--surface-2)' }}>
                      {h.image ? <img src={h.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}><I name="image" size={24} /></div>}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        {h.primaryCategory && <Badge tone="blue" size="sm">{h.primaryCategory.split('&')[0].trim()}</Badge>}
                        {h.status === 'publish' ? <Badge tone="green" size="sm">Live</Badge> : <Badge tone="amber" size="sm">Draft</Badge>}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{h.title}</div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{h.sourceName} · {h.wordCount}w</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  )
}
