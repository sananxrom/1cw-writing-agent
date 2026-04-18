// pages/index.js - Discover mode
// DB-backed pulled articles, RSS + scrape sources, persistent queue
import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Btn, Badge, Spinner, EmptyState, Topbar } from '../components/UI'
import { pullSource, deletePulledFromDB, updatePulledStatusDB, scrapeArticle, generateArticle, saveToWordPress, resolveCategoryIds, resolveTagIds } from '../lib/api'
import { storage } from '../lib/storage'

const GEN_KEY = '1cw_discover_generated'

function loadGenerated() {
  try { return JSON.parse(localStorage.getItem(GEN_KEY) || '[]') } catch { return [] }
}
function saveGenerated(items) {
  try {
    const slim = items.map(g => ({ ...g, article: g.article ? { ...g.article, body: (g.article.body || '').slice(0, 400) } : null }))
    localStorage.setItem(GEN_KEY, JSON.stringify(slim.slice(0, 100)))
  } catch {}
}

export default function Discover() {
  const [sources, setSources] = useState([])
  const [pulled, setPulled] = useState([])
  const [loadingSource, setLoadingSource] = useState({})
  const [selected, setSelected] = useState([])      // for generate
  const [bulkSelected, setBulkSelected] = useState([])  // for bulk actions
  const [generated, setGenerated] = useState([])
  const [editingArticle, setEditingArticle] = useState(null)
  const [editingLink, setEditingLink] = useState(null)
  const [activeSource, setActiveSource] = useState('all')
  const [view, setView] = useState('pulled')
  const [dateRange, setDateRange] = useState('today')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [bulkWorking, setBulkWorking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { urls, label }
  const generatingRef = useRef(false)
  const fullArticles = useRef({})

  useEffect(() => {
    const gen = loadGenerated()
    if (gen.length) setGenerated(gen)
    loadSources()
    document.addEventListener('visibilitychange', loadSources)
    return () => document.removeEventListener('visibilitychange', loadSources)
  }, [])

  useEffect(() => { saveGenerated(generated) }, [generated])

  function loadSources() {
    const s = storage.getSources().filter(s => (s.type === 'rss' || s.type === 'scrape') && s.active)
    setSources(s)
  }

  async function fetchSource(src, refresh = true) {
    setLoadingSource(prev => ({ ...prev, [src.id]: true }))
    try {
      const data = await pullSource({ source: src, dateRange, refresh })
      setPulled(prev => {
        const others = prev.filter(p => p.sourceId !== src.id)
        return [...data.articles, ...others]
      })
    } catch (err) {
      console.error('[discover] fetch failed:', err.message)
    }
    setLoadingSource(prev => ({ ...prev, [src.id]: false }))
  }

  async function refreshAll() {
    for (const src of sources) await fetchSource(src, true)
  }

  async function loadAll() {
    for (const src of sources) await fetchSource(src, false)
  }

  useEffect(() => {
    if (sources.length) loadAll()
  }, [sources, dateRange])

  const generatedUrls = new Set(generated.map(g => g.item?.url || g.item?.link))

  const displayPulled = (() => {
    let items = activeSource === 'all'
      ? pulled
      : pulled.filter(p => p.sourceId === activeSource)
    items = items.filter(p => !generatedUrls.has(p.url))
    if (filterSearch) items = items.filter(i => i.title?.toLowerCase().includes(filterSearch.toLowerCase()))
    return items
  })()

  const allCategories = [...new Set(generated.filter(g => g.article?.primaryCategory).map(g => g.article.primaryCategory))]

  const displayGenerated = (() => {
    let items = [...generated]
    if (filterCategory) items = items.filter(i => i.article?.primaryCategory?.toLowerCase().includes(filterCategory.toLowerCase()))
    if (filterStatus === 'generating') items = items.filter(i => i.status === 'generating')
    else if (filterStatus === 'error') items = items.filter(i => i.status === 'error')
    else if (filterStatus === 'saved') items = items.filter(i => i.article?.wpPostId)
    else if (filterStatus === 'unsaved') items = items.filter(i => i.status === 'done' && !i.article?.wpPostId)
    if (filterSearch) items = items.filter(i => (i.article?.title || i.item?.title)?.toLowerCase().includes(filterSearch.toLowerCase()))
    return items
  })()

  function toggleSelect(url) {
    setSelected(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url])
  }
  function toggleBulk(url) {
    setBulkSelected(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url])
  }
  function selectAllBulk() {
    if (view === 'pulled') setBulkSelected(displayPulled.map(i => i.url))
    else setBulkSelected(displayGenerated.filter(g => g.status === 'done').map(g => g.item?.url))
  }

  // ── Delete with confirmation ────────────────────────────
  function askDelete(urls, label) {
    setConfirmDelete({ urls, label })
  }
  async function confirmDoDelete() {
    if (!confirmDelete) return
    const { urls } = confirmDelete
    if (view === 'pulled' || confirmDelete.view === 'pulled') {
      await deletePulledFromDB(urls)
      setPulled(prev => prev.filter(p => !urls.includes(p.url)))
      setSelected(prev => prev.filter(u => !urls.includes(u)))
    } else {
      setGenerated(prev => prev.filter(g => !urls.includes(g.item?.url)))
    }
    setBulkSelected([])
    setConfirmDelete(null)
  }

  // ── Quick save to WP ───────────────────────────────────
  async function quickSave(urls, status) {
    setBulkWorking(true)
    const cache = storage.getWPCache()
    for (const url of urls) {
      const g = generated.find(x => (x.item?.url || x.item?.link) === url)
      if (!g?.article) continue
      const full = fullArticles.current[url] || g.article
      try {
        const allCats = [full.primaryCategory, ...(full.additionalCategories || [])].filter(Boolean)
        const categoryIds = await resolveCategoryIds(allCats, cache.categories)
        const allTags = [...(full.regionTags || []), ...(full.keywordTags || [])]
        const tagIds = await resolveTagIds(allTags, cache.tags)
        const authors = storage.getAuthors()
        const authorId = authors[0]?.wpUserId || undefined
        const post = await saveToWordPress({ ...full, status }, { categoryIds, tagIds, authorId, featuredImageId: full.featuredImageId })
        setGenerated(prev => prev.map(x =>
          (x.item?.url || x.item?.link) === url ? { ...x, article: { ...x.article, wpPostId: post.id, wpStatus: status } } : x
        ))
        await updatePulledStatusDB([url], 'generated')
        storage.addHistory({ wpPostId: post.id, title: full.title, primaryCategory: full.primaryCategory, sourceUrl: url, status, url: post.link })
      } catch (err) { console.error('quickSave error:', err.message) }
    }
    setBulkSelected([])
    setBulkWorking(false)
  }

  // ── Generate ───────────────────────────────────────────
  async function generateSelected() {
    if (!selected.length || generatingRef.current) return
    generatingRef.current = true
    const settings = storage.getSettings()
    const batchDelay = settings.batchDelay ?? 600

    const toGenerate = selected.map(url => ({
      url, item: pulled.find(i => i.url === url),
    })).filter(x => x.item)

    setGenerated(prev => [
      ...toGenerate.map(({ item }) => ({ item: { ...item, link: item.url }, article: null, status: 'generating', error: null, generatedAt: Date.now() })),
      ...prev,
    ])
    setSelected([])
    setView('generated')

    try {
      for (const [idx, { url, item }] of toGenerate.entries()) {
        const src = sources.find(s => s.id === item.sourceId)
        try {
          if (idx > 0) await new Promise(r => setTimeout(r, batchDelay))

          let content = item.content || item.summary || ''
          try {
            const scraped = await scrapeArticle(item.url)
            if (scraped.text?.length > content.length) content = scraped.text
            if (!item.image && scraped.image) item.image = scraped.image
          } catch {}

          const authors = storage.getAuthors()
          const authorObj = authors.find(a => a.id === src?.defaultAuthor)
          const article = await generateArticle({
            content, title: item.title, sourceUrl: item.url,
            sourceName: item.sourceName || src?.name,
            primaryCategory: src?.primaryCategory,
            writingPrompt: src?.writingPrompt || settings.globalWritingPrompt,
            authorStyle: authorObj?.style || '',
            postFormat: src?.postFormat || 'standard', mode: 'rewrite',
          }, { batchIndex: idx, batchDelay: 0 })

          const full = { ...article, featuredImageUrl: item.image || '', sourceUrl: item.url, sourceName: item.sourceName || src?.name, videoUrl: src?.postFormat === 'video' ? item.url : '' }
          fullArticles.current[url] = full
          storage.addSeenUrl(url)
          await updatePulledStatusDB([url], 'generated')

          setGenerated(prev => prev.map(g =>
            (g.item?.url || g.item?.link) === url ? { ...g, article: full, status: 'done' } : g
          ))
        } catch (err) {
          setGenerated(prev => prev.map(g =>
            (g.item?.url || g.item?.link) === url ? { ...g, status: 'error', error: err.message.slice(0, 120) } : g
          ))
        }
      }
    } finally { generatingRef.current = false }
  }

  function openEditor(url) {
    const g = generated.find(x => (x.item?.url || x.item?.link) === url)
    if (!g?.article) return
    setEditingArticle(fullArticles.current[url] || g.article)
    setEditingLink(url)
  }

  function onEditorBack() { setEditingArticle(null); setEditingLink(null) }
  function onEditorSaved(post, updatedArticle) {
    if (editingLink && updatedArticle) {
      fullArticles.current[editingLink] = updatedArticle
      setGenerated(prev => prev.map(g =>
        (g.item?.url || g.item?.link) === editingLink
          ? { ...g, article: { ...g.article, title: updatedArticle.title, primaryCategory: updatedArticle.primaryCategory, excerpt: updatedArticle.excerpt, wordCount: updatedArticle.wordCount, wpPostId: post?.id } }
          : g
      ))
    }
    setEditingArticle(null); setEditingLink(null)
  }

  if (editingArticle) return (
    <Layout>
      <ArticleEditor article={editingArticle} source={sources.find(s => s.name === editingArticle.sourceName)} onBack={onEditorBack} onSaved={onEditorSaved} />
    </Layout>
  )

  const isLoading = Object.values(loadingSource).some(Boolean)
  const generatingCount = generated.filter(g => g.status === 'generating').length

  return (
    <Layout>
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fdfcf9', borderRadius: 12, padding: 28, maxWidth: 380, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#0d0d0d', marginBottom: 10 }}>Delete {confirmDelete.urls.length} article{confirmDelete.urls.length > 1 ? 's' : ''}?</div>
            <div style={{ fontSize: 13, color: '#9c9a92', marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={confirmDoDelete}>Delete</Btn>
            </div>
          </div>
        </div>
      )}

      <Topbar title="Discover" subtitle={`${displayPulled.length} pulled · ${generated.length} generated`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={fsel}>
              <option value="today">Today</option>
              <option value="3days">Last 3 days</option>
              <option value="week">This week</option>
              <option value="all">All time</option>
            </select>
            <Btn variant="secondary" size="sm" onClick={refreshAll} disabled={isLoading}>
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

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #dedad2', background: '#fdfcf9', padding: '0 20px', display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
        {[['pulled', 'Pulled', displayPulled.length], ['generated', 'Generated', generated.length]].map(([v, label, count]) => (
          <button key={v} onClick={() => { setView(v); setBulkSelected([]) }} style={{
            padding: '10px 18px', fontSize: 13, cursor: 'pointer', border: 'none',
            borderBottom: view === v ? '2px solid #0d0d0d' : '2px solid transparent',
            background: 'transparent', color: view === v ? '#0d0d0d' : '#9c9a92',
            fontFamily: "'Sora', sans-serif", fontWeight: view === v ? 600 : 400, marginBottom: -1,
          }}>
            {label}
            <span style={{ marginLeft: 6, fontSize: 11, fontFamily: "'DM Mono', monospace", background: view === v ? '#0d0d0d' : '#edeae3', color: view === v ? '#fff' : '#9c9a92', padding: '1px 6px', borderRadius: 10 }}>{count}</span>
          </button>
        ))}
        {generatingCount > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, fontSize: 12, color: '#c8440a', fontFamily: "'DM Mono', monospace" }}>
            <Spinner size={11} /> {generatingCount} generating…
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Source sidebar */}
        <div style={{ width: 155, flexShrink: 0, borderRight: '1px solid #dedad2', background: '#fdfcf9', padding: '10px 6px', overflow: 'auto' }}>
          <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 6px', marginBottom: 4 }}>Sources</div>
          {[{ id: 'all', name: 'All', type: '' }, ...sources].map(src => (
            <div key={src.id} onClick={() => setActiveSource(src.id)} style={{
              padding: '6px 8px', borderRadius: 5, fontSize: 12, cursor: 'pointer', marginBottom: 1,
              background: activeSource === src.id ? '#0d0d0d' : 'transparent',
              color: activeSource === src.id ? '#fff' : '#5c5b57',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.name}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginLeft: 4 }}>
                {src.type && <span style={{ fontSize: 9, opacity: 0.5 }}>{src.type}</span>}
                {src.id !== 'all' && (
                  <span style={{ fontSize: 10, opacity: 0.6 }}>
                    {loadingSource[src.id] ? '…' : pulled.filter(p => p.sourceId === src.id && !generatedUrls.has(p.url)).length}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Filter + bulk bar */}
          <div style={{ borderBottom: '1px solid #dedad2', background: '#f9f8f5', padding: '7px 14px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search…"
              style={{ padding: '4px 10px', border: '1px solid #dedad2', borderRadius: 5, fontSize: 12, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', outline: 'none', width: 130 }} />
            {view === 'generated' && (
              <>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={fsel}>
                  <option value="">All categories</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={fsel}>
                  <option value="">All status</option>
                  <option value="unsaved">Not saved</option>
                  <option value="saved">Saved to WP</option>
                  <option value="generating">Generating</option>
                  <option value="error">Error</option>
                </select>
              </>
            )}

            {/* Bulk actions */}
            {bulkSelected.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#5c5b57' }}>{bulkSelected.length} selected</span>
                {view === 'pulled' && (
                  <>
                    <Btn variant="accent" size="sm" onClick={() => { setSelected(bulkSelected); setBulkSelected([]) }}>Generate</Btn>
                    <Btn variant="danger" size="sm" onClick={() => askDelete(bulkSelected, `${bulkSelected.length} articles`)}>Delete</Btn>
                  </>
                )}
                {view === 'generated' && (
                  <>
                    <Btn variant="secondary" size="sm" disabled={bulkWorking} onClick={() => quickSave(bulkSelected, 'draft')}>{bulkWorking ? <Spinner size={10} /> : ''}Drafts</Btn>
                    <Btn variant="accent" size="sm" disabled={bulkWorking} onClick={() => quickSave(bulkSelected, 'publish')}>{bulkWorking ? <Spinner size={10} /> : ''}Publish</Btn>
                    <Btn variant="danger" size="sm" onClick={() => { setConfirmDelete({ urls: bulkSelected, label: bulkSelected.length }); }}>Delete</Btn>
                  </>
                )}
                <button onClick={() => setBulkSelected([])} style={{ fontSize: 11, color: '#9c9a92', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <button onClick={selectAllBulk} style={{ fontSize: 11, color: '#9c9a92', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Select all</button>
            )}

            {(filterSearch || filterCategory || filterStatus) && (
              <button onClick={() => { setFilterSearch(''); setFilterCategory(''); setFilterStatus('') }}
                style={{ fontSize: 11, color: '#c8440a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Clear</button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>
              {view === 'pulled' ? displayPulled.length : displayGenerated.length} articles
            </span>
          </div>

          {/* PULLED */}
          {view === 'pulled' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '0 14px' }}>
              {isLoading && pulled.length === 0 && <div style={{ textAlign: 'center', padding: 48 }}><Spinner size={24} /></div>}
              {!isLoading && displayPulled.length === 0 && (
                <EmptyState icon="◈" title="No articles" description={`No articles for the selected period. Try "All time" or Refresh.`} />
              )}
              {displayPulled.map((item, i) => {
                const isBulk = bulkSelected.includes(item.url)
                const isGen = selected.includes(item.url)
                const isChecked = isBulk || isGen
                return (
                  <div key={item.url || i} style={{ display: 'flex', gap: 10, padding: '11px 0', borderBottom: '1px solid #edeae3', alignItems: 'flex-start' }}>
                    {/* Single checkbox — toggles both bulk+generate */}
                    <div onClick={() => { toggleBulk(item.url); toggleSelect(item.url) }}
                      style={{ width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 3, border: `1.5px solid ${isChecked ? '#0d0d0d' : '#dedad2'}`, background: isChecked ? '#0d0d0d' : '#fdfcf9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isChecked && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                    </div>
                    {item.image && (
                      <div style={{ width: 64, height: 44, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#edeae3' }}>
                        <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase' }}>{item.sourceName}</span>
                        {item.sourceType === 'scrape' && <Badge color="purple">scrape</Badge>}
                        {item.status === 'generated' && <Badge color="green">Generated</Badge>}
                        {item.pubDate && <span style={{ fontSize: 10, color: '#bbb', fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>{new Date(item.pubDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 13, fontWeight: 500, color: '#0d0d0d', lineHeight: 1.35, display: 'block', marginBottom: 2, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title} ↗
                      </a>
                      <div style={{ fontSize: 11, color: '#9c9a92', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                        {item.summary?.replace(/<[^>]+>/g, '').slice(0, 120)}
                      </div>
                    </div>
                    {/* Row actions */}
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                      <Btn variant="accent" size="sm" onClick={() => { setSelected([item.url]); setTimeout(generateSelected, 50) }}>Generate</Btn>
                      <Btn variant="danger" size="sm" onClick={() => askDelete([item.url], `"${item.title?.slice(0,30)}…"`)}>Delete</Btn>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* GENERATED */}
          {view === 'generated' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '0 14px' }}>
              {displayGenerated.length === 0 && <EmptyState icon="✦" title="No generated articles" description="Select articles in Pulled tab → Generate →" />}
              {displayGenerated.map((g, i) => {
                const url = g.item?.url || g.item?.link
                const isBulk = bulkSelected.includes(url)
                const isDone = g.status === 'done'
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid #edeae3', alignItems: 'flex-start' }}>
                    {isDone
                      ? <div onClick={() => toggleBulk(url)} style={{ width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 4, border: `1.5px solid ${isBulk ? '#0d0d0d' : '#dedad2'}`, background: isBulk ? '#0d0d0d' : '#fdfcf9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isBulk && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                        </div>
                      : <div style={{ width: 17, flexShrink: 0 }} />
                    }
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
                        <div style={{ fontSize: 11, color: '#9c9a92', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{g.article.excerpt}</div>
                      )}
                      {g.article && (
                        <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                          {g.article.regionTags?.map(t => <Badge key={t} color="purple">{t}</Badge>)}
                          {g.article.keywordTags?.slice(0, 2).map(t => <Badge key={t} color="gray">{t}</Badge>)}
                          <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#9c9a92', textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}>{g.item?.sourceName} ↗</a>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                      {isDone && (
                        <>
                          {!g.article?.wpPostId && <Btn variant="secondary" size="sm" disabled={bulkWorking} onClick={() => quickSave([url], 'draft')}>Draft</Btn>}
                          <Btn variant="accent" size="sm" disabled={bulkWorking} onClick={() => quickSave([url], 'publish')}>Publish</Btn>
                          <Btn variant="primary" size="sm" onClick={() => openEditor(url)} style={{ minWidth: 72 }}>Edit →</Btn>
                        </>
                      )}
                      <Btn variant="danger" size="sm" onClick={() => { setConfirmDelete({ urls: [url] }) }}>Delete</Btn>
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

const fsel = { padding: '4px 8px', border: '1px solid #dedad2', borderRadius: 5, fontSize: 12, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', cursor: 'pointer' }
