// pages/index.js - Discover mode
// Split: Pulled articles (left) | Generated queue (right)
import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Btn, Badge, Spinner, EmptyState, Topbar } from '../components/UI'
import { fetchRSS, scrapeArticle, generateArticle } from '../lib/api'
import { storage } from '../lib/storage'

const REGION_TAGS = ['India','North America','Europe','Asia-Pacific','China','Latin America','Middle East & Africa']

export default function Discover() {
  const [sources, setSources] = useState([])
  const [feedItems, setFeedItems] = useState({})
  const [loadingSource, setLoadingSource] = useState({})
  const [selected, setSelected] = useState([])
  const [generated, setGenerated] = useState([]) // { article, item, status: 'generating'|'done'|'error', error }
  const [editingArticle, setEditingArticle] = useState(null)
  const [editingIndex, setEditingIndex] = useState(null)
  const [activeSource, setActiveSource] = useState('all')
  const [view, setView] = useState('pulled') // 'pulled' | 'generated'
  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const generatingRef = useRef(false)

  useEffect(() => {
    function init() {
      const s = storage.getSources().filter(s => s.type === 'rss' && s.active)
      setSources(s)
      setFeedItems({})
      s.forEach(src => loadSource(src))
    }
    init()
    document.addEventListener('visibilitychange', init)
    return () => document.removeEventListener('visibilitychange', init)
  }, [])

  async function loadSource(src) {
    setLoadingSource(prev => ({ ...prev, [src.id]: true }))
    try {
      const data = await fetchRSS(src.url)
      const items = (data.items || []).slice(0, src.maxArticles || 10).map(item => ({
        ...item,
        sourceId: src.id,
        sourceName: src.name,
        seen: storage.isUrlSeen(item.link),
        pulledAt: Date.now(),
      }))
      setFeedItems(prev => ({ ...prev, [src.id]: items }))
    } catch {
      setFeedItems(prev => ({ ...prev, [src.id]: [] }))
    }
    setLoadingSource(prev => ({ ...prev, [src.id]: false }))
  }

  const allItems = Object.entries(feedItems).flatMap(([srcId, items]) =>
    items.map(item => ({ ...item, sourceId: srcId }))
  )

  const displayItems = (() => {
    let items = activeSource === 'all' ? allItems : (feedItems[activeSource] || [])
    if (filterSearch) items = items.filter(i => i.title?.toLowerCase().includes(filterSearch.toLowerCase()))
    if (filterDate) {
      const cutoff = Date.now() - { '1h': 3600000, '24h': 86400000, '7d': 604800000 }[filterDate]
      items = items.filter(i => i.pubDate && new Date(i.pubDate).getTime() > cutoff)
    }
    return items
  })()

  const displayGenerated = (() => {
    let items = [...generated]
    if (filterCategory) items = items.filter(i => i.article?.primaryCategory?.toLowerCase().includes(filterCategory.toLowerCase()))
    if (filterStatus) items = items.filter(i => i.status === filterStatus || i.article?.status === filterStatus)
    if (filterSearch) items = items.filter(i => i.article?.title?.toLowerCase().includes(filterSearch.toLowerCase()))
    return items
  })()

  const toggleSelect = (link) => {
    setSelected(prev => prev.includes(link) ? prev.filter(l => l !== link) : [...prev, link])
  }

  async function generateSelected() {
    if (!selected.length || generatingRef.current) return
    generatingRef.current = true
    const settings = storage.getSettings()
    const batchDelay = settings.batchDelay ?? 600

    // Add all selected as 'generating' placeholders immediately
    const toGenerate = selected.map(link => ({
      link,
      item: allItems.find(i => i.link === link),
    })).filter(x => x.item)

    setGenerated(prev => [
      ...toGenerate.map(({ item }) => ({
        item,
        article: null,
        status: 'generating',
        error: null,
        generatedAt: Date.now(),
      })),
      ...prev,
    ])
    setSelected([])
    setView('generated')

    // Generate all in sequence with delay
    for (const [idx, { link, item }] of toGenerate.entries()) {
      const src = sources.find(s => s.id === item.sourceId)
      try {
        if (idx > 0) await new Promise(r => setTimeout(r, batchDelay))

        let content = item.content || item.summary || ''
        try {
          const scraped = await scrapeArticle(item.link)
          if (scraped.text?.length > content.length) content = scraped.text
          if (!item.image && scraped.image) item.image = scraped.image
        } catch {}

        const authors = storage.getAuthors()
        const authorObj = authors.find(a => a.id === src?.defaultAuthor)

        const article = await generateArticle({
          content,
          title: item.title,
          sourceUrl: item.link,
          sourceName: item.sourceName || src?.name,
          primaryCategory: src?.primaryCategory,
          writingPrompt: src?.writingPrompt || settings.globalWritingPrompt,
          authorStyle: authorObj?.style || '',
          postFormat: src?.postFormat || 'standard',
          mode: 'rewrite',
        }, { batchIndex: idx, batchDelay: 0 })

        storage.addSeenUrl(item.link)

        setGenerated(prev => prev.map(g =>
          g.item.link === link
            ? { ...g, article: { ...article, featuredImageUrl: item.image || '', sourceUrl: item.link, sourceName: item.sourceName || src?.name, videoUrl: src?.postFormat === 'video' ? item.link : '' }, status: 'done' }
            : g
        ))
      } catch (err) {
        setGenerated(prev => prev.map(g =>
          g.item.link === link ? { ...g, status: 'error', error: err.message } : g
        ))
      }
    }
    generatingRef.current = false
  }

  function openEditor(idx) {
    const g = displayGenerated[idx]
    if (!g?.article) return
    setEditingArticle(g.article)
    setEditingIndex(idx)
  }

  function onEditorBack() {
    setEditingArticle(null)
    setEditingIndex(null)
  }

  function onEditorSaved(post, updatedArticle) {
    if (editingIndex !== null && updatedArticle) {
      setGenerated(prev => prev.map((g, i) =>
        g.item.link === displayGenerated[editingIndex]?.item.link
          ? { ...g, article: { ...g.article, ...updatedArticle, wpPostId: post?.id, wpPostUrl: post?.link, status: post ? 'publish' : g.article.status } }
          : g
      ))
    }
    setEditingArticle(null)
    setEditingIndex(null)
  }

  if (editingArticle) {
    return (
      <Layout>
        <ArticleEditor
          article={editingArticle}
          source={sources.find(s => s.name === editingArticle.sourceName)}
          onBack={onEditorBack}
          onSaved={(post, updated) => onEditorSaved(post, updated)}
        />
      </Layout>
    )
  }

  const isLoading = Object.values(loadingSource).some(Boolean)
  const generatingCount = generated.filter(g => g.status === 'generating').length
  const doneCount = generated.filter(g => g.status === 'done').length
  const allCategories = [...new Set(generated.filter(g => g.article?.primaryCategory).map(g => g.article.primaryCategory))]

  return (
    <Layout>
      <Topbar
        title="Discover"
        subtitle={`${allItems.length} pulled · ${generated.length} generated`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 7, padding: 3 }}>
              {[['pulled', `Pulled (${allItems.length})`], ['generated', `Generated (${generated.length})`]].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '4px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer', border: 'none',
                  background: view === v ? '#0d0d0d' : 'transparent',
                  color: view === v ? '#fff' : '#5c5b57',
                  fontFamily: "'Sora', sans-serif",
                }}>{label}</button>
              ))}
            </div>
            <Btn variant="secondary" size="sm" onClick={() => { const s = storage.getSources().filter(s => s.type === 'rss' && s.active); setSources(s); setFeedItems({}); s.forEach(src => loadSource(src)) }}>
              {isLoading ? <Spinner size={12} /> : '↺'} Refresh
            </Btn>
            {selected.length > 0 && (
              <Btn variant="accent" size="sm" onClick={generateSelected} disabled={generatingRef.current}>
                {generatingCount > 0 ? <><Spinner size={12} />Generating {generatingCount}…</> : `Generate ${selected.length} →`}
              </Btn>
            )}
          </div>
        }
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Source sidebar */}
        <div style={{ width: 168, flexShrink: 0, borderRight: '1px solid #dedad2', background: '#fdfcf9', padding: '12px 8px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 4px', marginBottom: 4 }}>Sources</div>
          {[{ id: 'all', name: 'All Sources' }, ...sources].map(src => (
            <div key={src.id} onClick={() => setActiveSource(src.id)} style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: activeSource === src.id ? '#0d0d0d' : 'transparent',
              color: activeSource === src.id ? '#fff' : '#5c5b57',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.name}</span>
              {src.id !== 'all' && (
                <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4, flexShrink: 0 }}>
                  {loadingSource[src.id] ? '…' : (feedItems[src.id]?.length || 0)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Filter bar */}
          <div style={{ borderBottom: '1px solid #dedad2', background: '#fdfcf9', padding: '8px 16px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search…"
              style={{ padding: '4px 10px', border: '1px solid #dedad2', borderRadius: 6, fontSize: 12, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', outline: 'none', width: 160 }}
            />
            {view === 'pulled' && (
              <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
                style={filterSelectStyle}>
                <option value="">All time</option>
                <option value="1h">Last hour</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 days</option>
              </select>
            )}
            {view === 'generated' && (
              <>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={filterSelectStyle}>
                  <option value="">All categories</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterSelectStyle}>
                  <option value="">All status</option>
                  <option value="done">Generated</option>
                  <option value="generating">Generating</option>
                  <option value="error">Error</option>
                  <option value="draft">Saved draft</option>
                  <option value="publish">Published</option>
                </select>
              </>
            )}
            {(filterSearch || filterDate || filterCategory || filterStatus) && (
              <button onClick={() => { setFilterSearch(''); setFilterDate(''); setFilterCategory(''); setFilterStatus('') }}
                style={{ fontSize: 11, color: '#c8440a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                Clear filters
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>
              {view === 'pulled' ? `${displayItems.length} articles` : `${displayGenerated.length} articles`}
            </span>
          </div>

          {/* PULLED VIEW */}
          {view === 'pulled' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
              {displayItems.length === 0 && !isLoading && (
                <EmptyState icon="◈" title="No articles" description="Refresh to load from sources" />
              )}
              {displayItems.map((item, i) => (
                <div key={item.link || i} style={{
                  display: 'flex', gap: 12, padding: '12px 0',
                  borderBottom: '1px solid #edeae3',
                  opacity: item.seen ? 0.45 : 1,
                }}>
                  {/* Checkbox */}
                  <div onClick={() => !item.seen && toggleSelect(item.link)} style={{
                    width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 3,
                    border: `1.5px solid ${selected.includes(item.link) ? '#0d0d0d' : '#dedad2'}`,
                    background: selected.includes(item.link) ? '#0d0d0d' : '#fdfcf9',
                    cursor: item.seen ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected.includes(item.link) && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                  </div>

                  {/* Thumbnail */}
                  {item.image && (
                    <div style={{ width: 68, height: 48, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: '#edeae3' }}>
                      <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase' }}>{item.sourceName}</span>
                      {item.seen && <Badge color="gray">Generated</Badge>}
                      {item.pubDate && (
                        <span style={{ fontSize: 10, color: '#bbb', fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>
                          {new Date(item.pubDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    {/* Clickable title → original URL */}
                    <a href={item.link} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, fontWeight: 500, color: '#0d0d0d', lineHeight: 1.4, display: 'block', marginBottom: 3, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onClick={e => e.stopPropagation()}>
                      {item.title} ↗
                    </a>
                    <div style={{ fontSize: 11, color: '#9c9a92', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.summary?.replace(/<[^>]+>/g, '').slice(0, 140)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GENERATED VIEW */}
          {view === 'generated' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
              {displayGenerated.length === 0 && (
                <EmptyState icon="✦" title="No generated articles yet" description="Select articles and click Generate →" />
              )}
              {displayGenerated.map((g, i) => (
                <div key={i}
                  onClick={() => g.status === 'done' && openEditor(i)}
                  style={{
                    display: 'flex', gap: 12, padding: '12px 8px', borderBottom: '1px solid #edeae3',
                    borderRadius: 6, marginBottom: 2,
                    cursor: g.status === 'done' ? 'pointer' : 'default',
                    background: 'transparent', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (g.status === 'done') e.currentTarget.style.background = '#f5f3ee' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Status indicator */}
                  <div style={{ flexShrink: 0, marginTop: 4 }}>
                    {g.status === 'generating' && <Spinner size={14} />}
                    {g.status === 'done' && !g.article?.wpPostId && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c8440a', marginTop: 3 }} />}
                    {g.status === 'done' && g.article?.wpPostId && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a7a45', marginTop: 3 }} />}
                    {g.status === 'error' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c0271e', marginTop: 3 }} />}
                  </div>

                  {/* Thumbnail */}
                  {(g.article?.featuredImageUrl || g.item?.image) && (
                    <div style={{ width: 68, height: 48, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: '#edeae3' }}>
                      <img src={g.article?.featuredImageUrl || g.item?.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                      {g.article?.primaryCategory && <Badge color="blue">{g.article.primaryCategory}</Badge>}
                      {g.article?.wpPostId && <Badge color="green">WP #{g.article.wpPostId}</Badge>}
                      {g.article?.wordCount > 0 && <Badge color="gray">{g.article.wordCount}w</Badge>}
                      {g.status === 'generating' && <Badge color="amber">Generating…</Badge>}
                      {g.status === 'error' && <Badge color="red">Error</Badge>}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#bbb', fontFamily: "'DM Mono', monospace" }}>
                        {new Date(g.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0d0d0d', lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.status === 'generating' ? (
                        <span style={{ color: '#9c9a92', fontStyle: 'italic' }}>Generating: {g.item.title?.slice(0, 60)}…</span>
                      ) : g.status === 'error' ? (
                        <span style={{ color: '#c0271e' }}>{g.item.title} — {g.error?.slice(0, 80)}</span>
                      ) : g.article?.title}
                    </div>

                    {g.article?.excerpt && (
                      <div style={{ fontSize: 11, color: '#9c9a92', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                        {g.article.excerpt}
                      </div>
                    )}

                    {g.article && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {g.article.regionTags?.map(t => <Badge key={t} color="purple">{t}</Badge>)}
                        {g.article.keywordTags?.slice(0, 3).map(t => <Badge key={t} color="gray">{t}</Badge>)}
                        <a href={g.item.link} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 10, color: '#9c9a92', textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}>
                          {g.item.sourceName} ↗
                        </a>
                      </div>
                    )}
                  </div>

                  {g.status === 'done' && (
                    <div style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace", flexShrink: 0, marginTop: 4 }}>
                      Edit ›
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

const filterSelectStyle = {
  padding: '4px 8px', border: '1px solid #dedad2', borderRadius: 6,
  fontSize: 12, fontFamily: "'Sora', sans-serif",
  background: '#fdfcf9', color: '#0d0d0d', cursor: 'pointer',
}
