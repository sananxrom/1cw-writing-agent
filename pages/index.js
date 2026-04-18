// pages/index.js — Discover with 3-column layout (design/discover.jsx)
import { useState, useEffect, useRef, useMemo } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Btn, Badge, Spinner, EmptyState, Topbar, I, Tip, Checkbox, InlineSelect, TextInput, relTime } from '../components/UI'
import { pullSource, deletePulledFromDB, updatePulledStatusDB, scrapeArticle, generateArticle, saveToWordPress, resolveCategoryIds, resolveTagIds } from '../lib/api'
import { storage } from '../lib/storage'

const GEN_KEY = '1cw_discover_generated'
const CATEGORIES = [
  'Artificial Intelligence','XR, VR, AR – XROM','Blockchain','Quantum & Nanotechnology',
  'Robotics & Automation','Automotive','Life Sciences & Biotechnology','Earth & Environment',
  'Health & Medicine','Space & Astronomy','Startups & Entrepreneurship','Policy & Economy',
  'Corporate Tech & Semiconductors','Telecom & Energy Tech',
]

function loadGenerated() {
  try { return JSON.parse(localStorage.getItem(GEN_KEY) || '[]') } catch { return [] }
}
function saveGenerated(items) {
  try {
    const slim = items.map(g => ({ ...g, article: g.article ? { ...g.article, body: (g.article.body || '').slice(0, 300) } : null }))
    localStorage.setItem(GEN_KEY, JSON.stringify(slim.slice(0, 100)))
  } catch {}
}

export default function Discover() {
  const [sources, setSources] = useState([])
  const [pulled, setPulled] = useState([])
  const [loadingSource, setLoadingSource] = useState({})
  const [selected, setSelected] = useState([])    // for generate queue
  const [bulk, setBulk] = useState([])             // for bulk actions
  const [generated, setGenerated] = useState([])
  const [tab, setTab] = useState('pulled')
  const [activeSource, setActiveSource] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState('today')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [editingLink, setEditingLink] = useState(null)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const generatingRef = useRef(false)
  const fullArticles = useRef({})

  const toast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

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
    } catch (err) { console.error('[discover]', err.message) }
    setLoadingSource(prev => ({ ...prev, [src.id]: false }))
  }

  async function refreshAll() { for (const src of sources) await fetchSource(src, true) }
  async function loadAll() { for (const src of sources) await fetchSource(src, false) }
  useEffect(() => { if (sources.length) loadAll() }, [sources, dateRange])

  const generatedUrls = useMemo(() => new Set(generated.map(g => g.item?.url || g.item?.link)), [generated])

  const displayPulled = useMemo(() => {
    let items = (activeSource === 'all' ? pulled : pulled.filter(p => p.sourceId === activeSource))
      .filter(p => !generatedUrls.has(p.url))
    if (search) items = items.filter(i => i.title?.toLowerCase().includes(search.toLowerCase()))
    return items
  }, [pulled, activeSource, generatedUrls, search])

  const displayGenerated = useMemo(() => {
    let items = [...generated]
    if (search) items = items.filter(g => (g.article?.title || g.item?.title)?.toLowerCase().includes(search.toLowerCase()))
    return items
  }, [generated, search])

  const items = tab === 'pulled' ? displayPulled : displayGenerated
  const selectedItem = useMemo(() => items.find(i => (i.url || i.item?.url) === selectedId || i.id === selectedId) || items[0], [items, selectedId])

  function toggleBulk(id) { setBulk(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]) }
  function toggleSelect(url) { setSelected(s => s.includes(url) ? s.filter(x => x !== url) : [...s, url]) }
  const selectAll = () => setBulk(items.map(i => i.url || i.item?.url).filter(Boolean))
  const clearBulk = () => setBulk([])

  function askDelete(urls, fromTab) { setConfirmDelete({ urls, fromTab }) }
  async function doDelete() {
    if (!confirmDelete) return
    const { urls, fromTab } = confirmDelete
    if (fromTab === 'pulled') {
      await deletePulledFromDB(urls).catch(() => {})
      setPulled(prev => prev.filter(p => !urls.includes(p.url)))
    } else {
      setGenerated(prev => prev.filter(g => !urls.includes(g.item?.url)))
    }
    setBulk([]); setConfirmDelete(null); toast(`Deleted ${urls.length} article${urls.length > 1 ? 's' : ''}`)
  }

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
        const authorId = storage.getAuthors()[0]?.wpUserId
        const post = await saveToWordPress({ ...full, status }, { categoryIds, tagIds, authorId, featuredImageId: full.featuredImageId })
        setGenerated(prev => prev.map(x =>
          (x.item?.url || x.item?.link) === url ? { ...x, article: { ...x.article, wpPostId: post.id, wpStatus: status } } : x
        ))
        await updatePulledStatusDB([url], 'generated').catch(() => {})
        storage.addHistory({ wpPostId: post.id, title: full.title, primaryCategory: full.primaryCategory, sourceUrl: url, status, url: post.link })
        toast(`Saved as ${status} to 1cw.org`)
      } catch (err) { console.error('quickSave:', err.message) }
    }
    setBulk([]); setBulkWorking(false)
  }

  async function generate(urls) {
    if (!urls.length || generatingRef.current) return
    generatingRef.current = true
    const settings = storage.getSettings()
    const batchDelay = settings.batchDelay ?? 600
    const toGenerate = urls.map(url => ({ url, item: pulled.find(i => i.url === url) })).filter(x => x.item)

    setGenerated(prev => [
      ...toGenerate.map(({ item }) => ({ item: { ...item, link: item.url }, article: null, status: 'generating', error: null, generatedAt: Date.now(), id: 'g' + Date.now() + item.url })),
      ...prev,
    ])
    setSelected([]); setBulk([]); setTab('generated')
    toast(`Generating ${toGenerate.length} article${toGenerate.length > 1 ? 's' : ''}…`)

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

          const authorObj = storage.getAuthors().find(a => a.id === src?.defaultAuthor)
          const article = await generateArticle({
            content, title: item.title, sourceUrl: item.url,
            sourceName: item.sourceName || src?.name,
            primaryCategory: src?.primaryCategory,
            writingPrompt: src?.writingPrompt || settings.globalWritingPrompt,
            authorStyle: authorObj?.style || '',
            postFormat: src?.postFormat || 'standard', mode: 'rewrite',
          })

          const full = { ...article, featuredImageUrl: item.image || '', sourceUrl: item.url, sourceName: item.sourceName || src?.name, videoUrl: src?.postFormat === 'video' ? item.url : '' }
          fullArticles.current[url] = full
          storage.addSeenUrl(url)
          await updatePulledStatusDB([url], 'generated').catch(() => {})

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

  function cancelGenerating(url) {
    setGenerated(prev => prev.map(g =>
      (g.item?.url || g.item?.link) === url && g.status === 'generating'
        ? { ...g, status: 'error', error: 'Cancelled' }
        : g
    ))
  }

  async function retryGeneration(url) {
    const g = generated.find(x => (x.item?.url || x.item?.link) === url)
    if (!g) return
    const item = pulled.find(i => i.url === url) || g.item
    if (!item) return
    // Reset to generating
    setGenerated(prev => prev.map(x =>
      (x.item?.url || x.item?.link) === url ? { ...x, status: 'generating', error: null, generatedAt: Date.now() } : x
    ))
    const settings = storage.getSettings()
    const src = sources.find(s => s.id === item.sourceId)
    try {
      let content = item.content || item.summary || ''
      try {
        const scraped = await scrapeArticle(item.url || url)
        if (scraped.text?.length > content.length) content = scraped.text
        if (!item.image && scraped.image) item.image = scraped.image
      } catch {}
      const authorObj = storage.getAuthors().find(a => a.id === src?.defaultAuthor)
      const article = await generateArticle({
        content, title: item.title, sourceUrl: item.url || url,
        sourceName: item.sourceName || src?.name,
        primaryCategory: src?.primaryCategory,
        writingPrompt: src?.writingPrompt || settings.globalWritingPrompt,
        authorStyle: authorObj?.style || '',
        postFormat: src?.postFormat || 'standard', mode: 'rewrite',
      })
      const full = { ...article, featuredImageUrl: item.image || '', sourceUrl: item.url || url, sourceName: item.sourceName || src?.name }
      fullArticles.current[url] = full
      setGenerated(prev => prev.map(x =>
        (x.item?.url || x.item?.link) === url ? { ...x, article: full, status: 'done' } : x
      ))
    } catch (err) {
      setGenerated(prev => prev.map(x =>
        (x.item?.url || x.item?.link) === url ? { ...x, status: 'error', error: err.message.slice(0, 120) } : x
      ))
    }
  }

  function openEditor(url) {
    const g = generated.find(x => (x.item?.url || x.item?.link) === url)
    if (!g?.article) return
    setEditingArticle(fullArticles.current[url] || g.article)
    setEditingLink(url)
  }

  if (editingArticle) return (
    <Layout>
      <ArticleEditor article={editingArticle}
        source={sources.find(s => s.name === editingArticle.sourceName)}
        onBack={() => { setEditingArticle(null); setEditingLink(null) }}
        onSaved={(post, updated) => {
          if (editingLink && updated) {
            fullArticles.current[editingLink] = updated
            setGenerated(prev => prev.map(g =>
              (g.item?.url || g.item?.link) === editingLink
                ? { ...g, article: { ...g.article, title: updated.title, primaryCategory: updated.primaryCategory, excerpt: updated.excerpt, wordCount: updated.wordCount, wpPostId: post?.id } }
                : g
            ))
          }
          setEditingArticle(null); setEditingLink(null)
        }}
      />
    </Layout>
  )

  const isLoading = Object.values(loadingSource).some(Boolean)
  const generatingCount = generated.filter(g => g.status === 'generating').length

  const pipelineCounts = {
    queued: displayPulled.length,
    generating: generatingCount,
    review: generated.filter(g => g.status === 'done' && !g.article?.wpPostId).length,
    published: generated.filter(g => g.article?.wpStatus === 'publish').length,
  }

  return (
    <Layout counts={pipelineCounts}>
      {/* Confirm delete */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, padding: 28, width: 360, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Delete {confirmDelete.urls.length} article{confirmDelete.urls.length > 1 ? 's' : ''}?</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={doDelete}>Delete</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8, animation: 'slideUp 0.2s ease-out' }}>
          <I name="check" size={14} color="var(--success)" />{toastMsg}
        </div>
      )}

      {/* Topbar */}
      <Topbar
        title="Discover"
        subtitle={`${displayPulled.length} pulled · ${generated.filter(g => g.status === 'done').length} ready`}
        actions={
          <>
            <InlineSelect size="sm" value={dateRange} onChange={setDateRange}
              options={[{value:'today',label:'Today'},{value:'3days',label:'Last 3 days'},{value:'week',label:'This week'},{value:'all',label:'All time'}]} />
            <Btn variant="secondary" size="sm" leftIcon={<I name="refresh" size={13} />} onClick={refreshAll} disabled={isLoading}>
              {isLoading ? <Spinner size={12} /> : null} Refresh
            </Btn>
            {selected.length > 0 && (
              <Btn variant="accent" size="sm" leftIcon={<I name="sparkle" size={13} />} onClick={() => generate(selected)} disabled={generatingRef.current}>
                Generate {selected.length}
              </Btn>
            )}
          </>
        }
      />

      {/* Tab bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', alignItems: 'center', height: 38, flexShrink: 0 }}>
        {[['pulled', 'Pulled', displayPulled.length], ['generated', 'Generated', generated.length]].map(([v, label, count]) => (
          <button key={v} onClick={() => { setTab(v); setBulk([]) }}
            style={{
              height: 38, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === v ? 500 : 400,
              color: tab === v ? 'var(--ink)' : 'var(--muted)',
              borderBottom: `2px solid ${tab === v ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
            }}>
            {label}
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3, minWidth: 18, textAlign: 'center' }}>{count}</span>
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {generatingCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)' }}><Spinner size={11} />{generatingCount} generating…</div>}
          <TextInput size="sm" icon="search" placeholder="Search titles…" value={search} onChange={setSearch} style={{ width: 200 }} />
        </div>
      </div>

      {/* 3-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Source sidebar */}
        {!sidebarCollapsed && (
          <div style={{ width: 200, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '10px 8px', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 8px' }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Sources</span>
              <button onClick={() => setSidebarCollapsed(true)} style={{ background: 'none', border: 'none', color: 'var(--muted-2)', cursor: 'pointer', padding: 2 }} title="Collapse">
                <I name="chevronLeft" size={12} />
              </button>
            </div>
            <SourceItem src={{ id: 'all', name: 'All sources', icon: 'inbox' }} active={activeSource === 'all'} count={displayPulled.length} onClick={() => setActiveSource('all')} />
            <div style={{ height: 6 }} />
            {sources.map(src => {
              const count = pulled.filter(p => p.sourceId === src.id && !generatedUrls.has(p.url)).length
              return <SourceItem key={src.id} src={src} active={activeSource === src.id} count={count} loading={loadingSource[src.id]} onClick={() => setActiveSource(src.id)} />
            })}
            <div style={{ height: 10 }} />
            <button onClick={() => window.location.href = '/settings'} style={{ width: '100%', padding: '6px 10px', fontSize: 12, background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 5, color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <I name="plus" size={12} /> Add source
            </button>
          </div>
        )}

        {/* List column */}
        <div style={{ flex: '0 0 42%', minWidth: 320, maxWidth: 480, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
          {/* List header */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, height: 38, flexShrink: 0, background: bulk.length ? 'var(--accent-soft)' : 'var(--surface)', transition: 'background 0.15s' }}>
            {sidebarCollapsed && (
              <button onClick={() => setSidebarCollapsed(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', marginRight: 2 }}>
                <I name="chevronRight" size={12} />
              </button>
            )}
            <Checkbox checked={bulk.length === items.length && items.length > 0} onChange={v => v ? selectAll() : clearBulk()} size={14} />
            {bulk.length ? (
              <>
                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>{bulk.length} selected</span>
                <div style={{ flex: 1 }} />
                {tab === 'pulled' ? (
                  <>
                    <Btn variant="accent" size="sm" leftIcon={<I name="sparkle" size={12} />} onClick={() => { setSelected(bulk); generate(bulk) }}>Generate</Btn>
                    <Btn variant="secondary" size="sm" leftIcon={<I name="trash" size={12} />} onClick={() => askDelete(bulk, 'pulled')}>Delete</Btn>
                  </>
                ) : (
                  <>
                    <Btn variant="secondary" size="sm" disabled={bulkWorking} onClick={() => quickSave(bulk, 'draft')}>Draft all</Btn>
                    <Btn variant="accent" size="sm" leftIcon={<I name="wordpress" size={12} />} disabled={bulkWorking} onClick={() => quickSave(bulk, 'publish')}>Publish all</Btn>
                    <Btn variant="danger" size="sm" leftIcon={<I name="trash" size={12} />} onClick={() => askDelete(bulk, 'generated')}>Delete</Btn>
                  </>
                )}
                <Btn variant="ghost" size="sm" onClick={clearBulk}><I name="x" size={12} /></Btn>
              </>
            ) : (
              <>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                  {items.length} {tab === 'pulled' ? 'articles' : 'generated'}
                </span>
                <div style={{ flex: 1 }} />
              </>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {tab === 'pulled' && (
              displayPulled.length === 0
                ? <EmptyState icon="◈" title="No articles" description={isLoading ? 'Loading…' : 'Refresh to pull from sources'} />
                : displayPulled.map(item => (
                  <PulledRow key={item.url} item={item}
                    selected={selectedId === item.url || (!selectedId && displayPulled[0]?.url === item.url)}
                    checked={bulk.includes(item.url)}
                    queued={selected.includes(item.url)}
                    onClick={() => setSelectedId(item.url)}
                    onCheck={() => toggleBulk(item.url)}
                    onGenerate={() => generate([item.url])}
                    onDelete={() => askDelete([item.url], 'pulled')}
                  />
                ))
            )}
            {tab === 'generated' && (
              displayGenerated.length === 0
                ? <EmptyState icon="✦" title="No generated articles" description="Select articles in Pulled tab and click Generate" />
                : displayGenerated.map(g => {
                  const url = g.item?.url || g.item?.link
                  return (
                    <GeneratedRow key={g.id || url} g={g}
                      selected={selectedId === url || (!selectedId && displayGenerated[0]?.item?.url === url)}
                      checked={bulk.includes(url)}
                      onClick={() => setSelectedId(url)}
                      onCheck={() => toggleBulk(url)}
                      onEdit={() => openEditor(url)}
                      onQuickSave={status => quickSave([url], status)}
                      onDelete={() => askDelete([url], 'generated')}
                      onCancel={() => cancelGenerating(url)}
                      onRetry={() => retryGeneration(url)}
                    />
                  )
                })
            )}
          </div>
        </div>

        {/* Preview pane */}
        <div style={{ flex: 1, background: 'var(--bg)', overflow: 'auto', minWidth: 0 }}>
          {tab === 'pulled' && selectedItem && (
            <PulledPreview item={selectedItem} sources={sources} onGenerate={() => generate([selectedItem.url])} />
          )}
          {tab === 'generated' && selectedItem && (
            <GeneratedPreview g={selectedItem}
              onEdit={() => openEditor(selectedItem.item?.url || selectedItem.item?.link)}
              onQuickSave={status => quickSave([selectedItem.item?.url || selectedItem.item?.link], status)}
              onCancel={() => cancelGenerating(selectedItem.item?.url || selectedItem.item?.link)}
              onRetry={() => retryGeneration(selectedItem.item?.url || selectedItem.item?.link)}
            />
          )}
          {!selectedItem && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>Select an article to preview</div>}
        </div>
      </div>
    </Layout>
  )
}

// ── Source item ──────────────────────────────────────────
function SourceItem({ src, active, count, loading, onClick }) {
  const iconFor = src.icon || (src.type === 'rss' ? 'rss' : src.type === 'youtube' ? 'youtube' : src.type === 'scrape' ? 'globe' : 'folder')
  return (
    <button onClick={onClick} className="nav-item"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '6px 8px', borderRadius: 5, marginBottom: 1,
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-2)',
        border: 'none', cursor: 'pointer', fontSize: 12.5, textAlign: 'left',
        boxShadow: active ? 'inset 0 0 0 1px var(--border)' : 'none',
      }}>
      <I name={iconFor} size={13} color={active ? 'var(--accent)' : 'var(--muted)'} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.name}</span>
      {loading ? <Spinner size={10} /> : count != null && count > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{count}</span>}
    </button>
  )
}

// ── Pulled row ───────────────────────────────────────────
function PulledRow({ item, selected, checked, queued, onClick, onCheck, onGenerate, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', alignItems: 'flex-start',
        background: selected ? 'var(--accent-soft)' : hover ? 'var(--surface-2)' : 'transparent',
        borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        transition: 'background 0.1s',
      }}>
      <div style={{ paddingTop: 1 }}>
        <Checkbox checked={checked || queued} onChange={onCheck} size={15} />
      </div>
      {item.image && (
        <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{item.sourceName}</span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted-2)' }}>{item.pubDate ? relTime(new Date(item.pubDate).getTime()) : ''}</span>
          {item.status === 'generated' && <Badge tone="green" size="sm">generated</Badge>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, marginBottom: 3, letterSpacing: '-0.005em' }}>{item.title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {item.summary?.replace(/<[^>]+>/g, '').slice(0, 160)}
        </div>
      </div>
      {(hover || selected) && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          <Tip label="Generate"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onGenerate() }}><I name="sparkle" size={12} color="var(--accent)" /></Btn></Tip>
          <Tip label="Open source"><a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', padding: '3px 4px', color: 'var(--muted)', border: '1px solid transparent', borderRadius: 4 }}><I name="external" size={12} /></a></Tip>
          <Tip label="Delete"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onDelete() }}><I name="trash" size={12} color="var(--danger)" /></Btn></Tip>
        </div>
      )}
    </div>
  )
}

// ── Generated row ────────────────────────────────────────
function GeneratedRow({ g, selected, checked, onClick, onCheck, onEdit, onQuickSave, onDelete, onCancel, onRetry }) {
  const [hover, setHover] = useState(false)
  const isDone = g.status === 'done'
  const url = g.item?.url || g.item?.link
  const statusDot = g.status === 'generating' ? <Spinner size={10} />
    : g.status === 'error' ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
    : g.article?.wpStatus === 'publish' ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
    : g.article?.wpPostId ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)' }} />
    : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted-2)' }} />

  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', alignItems: 'flex-start',
        background: selected ? 'var(--accent-soft)' : hover ? 'var(--surface-2)' : 'transparent',
        borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        transition: 'background 0.1s',
      }}>
      <div style={{ paddingTop: 1 }}>
        {isDone ? <Checkbox checked={checked} onChange={onCheck} size={15} /> : <div style={{ width: 15, height: 15 }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 20, flexShrink: 0, marginTop: 2 }}>
        {statusDot}
      </div>
      {g.article?.featuredImageUrl && (
        <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <img src={g.article.featuredImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
          {g.article?.primaryCategory && <Badge tone="blue" size="sm">{g.article.primaryCategory.split('&')[0].trim()}</Badge>}
          {g.article?.wpPostId && <Badge tone="mono" size="sm">#{g.article.wpPostId}</Badge>}
          {g.article?.wordCount > 0 && <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{g.article.wordCount}w</span>}
          {g.status === 'generating' && <Badge tone="blue" size="sm">Generating…</Badge>}
          {g.status === 'error' && <Badge tone="red" size="sm">Error</Badge>}
          {g.article?.wpStatus === 'publish' && <Badge tone="green" size="sm">Published</Badge>}
          {g.article?.wpStatus === 'draft' && <Badge tone="amber" size="sm">Draft</Badge>}
          <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)' }}>{relTime(g.generatedAt)}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: g.status === 'error' ? 'var(--danger)' : 'var(--ink)', lineHeight: 1.35, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {g.article?.title || g.item?.title}
        </div>
        {g.status === 'generating' && (
          <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
            <div style={{ width: '40%', height: '100%', background: 'var(--accent)', animation: 'pulse 1.4s ease-in-out infinite' }} />
          </div>
        )}
        {isDone && g.article?.excerpt && (
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
            {g.article.excerpt}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
        {g.status === 'generating' && (
          <Tip label="Cancel"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onCancel?.() }}><I name="x" size={12} color="var(--danger)" /></Btn></Tip>
        )}
        {g.status === 'error' && (
          <Tip label="Retry"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onRetry?.() }}><I name="refresh" size={12} color="var(--accent)" /></Btn></Tip>
        )}
        {isDone && (hover || selected) && (
          <>
            <Tip label="Edit"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onEdit() }}><I name="edit" size={12} /></Btn></Tip>
            {!g.article?.wpStatus && <Tip label="Save as draft"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onQuickSave('draft') }}><I name="copy" size={12} /></Btn></Tip>}
            <Tip label="Publish"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onQuickSave('publish') }}><I name="wordpress" size={12} color="var(--accent)" /></Btn></Tip>
          </>
        )}
        {(isDone || g.status === 'error') && (hover || selected) && (
          <Tip label="Delete"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onDelete() }}><I name="trash" size={12} color="var(--danger)" /></Btn></Tip>
        )}
      </div>
    </div>
  )
}

// ── Pulled preview pane ──────────────────────────────────
function PulledPreview({ item, sources, onGenerate }) {
  const [category, setCategory] = useState('')
  const [instruction, setInstruction] = useState('')
  const src = sources?.find(s => s.id === item.sourceId)

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Badge tone="mono">{item.sourceName}</Badge>
        {item.pubDate && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{new Date(item.pubDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
        <div style={{ marginLeft: 'auto' }}>
          <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>View source <I name="external" size={11} /></a>
        </div>
      </div>

      {item.image && (
        <div style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '16/9' }}>
          <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.015em', margin: '0 0 12px', color: 'var(--ink)' }}>{item.title}</h1>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 24px' }}>{item.summary?.replace(/<[^>]+>/g, '')}</p>

      {/* Generation setup */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Generation</div>
          <Badge tone="blue" size="sm">Claude Sonnet</Badge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Primary category</div>
            <InlineSelect size="sm" value={category || src?.primaryCategory || ''} onChange={setCategory}
              options={[{value:'',label:'— Auto-detect —'}, ...CATEGORIES.map(c => ({ value: c, label: c }))]} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Source prompt</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', padding: '4px 0' }}>{src?.writingPrompt?.slice(0, 60) || 'Default'}{src?.writingPrompt?.length > 60 ? '…' : ''}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Writing instruction <span style={{ textTransform: 'none', color: 'var(--muted-2)' }}>(optional override)</span></div>
          <TextInput size="sm" placeholder="e.g. Focus on the India angle, keep under 400 words…" value={instruction} onChange={setInstruction} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="accent" size="lg" leftIcon={<I name="sparkle" size={14} />} onClick={onGenerate}>Generate article</Btn>
        <Btn variant="secondary" size="lg" leftIcon={<I name="trash" size={13} />}>Skip</Btn>
      </div>
    </div>
  )
}

// ── Generated preview pane ───────────────────────────────
function GeneratedPreview({ g, onEdit, onQuickSave, onCancel, onRetry }) {
  if (g.status === 'generating') {
    return (
      <div style={{ padding: 40, maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Spinner size={20} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Generating…</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>Claude Sonnet · started {relTime(g.generatedAt)}</div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 16 }}>{g.item?.title}</div>
        <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ width: '40%', height: '100%', background: 'var(--accent)', animation: 'pulse 1.4s ease-in-out infinite' }} />
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
          <div>→ Extracting facts from source…</div>
          <div style={{ opacity: 0.4 }}>  Rewriting in 1cw.org voice</div>
          <div style={{ opacity: 0.4 }}>  Generating SEO meta</div>
        </div>
        <div style={{ marginTop: 20 }}>
          <Btn variant="secondary" size="sm" leftIcon={<I name="x" size={12} />} onClick={onCancel}>Cancel</Btn>
        </div>
      </div>
    )
  }

  if (g.status === 'error') {
    return (
      <div style={{ padding: 40, maxWidth: 500 }}>
        <Badge tone="red">Generation failed</Badge>
        <div style={{ fontSize: 15, fontWeight: 500, margin: '12px 0 6px', color: 'var(--ink)' }}>{g.item?.title}</div>
        <div style={{ fontSize: 13, color: 'var(--danger)', fontFamily: 'var(--mono)', marginBottom: 20 }}>{g.error}</div>
        <Btn variant="secondary" leftIcon={<I name="refresh" size={13} />} onClick={onRetry}>Retry</Btn>
      </div>
    )
  }

  const a = g.article
  if (!a) return null

  return (
    <div style={{ padding: 28, maxWidth: 760 }}>
      {/* Meta header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {a.primaryCategory && <Badge tone="blue">{a.primaryCategory}</Badge>}
        {a.wordCount && <Badge tone="mono">{a.wordCount} words</Badge>}
        {g.article?.wpStatus === 'publish' && <Badge tone="green">Published · #{g.article.wpPostId}</Badge>}
        {g.article?.wpStatus === 'draft' && <Badge tone="amber">Draft · #{g.article.wpPostId}</Badge>}
        {!g.article?.wpStatus && !g.article?.wpPostId && <Badge tone="mono">Not saved</Badge>}
        {g.article?.wpPostId && !g.article?.wpStatus && <Badge tone="amber">Saved · #{g.article.wpPostId}</Badge>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>from {g.item?.sourceName} · {relTime(g.generatedAt)}</span>
      </div>

      {/* Featured image */}
      {a.featuredImageUrl && (
        <div style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '16/9' }}>
          <img src={a.featuredImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <h1 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 10px', color: 'var(--ink)' }}>{a.title}</h1>
      {a.tagline && <div style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 20, fontStyle: 'italic', letterSpacing: '-0.005em' }}>{a.tagline}</div>}
      {a.excerpt && <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px' }}>{a.excerpt}</p>}

      {a.body && (
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: a.body }} />
      )}

      {/* SEO meta strip */}
      <div style={{ marginTop: 28, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>SEO & Taxonomy</div>
        {[
          ['Slug', a.slug && <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>1cw.org/{a.slug}</code>],
          ['Focus keyword', a.focusKeyword],
          ['SEO title', a.seoTitle],
          ['Meta desc', a.metaDescription],
          ['Regions', a.regionTags?.length ? a.regionTags.map(t => <Badge key={t} tone="neutral" size="sm">{t}</Badge>) : null],
          ['Tags', a.keywordTags?.length ? a.keywordTags.map(t => <Badge key={t} tone="neutral" size="sm">{t}</Badge>) : null],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 12, borderBottom: '1px dashed var(--border)' }}>
            <div style={{ width: 100, color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{k}</div>
            <div style={{ flex: 1, color: 'var(--ink-2)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20, position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 12, paddingBottom: 4 }}>
        <Btn variant="primary" size="lg" leftIcon={<I name="edit" size={14} />} onClick={onEdit}>Open editor</Btn>
        {!g.article?.wpPostId && <Btn variant="secondary" size="lg" onClick={() => onQuickSave('draft')}>Save as draft</Btn>}
        <Btn variant="accent" size="lg" leftIcon={<I name="wordpress" size={14} />} onClick={() => onQuickSave('publish')}>
          {g.article?.wpStatus === 'publish' ? 'Update' : 'Publish to 1cw.org'}
        </Btn>
      </div>
    </div>
  )
}
