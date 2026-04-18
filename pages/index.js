// pages/index.js - Discover mode
import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Btn, Badge, Spinner, EmptyState, Topbar } from '../components/UI'
import { fetchRSS, scrapeArticle, generateArticle, saveToWordPress, resolveCategoryIds, resolveTagIds } from '../lib/api'
import { storage } from '../lib/storage'

const STORAGE_KEY = '1cw_discover_generated'

function loadPersistedGenerated() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function persistGenerated(items) {
  try {
    // Strip body to keep storage lean — only keep metadata
    const slim = items.map(g => ({ ...g, article: g.article ? { ...g.article, body: g.article.body?.slice(0, 500) + '…[truncated]' } : null }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim.slice(0, 50)))
  } catch {}
}

export default function Discover() {
  const [sources, setSources] = useState([])
  const [feedItems, setFeedItems] = useState({})
  const [loadingSource, setLoadingSource] = useState({})
  const [selected, setSelected] = useState([])
  const [generated, setGenerated] = useState([])
  const [editingArticle, setEditingArticle] = useState(null)
  const [editingLink, setEditingLink] = useState(null)
  const [activeSource, setActiveSource] = useState('all')
  const [view, setView] = useState('pulled')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [bulkSelected, setBulkSelected] = useState([]) // links selected in current view
  const [bulkAction, setBulkAction] = useState('')
  const [bulkWorking, setBulkWorking] = useState(false)
  const generatingRef = useRef(false)
  const fullArticles = useRef({}) // link → full article (with body) — not in state to avoid re-renders

  // Load persisted generated on mount
  useEffect(() => {
    const persisted = loadPersistedGenerated()
    if (persisted.length) setGenerated(persisted)
  }, [])

  // Persist generated whenever it changes
  useEffect(() => { persistGenerated(generated) }, [generated])

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
        ...item, sourceId: src.id, sourceName: src.name,
        seen: storage.isUrlSeen(item.link), pulledAt: Date.now(),
      }))
      setFeedItems(prev => ({ ...prev, [src.id]: items }))
    } catch { setFeedItems(prev => ({ ...prev, [src.id]: [] })) }
    setLoadingSource(prev => ({ ...prev, [src.id]: false }))
  }

  const allItems = Object.entries(feedItems).flatMap(([srcId, items]) =>
    items.map(item => ({ ...item, sourceId: srcId }))
  )

  const generatedLinks = new Set(generated.map(g => g.item?.link))

  const displayItems = (() => {
    let items = (activeSource === 'all' ? allItems : (feedItems[activeSource] || []))
      .filter(i => !generatedLinks.has(i.link)) // remove items already generated
    if (filterSearch) items = items.filter(i => i.title?.toLowerCase().includes(filterSearch.toLowerCase()))
    if (filterDate) {
      const cutoff = Date.now() - { '1h': 3600000, '24h': 86400000, '7d': 604800000 }[filterDate]
      items = items.filter(i => i.pubDate && new Date(i.pubDate).getTime() > cutoff)
    }
    return items
  })()

  const allCategories = [...new Set(generated.filter(g => g.article?.primaryCategory).map(g => g.article.primaryCategory))]

  const displayGenerated = (() => {
    let items = [...generated]
    if (filterCategory) items = items.filter(i => i.article?.primaryCategory?.toLowerCase().includes(filterCategory.toLowerCase()))
    if (filterStatus) items = items.filter(i => i.status === filterStatus || i.article?.wpStatus === filterStatus)
    if (filterSearch) items = items.filter(i => (i.article?.title || i.item?.title)?.toLowerCase().includes(filterSearch.toLowerCase()))
    return items
  })()

  function toggleSelect(link) {
    setSelected(prev => prev.includes(link) ? prev.filter(l => l !== link) : [...prev, link])
  }

  function toggleBulk(link) {
    setBulkSelected(prev => prev.includes(link) ? prev.filter(l => l !== link) : [...prev, link])
  }

  function selectAllBulk() {
    if (view === 'pulled') {
      setBulkSelected(displayItems.filter(i => !i.seen).map(i => i.link))
    } else {
      setBulkSelected(displayGenerated.filter(g => g.status === 'done').map(g => g.item.link))
    }
  }

  function deletePulled(links) {
    const linkSet = new Set(links)
    setFeedItems(prev => {
      const next = {}
      for (const [srcId, items] of Object.entries(prev)) {
        next[srcId] = items.filter(i => !linkSet.has(i.link))
      }
      return next
    })
    setSelected(prev => prev.filter(l => !linkSet.has(l)))
    setBulkSelected([])
  }

  function deleteGenerated(links) {
    const linkSet = new Set(links)
    setGenerated(prev => prev.filter(g => !linkSet.has(g.item?.link)))
    setBulkSelected([])
  }

  async function quickSave(links, status) {
    setBulkWorking(true)
    const settings = storage.getSettings()
    const cache = storage.getWPCache()
    for (const link of links) {
      const g = generated.find(x => x.item?.link === link)
      if (!g?.article) continue
      const full = fullArticles.current[link] || g.article
      try {
        const allCats = [full.primaryCategory, ...(full.additionalCategories || [])].filter(Boolean)
        const categoryIds = await resolveCategoryIds(allCats, cache.categories)
        const allTags = [...(full.regionTags || []), ...(full.keywordTags || [])]
        const tagIds = await resolveTagIds(allTags, cache.tags)
        const authors = storage.getAuthors()
        const authorId = authors[0]?.wpUserId || undefined
        const post = await saveToWordPress({ ...full, status }, { categoryIds, tagIds, authorId, featuredImageId: full.featuredImageId })
        setGenerated(prev => prev.map(x =>
          x.item?.link === link ? { ...x, article: { ...x.article, wpPostId: post.id, wpStatus: status } } : x
        ))
        storage.addHistory({ wpPostId: post.id, title: full.title, primaryCategory: full.primaryCategory, sourceUrl: link, status, url: post.link })
      } catch (err) {
        console.error('Quick save failed:', link, err.message)
      }
    }
    setBulkSelected([])
    setBulkWorking(false)
  }

  async function generateSelected() {
    if (!selected.length || generatingRef.current) return
    generatingRef.current = true
    const settings = storage.getSettings()
    const batchDelay = settings.batchDelay ?? 600

    const toGenerate = selected.map(link => ({
      link, item: allItems.find(i => i.link === link),
    })).filter(x => x.item)

    // Add placeholders + switch to generated tab
    setGenerated(prev => [
      ...toGenerate.map(({ item }) => ({
        item, article: null, status: 'generating', error: null, generatedAt: Date.now(),
      })),
      ...prev,
    ])
    setSelected([])
    setView('generated')

    try {
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
            content, title: item.title, sourceUrl: item.link,
            sourceName: item.sourceName || src?.name,
            primaryCategory: src?.primaryCategory,
            writingPrompt: src?.writingPrompt || settings.globalWritingPrompt,
            authorStyle: authorObj?.style || '',
            postFormat: src?.postFormat || 'standard', mode: 'rewrite',
          }, { batchIndex: idx, batchDelay: 0 })

          const full = { ...article, featuredImageUrl: item.image || '', sourceUrl: item.link, sourceName: item.sourceName || src?.name, videoUrl: src?.postFormat === 'video' ? item.link : '' }
          fullArticles.current[link] = full
          storage.addSeenUrl(item.link)

          setGenerated(prev => prev.map(g =>
            g.item.link === link ? { ...g, article: { ...full, body: full.body }, status: 'done' } : g
          ))
        } catch (err) {
          setGenerated(prev => prev.map(g =>
            g.item.link === link ? { ...g, status: 'error', error: err.message.slice(0, 120) } : g
          ))
        }
      }
    } finally {
      generatingRef.current = false
    }
  }

  function openEditor(link) {
    const g = generated.find(x => x.item?.link === link)
    if (!g?.article) return
    const full = fullArticles.current[link] || g.article
    setEditingArticle(full)
    setEditingLink(link)
  }

  function onEditorBack() { setEditingArticle(null); setEditingLink(null) }

  function onEditorSaved(post, updatedArticle) {
    if (editingLink && updatedArticle) {
      fullArticles.current[editingLink] = updatedArticle
      setGenerated(prev => prev.map(g =>
        g.item?.link === editingLink
          ? { ...g, article: { ...g.article, title: updatedArticle.title, primaryCategory: updatedArticle.primaryCategory, excerpt: updatedArticle.excerpt, wordCount: updatedArticle.wordCount, wpPostId: post?.id, wpStatus: post ? 'saved' : g.article?.wpStatus } }
          : g
      ))
    }
    setEditingArticle(null)
    setEditingLink(null)
  }

  if (editingArticle) {
    return (
      <Layout>
        <ArticleEditor
          article={editingArticle}
          source={sources.find(s => s.name === editingArticle.sourceName)}
          onBack={onEditorBack}
          onSaved={onEditorSaved}
        />
      </Layout>
    )
  }

  const isLoading = Object.values(loadingSource).some(Boolean)
  const generatingCount = generated.filter(g => g.status === 'generating').length

  return (
    <Layout>
      {/* Topbar */}
      <Topbar
        title="Discover"
        subtitle={`${allItems.length} pulled · ${generated.length} generated`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn variant="secondary" size="sm" onClick={() => {
              const s = storage.getSources().filter(s => s.type === 'rss' && s.active)
              setSources(s); setFeedItems({}); s.forEach(src => loadSource(src))
            }}>
              {isLoading ? <Spinner size={12} /> : '↺'} Refresh
            </Btn>
            {selected.length > 0 && (
              <Btn variant="accent" size="sm" onClick={generateSelected}>
                {generatingCount > 0 ? <><Spinner size={12} />Generating {generatingCount}…</> : `Generate ${selected.length} →`}
              </Btn>
            )}
          </div>
        }
      />

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #dedad2', background: '#fdfcf9', padding: '0 20px', display: 'flex', alignItems: 'flex-end', gap: 0, flexShrink: 0 }}>
        {[
          ['pulled', `Pulled`, allItems.filter(i => !generatedLinks.has(i.link)).length],
          ['generated', `Generated`, generated.length],
        ].map(([v, label, count]) => (
          <button key={v} onClick={() => { setView(v); setBulkSelected([]) }}
            style={{
              padding: '10px 20px', fontSize: 13, cursor: 'pointer', border: 'none',
              borderBottom: view === v ? '2px solid #0d0d0d' : '2px solid transparent',
              background: 'transparent',
              color: view === v ? '#0d0d0d' : '#9c9a92',
              fontFamily: "'Sora', sans-serif", fontWeight: view === v ? 600 : 400,
              marginBottom: -1, transition: 'all 0.15s',
            }}>
            {label}
            <span style={{ marginLeft: 6, fontSize: 11, fontFamily: "'DM Mono', monospace",
              background: view === v ? '#0d0d0d' : '#edeae3',
              color: view === v ? '#fff' : '#9c9a92',
              padding: '1px 6px', borderRadius: 10,
            }}>{count}</span>
          </button>
        ))}
        {generatingCount > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, fontSize: 12, color: '#c8440a', fontFamily: "'DM Mono', monospace" }}>
            <Spinner size={11} /> {generatingCount} generating…
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Source sidebar */}
        <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid #dedad2', background: '#fdfcf9', padding: '10px 6px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 6px', marginBottom: 4 }}>Sources</div>
          {[{ id: 'all', name: 'All' }, ...sources].map(src => (
            <div key={src.id} onClick={() => setActiveSource(src.id)} style={{
              padding: '6px 8px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
              background: activeSource === src.id ? '#0d0d0d' : 'transparent',
              color: activeSource === src.id ? '#fff' : '#5c5b57',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.name}</span>
              {src.id !== 'all' && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4, flexShrink: 0 }}>{loadingSource[src.id] ? '…' : (feedItems[src.id]?.length || 0)}</span>}
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Filter + bulk bar */}
          <div style={{ borderBottom: '1px solid #dedad2', background: '#f9f8f5', padding: '7px 14px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search…"
              style={{ padding: '4px 10px', border: '1px solid #dedad2', borderRadius: 5, fontSize: 12, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', outline: 'none', width: 140 }} />

            {view === 'pulled' && (
              <select value={filterDate} onChange={e => setFilterDate(e.target.value)} style={fsel}>
                <option value="">All time</option>
                <option value="1h">Last hour</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 days</option>
              </select>
            )}
            {view === 'generated' && (
              <>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={fsel}>
                  <option value="">All categories</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={fsel}>
                  <option value="">All status</option>
                  <option value="done">Generated</option>
                  <option value="generating">Generating</option>
                  <option value="error">Error</option>
                  <option value="saved">Saved to WP</option>
                </select>
              </>
            )}

            {/* Bulk actions */}
            {bulkSelected.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#5c5b57' }}>{bulkSelected.length} selected</span>
                {view === 'pulled' && (
                  <Btn variant="danger" size="sm" onClick={() => deletePulled(bulkSelected)}>Delete</Btn>
                )}
                {view === 'generated' && (
                  <>
                    <Btn variant="secondary" size="sm" disabled={bulkWorking} onClick={() => quickSave(bulkSelected, 'draft')}>
                      {bulkWorking ? <Spinner size={10} /> : ''}Save Drafts
                    </Btn>
                    <Btn variant="accent" size="sm" disabled={bulkWorking} onClick={() => quickSave(bulkSelected, 'publish')}>
                      {bulkWorking ? <Spinner size={10} /> : ''}Publish All
                    </Btn>
                    <Btn variant="danger" size="sm" onClick={() => deleteGenerated(bulkSelected)}>Delete</Btn>
                  </>
                )}
                <button onClick={() => setBulkSelected([])} style={{ fontSize: 11, color: '#9c9a92', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <button onClick={selectAllBulk} style={{ fontSize: 11, color: '#9c9a92', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                Select all
              </button>
            )}

            {(filterSearch || filterDate || filterCategory || filterStatus) && (
              <button onClick={() => { setFilterSearch(''); setFilterDate(''); setFilterCategory(''); setFilterStatus('') }}
                style={{ fontSize: 11, color: '#c8440a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                Clear filters
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>
              {view === 'pulled' ? displayItems.length : displayGenerated.length} articles
            </span>
          </div>

          {/* PULLED */}
          {view === 'pulled' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '0 14px' }}>
              {displayItems.length === 0 && !isLoading && (
                <EmptyState icon="◈" title="No articles" description="Refresh to load from sources" />
              )}
              {displayItems.map((item, i) => {
                const isBulk = bulkSelected.includes(item.link)
                const isGen = selected.includes(item.link)
                return (
                  <div key={item.link || i} style={{ display: 'flex', gap: 10, padding: '11px 0', borderBottom: '1px solid #edeae3', opacity: item.seen ? 0.4 : 1, alignItems: 'flex-start' }}>
                    {/* Bulk checkbox */}
                    <div onClick={() => toggleBulk(item.link)} style={{ width: 15, height: 15, borderRadius: 3, flexShrink: 0, marginTop: 3, border: `1.5px solid ${isBulk ? '#9c9a92' : '#dedad2'}`, background: isBulk ? '#9c9a92' : '#fdfcf9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isBulk && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                    </div>
                    {/* Generate checkbox */}
                    <div onClick={() => !item.seen && toggleSelect(item.link)} style={{ width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2, border: `1.5px solid ${isGen ? '#0d0d0d' : '#dedad2'}`, background: isGen ? '#0d0d0d' : '#fdfcf9', cursor: item.seen ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isGen && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                    </div>
                    {item.image && (
                      <div style={{ width: 64, height: 44, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#edeae3' }}>
                        <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase' }}>{item.sourceName}</span>
                        {item.seen && <Badge color="gray">Done</Badge>}
                        {item.pubDate && <span style={{ fontSize: 10, color: '#bbb', fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>{new Date(item.pubDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 13, fontWeight: 500, color: '#0d0d0d', lineHeight: 1.35, display: 'block', marginBottom: 2, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title} ↗
                      </a>
                      <div style={{ fontSize: 11, color: '#9c9a92', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                        {item.summary?.replace(/<[^>]+>/g, '').slice(0, 120)}
                      </div>
                    </div>
                    <button onClick={() => deletePulled([item.link])} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dedad2', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}
                      onMouseEnter={e => e.target.style.color = '#c0271e'} onMouseLeave={e => e.target.style.color = '#dedad2'}>✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* GENERATED */}
          {view === 'generated' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '0 14px' }}>
              {displayGenerated.length === 0 && (
                <EmptyState icon="✦" title="No generated articles" description="Select articles in Pulled tab and click Generate →" />
              )}
              {displayGenerated.map((g, i) => {
                const isBulk = bulkSelected.includes(g.item?.link)
                const isDone = g.status === 'done'
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid #edeae3', alignItems: 'flex-start' }}>
                    {/* Bulk checkbox */}
                    {isDone && (
                      <div onClick={() => toggleBulk(g.item.link)} style={{ width: 15, height: 15, borderRadius: 3, flexShrink: 0, marginTop: 4, border: `1.5px solid ${isBulk ? '#9c9a92' : '#dedad2'}`, background: isBulk ? '#9c9a92' : '#fdfcf9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isBulk && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                      </div>
                    )}
                    {!isDone && <div style={{ width: 15, flexShrink: 0 }} />}

                    {/* Status dot */}
                    <div style={{ flexShrink: 0, marginTop: 5 }}>
                      {g.status === 'generating' && <Spinner size={13} />}
                      {g.status === 'done' && !g.article?.wpPostId && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c8440a' }} />}
                      {g.status === 'done' && g.article?.wpPostId && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a7a45' }} />}
                      {g.status === 'error' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c0271e' }} />}
                    </div>

                    {(g.article?.featuredImageUrl || g.item?.image) && (
                      <div style={{ width: 64, height: 44, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#edeae3' }}>
                        <img src={g.article?.featuredImageUrl || g.item?.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
                        {g.article?.primaryCategory && <Badge color="blue">{g.article.primaryCategory}</Badge>}
                        {g.article?.wpPostId && <Badge color="green">WP #{g.article.wpPostId}</Badge>}
                        {g.article?.wordCount > 0 && <Badge color="gray">{g.article.wordCount}w</Badge>}
                        {g.status === 'generating' && <Badge color="amber">Generating…</Badge>}
                        {g.status === 'error' && <Badge color="red">Error</Badge>}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#bbb', fontFamily: "'DM Mono', monospace" }}>{new Date(g.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: g.status === 'error' ? '#c0271e' : '#0d0d0d', lineHeight: 1.35, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.status === 'generating' ? <span style={{ color: '#9c9a92', fontStyle: 'italic' }}>Generating: {g.item?.title?.slice(0, 55)}…</span>
                         : g.status === 'error' ? `${g.item?.title} — ${g.error?.slice(0, 60)}`
                         : (g.article?.title || g.item?.title)}
                      </div>
                      {g.article?.excerpt && (
                        <div style={{ fontSize: 11, color: '#9c9a92', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{g.article.excerpt}</div>
                      )}
                      {g.article && (
                        <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                          {g.article.regionTags?.map(t => <Badge key={t} color="purple">{t}</Badge>)}
                          {g.article.keywordTags?.slice(0, 2).map(t => <Badge key={t} color="gray">{t}</Badge>)}
                          <a href={g.item?.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#9c9a92', textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}>{g.item?.sourceName} ↗</a>
                        </div>
                      )}
                    </div>

                    {/* Row actions */}
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                      {isDone && (
                        <>
                          {!g.article?.wpPostId && (
                            <Btn variant="secondary" size="sm" onClick={() => quickSave([g.item.link], 'draft')} disabled={bulkWorking}>Draft</Btn>
                          )}
                          <Btn variant="accent" size="sm" onClick={() => quickSave([g.item.link], 'publish')} disabled={bulkWorking}>Publish</Btn>
                          <Btn variant="primary" size="sm" onClick={() => openEditor(g.item.link)}>Edit →</Btn>
                        </>
                      )}
                      <button onClick={() => deleteGenerated([g.item?.link])} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dedad2', fontSize: 14, padding: '2px 4px' }}
                        onMouseEnter={e => e.target.style.color = '#c0271e'} onMouseLeave={e => e.target.style.color = '#dedad2'}>✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

const fsel = {
  padding: '4px 8px', border: '1px solid #dedad2', borderRadius: 5,
  fontSize: 12, fontFamily: "'Sora', sans-serif",
  background: '#fdfcf9', color: '#0d0d0d', cursor: 'pointer',
}
