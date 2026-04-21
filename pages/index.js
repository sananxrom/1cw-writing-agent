// pages/index.js — Discover hub
// Tabs: Pulled | Generated | Saved | Drafted | Published + Create mode
import { useState, useEffect, useRef, useMemo } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Btn, Badge, Spinner, EmptyState, Topbar, I, Tip, Checkbox, InlineSelect, TextInput, Segmented, Textarea, FieldLabel, relTime } from '../components/UI'
import { pullSource, deletePulledFromDB, updatePulledStatusDB, scrapeArticle, generateArticle, saveToWordPress, resolveCategoryIds, resolveTagIds, fetchDbHistory } from '../lib/api'
import { storage } from '../lib/storage'

const GEN_KEY = '1cw_discover_generated'
const CATEGORIES = [
  'Artificial Intelligence','XR, VR, AR – XROM','Blockchain','Quantum & Nanotechnology',
  'Robotics & Automation','Automotive','Life Sciences & Biotechnology','Earth & Environment',
  'Health & Medicine','Space & Astronomy','Startups & Entrepreneurship','Policy & Economy',
  'Corporate Tech & Semiconductors','Telecom & Energy Tech',
]

function loadGenerated() {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(GEN_KEY) || '[]') } catch { return [] }
}
function saveGeneratedLocal(items) {
  try {
    const slim = items.map(g => ({ ...g, article: g.article ? { ...g.article, body: (g.article.body || '').slice(0, 300) } : null }))
    localStorage.setItem(GEN_KEY, JSON.stringify(slim.slice(0, 100)))
  } catch {}
}

export default function Discover() {
  const [sources, setSources] = useState([])
  const [pulled, setPulled] = useState([])
  const [loadingSource, setLoadingSource] = useState({})
  const [selected, setSelected] = useState([])
  const [bulk, setBulk] = useState([])
  const [generated, setGenerated] = useState([])
  const [wpHistory, setWpHistory] = useState([])    // drafted + published from DB
  const [historyLoading, setHistoryLoading] = useState(false)
  const [tab, setTab] = useState('pulled')
  const [activeSource, setActiveSource] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState('all')  // default all — don't hide yesterday
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [editingLink, setEditingLink] = useState(null)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  // Create mode state
  const [createMode, setCreateMode] = useState('url')
  const [createUrl, setCreateUrl] = useState('')
  const [createTopic, setCreateTopic] = useState('')
  const [createPaste, setCreatePaste] = useState('')
  const [createInstruction, setCreateInstruction] = useState('')
  const [createCategory, setCreateCategory] = useState('Artificial Intelligence')
  const [createLength, setCreateLength] = useState('medium')
  const [createGenerating, setCreateGenerating] = useState(false)

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

  useEffect(() => { saveGeneratedLocal(generated) }, [generated])

  // Load WP history when switching to drafted/published tabs
  useEffect(() => {
    if (tab === 'drafted' || tab === 'published') loadWpHistory()
  }, [tab])

  function loadSources() {
    const s = storage.getSources().filter(s => ['rss','scrape','youtube'].includes(s.type) && s.active)
    setSources(s)
  }

  async function loadWpHistory() {
    setHistoryLoading(true)
    try {
      const data = await fetchDbHistory({ limit: 200 })
      setWpHistory(data.articles || [])
    } catch {}
    setHistoryLoading(false)
  }

  async function fetchSource(src, refresh = true) {
    setLoadingSource(prev => ({ ...prev, [src.id]: true }))
    try {
      const data = await pullSource({ source: src, dateRange, refresh })
      setPulled(prev => {
        const others = prev.filter(p => p.sourceId !== src.id)
        return [...data.articles, ...others]
      })
    } catch (err) { console.error('[discover] fetch:', err.message) }
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
    let items = generated.filter(g => g.status === 'done' && !g.article?.wpPostId)
    if (search) items = items.filter(g => (g.article?.title || g.item?.title)?.toLowerCase().includes(search.toLowerCase()))
    return items
  }, [generated, search])

  const savedArticles = useMemo(() => {
    if (typeof window === 'undefined') return []
    const keys = Object.keys(localStorage).filter(k => k.startsWith('1cw_local_'))
    return keys.map(k => {
      try { return JSON.parse(localStorage.getItem(k)) } catch { return null }
    }).filter(Boolean)
  }, [tab])

  const draftedArticles = useMemo(() =>
    wpHistory.filter(a => a.status === 'draft'), [wpHistory])

  const publishedArticles = useMemo(() =>
    wpHistory.filter(a => a.status === 'publish'), [wpHistory])

  function toggleBulk(id) { setBulk(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]) }
  function toggleSelect(url) { setSelected(s => s.includes(url) ? s.filter(x => x !== url) : [...s, url]) }
  const selectAll = () => {
    const items = tab === 'pulled' ? displayPulled : displayGenerated
    setBulk(items.map(i => i.url || i.item?.url).filter(Boolean))
  }

  function askDelete(urls, fromTab) { setConfirmDelete({ urls, fromTab }) }
  async function doDelete() {
    if (!confirmDelete) return
    const { urls, fromTab } = confirmDelete
    if (fromTab === 'pulled') {
      await deletePulledFromDB(urls).catch(() => {})
      setPulled(prev => prev.filter(p => !urls.includes(p.url)))
    } else if (fromTab === 'generated') {
      setGenerated(prev => prev.filter(g => !urls.includes(g.item?.url || g.item?.link)))
    } else if (fromTab === 'saved') {
      urls.forEach(k => localStorage.removeItem(k))
    }
    setBulk([]); setConfirmDelete(null)
    toast(`Deleted ${urls.length} article${urls.length > 1 ? 's' : ''}`)
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
        toast(`${status === 'draft' ? 'Drafted' : 'Published'} to 1cw.org`)
      } catch (err) { toast('Error: ' + err.message) }
    }
    setBulk([]); setBulkWorking(false)
    if (status === 'draft') setTab('drafted')
    else if (status === 'publish') setTab('published')
  }

  async function generate(urls) {
    if (!urls.length || generatingRef.current) return
    generatingRef.current = true
    const settings = storage.getSettings()
    const toGenerate = urls.map(url => ({ url, item: pulled.find(i => i.url === url) })).filter(x => x.item)

    setGenerated(prev => [
      ...toGenerate.map(({ item }) => ({
        item: { ...item, link: item.url }, article: null,
        status: 'generating', error: null, generatedAt: Date.now(),
        id: 'g' + Date.now() + item.url,
      })),
      ...prev,
    ])
    setSelected([]); setBulk([]); setTab('generated')
    toast(`Generating ${toGenerate.length} article${toGenerate.length > 1 ? 's' : ''}…`)

    try {
      for (const [idx, { url, item }] of toGenerate.entries()) {
        const src = sources.find(s => s.id === item.sourceId)
        try {
          if (idx > 0) await new Promise(r => setTimeout(r, settings.batchDelay ?? 600))
          let content = item.content || item.summary || ''
          try {
            const scraped = await scrapeArticle(item.url)
            if (scraped.text?.length > content.length) content = scraped.text
            if (!item.image && scraped.image) item.image = scraped.image
          } catch {}

          const authorObj = storage.getAuthors().find(a => a.id === src?.defaultAuthor)
          const isYT = item.sourceType === 'youtube'
          const article = await generateArticle({
            content, title: item.title, sourceUrl: item.url,
            sourceName: item.sourceName || src?.name,
            primaryCategory: src?.primaryCategory,
            writingPrompt: src?.writingPrompt || settings.globalWritingPrompt,
            authorStyle: authorObj?.style || '',
            postFormat: isYT ? 'video' : (src?.postFormat || 'standard'),
            mode: isYT ? 'youtube' : 'rewrite',
          })
          const full = { ...article, featuredImageUrl: item.image || '', sourceUrl: item.url, sourceName: item.sourceName || src?.name, videoUrl: isYT ? item.url : (src?.postFormat === 'video' ? item.url : ''), postFormat: isYT ? 'video' : (src?.postFormat || 'standard') }
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
        ? { ...g, status: 'error', error: 'Cancelled' } : g
    ))
  }

  async function retryGeneration(url) {
    const g = generated.find(x => (x.item?.url || x.item?.link) === url)
    if (!g) return
    setGenerated(prev => prev.map(x =>
      (x.item?.url || x.item?.link) === url ? { ...x, status: 'generating', error: null, generatedAt: Date.now() } : x
    ))
    const settings = storage.getSettings()
    const item = g.item
    const src = sources.find(s => s.id === item.sourceId)
    try {
      let content = item.content || item.summary || ''
      try { const s = await scrapeArticle(url); if (s.text?.length > content.length) content = s.text } catch {}
      const article = await generateArticle({
        content, title: item.title, sourceUrl: url,
        sourceName: item.sourceName || src?.name,
        primaryCategory: src?.primaryCategory,
        writingPrompt: src?.writingPrompt || settings.globalWritingPrompt,
        postFormat: src?.postFormat || 'standard',
        mode: item.sourceType === 'youtube' ? 'youtube' : 'rewrite',
      })
      const isYT2 = item.sourceType === 'youtube'
      const full = { ...article, featuredImageUrl: item.image || '', sourceUrl: url, sourceName: item.sourceName, videoUrl: isYT2 ? url : '', postFormat: isYT2 ? 'video' : (article.postFormat || 'standard') }
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

  async function handleCreate() {
    setCreateGenerating(true)
    try {
      const settings = storage.getSettings()
      let content = createPaste
      let title = createTopic
      if (createMode === 'url' && createUrl) {
        try {
          const scraped = await scrapeArticle(createUrl)
          content = scraped.text || ''
          title = scraped.title || createUrl
        } catch {}
      }
      const lengthPrompt = { short: 'Keep under 400 words.', medium: '500-700 words.', long: '900-1200 words.' }[createLength]
      const article = await generateArticle({
        content: content || title,
        title: title || createTopic,
        sourceUrl: createMode === 'url' ? createUrl : '',
        primaryCategory: createCategory,
        writingPrompt: (createInstruction ? createInstruction + ' ' : '') + lengthPrompt,
        mode: createMode === 'url' ? 'rewrite' : 'create',
      })
      // Add to generated queue
      const fakeItem = { url: createUrl || 'create-' + Date.now(), title: title || createTopic, sourceName: 'Created', sourceType: 'create', image: '' }
      const full = { ...article, featuredImageUrl: '', sourceUrl: fakeItem.url, sourceName: 'Created' }
      fullArticles.current[fakeItem.url] = full
      setGenerated(prev => [{ item: fakeItem, article: full, status: 'done', generatedAt: Date.now(), id: 'c' + Date.now() }, ...prev])
      setTab('generated')
      setCreateUrl(''); setCreateTopic(''); setCreatePaste(''); setCreateInstruction('')
      toast('Article created — see Generated tab')
    } catch (err) { toast('Failed: ' + err.message) }
    setCreateGenerating(false)
  }

  function openEditor(url) {
    const g = generated.find(x => (x.item?.url || x.item?.link) === url)
    if (!g?.article) return
    setEditingArticle(fullArticles.current[url] || g.article)
    setEditingLink(url)
  }

  async function openWpArticle(dbId) {
    try {
      const r = await fetch(`/api/get-article?id=${dbId}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setEditingArticle(data)
      setEditingLink('wp-' + dbId)
    } catch (err) { toast('Load failed: ' + err.message) }
  }

  if (editingArticle) return (
    <Layout>
      <ArticleEditor article={editingArticle}
        source={sources.find(s => s.name === editingArticle.sourceName)}
        onBack={() => { setEditingArticle(null); setEditingLink(null) }}
        onSaved={(post, updated) => {
          if (editingLink && !editingLink.startsWith('wp-') && updated) {
            fullArticles.current[editingLink] = updated
            setGenerated(prev => prev.map(g =>
              (g.item?.url || g.item?.link) === editingLink
                ? { ...g, article: { ...g.article, title: updated.title, primaryCategory: updated.primaryCategory, excerpt: updated.excerpt, wordCount: updated.wordCount, wpPostId: post?.id } }
                : g
            ))
          }
          setEditingArticle(null); setEditingLink(null)
          if (post) { loadWpHistory(); setTab(post.status === 'publish' ? 'published' : 'drafted') }
        }}
      />
    </Layout>
  )

  const isLoading = Object.values(loadingSource).some(Boolean)
  const generatingCount = generated.filter(g => g.status === 'generating').length

  const TABS = [
    { id: 'pulled',    label: 'Pulled',     count: displayPulled.length },
    { id: 'generated', label: 'Generated',  count: displayGenerated.length },
    { id: 'saved',     label: 'Saved',      count: savedArticles.length },
    { id: 'drafted',   label: 'Drafted',    count: draftedArticles.length },
    { id: 'published', label: 'Published',  count: publishedArticles.length },
    { id: 'create',    label: '+ Create',   count: null },
  ]

  // Determine what to show in preview pane
  const allItems = tab === 'pulled' ? displayPulled
    : tab === 'generated' ? displayGenerated
    : tab === 'saved' ? savedArticles
    : tab === 'drafted' ? draftedArticles
    : tab === 'published' ? publishedArticles
    : []

  const selectedItem = allItems.find(i => (i.url || i.item?.url || i.id) === selectedId) || allItems[0]

  const pipelineCounts = {
    queued: displayPulled.length,
    generating: generatingCount,
    review: displayGenerated.length,
    published: publishedArticles.length,
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
      <Topbar title="Discover"
        subtitle={`${displayPulled.length} pulled · ${displayGenerated.length} ready · ${draftedArticles.length + publishedArticles.length} on WP`}
        actions={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {tab === 'pulled' && <>
              <InlineSelect size="sm" value={dateRange} onChange={setDateRange}
                options={[{value:'all',label:'All time'},{value:'today',label:'Today'},{value:'3days',label:'Last 3 days'},{value:'week',label:'This week'}]} />
              <Btn variant="secondary" size="sm" leftIcon={<I name="refresh" size={13} />} onClick={refreshAll} disabled={isLoading}>
                {isLoading ? <Spinner size={12} /> : null} Refresh
              </Btn>
            </>}
            {selected.length > 0 && tab === 'pulled' && (
              <Btn variant="accent" size="sm" leftIcon={<I name="sparkle" size={13} />} onClick={() => generate(selected)}>
                Generate {selected.length}
              </Btn>
            )}
            {bulk.length > 0 && tab === 'generated' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn variant="secondary" size="sm" disabled={bulkWorking} onClick={() => quickSave(bulk, 'draft')}>Draft {bulk.length}</Btn>
                <Btn variant="accent" size="sm" disabled={bulkWorking} onClick={() => quickSave(bulk, 'publish')}>Publish {bulk.length}</Btn>
                <Btn variant="danger" size="sm" onClick={() => askDelete(bulk, 'generated')}>Delete</Btn>
                <button onClick={() => setBulk([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>✕</button>
              </div>
            )}
            {generatingCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)' }}><Spinner size={11} />{generatingCount}…</div>}
          </div>
        }
      />

      {/* Tab bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', alignItems: 'center', height: 38, flexShrink: 0 }}>
        {TABS.map(({ id, label, count }) => (
          <button key={id} onClick={() => { setTab(id); setBulk([]) }}
            style={{
              height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === id ? 500 : 400,
              color: id === 'create' ? 'var(--accent)' : tab === id ? 'var(--ink)' : 'var(--muted)',
              borderBottom: `2px solid ${tab === id ? (id === 'create' ? 'var(--accent)' : 'var(--accent)') : 'transparent'}`,
              marginBottom: -1,
            }}>
            {label}
            {count != null && count > 0 && (
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 }}>{count}</span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TextInput size="sm" icon="search" placeholder="Search…" value={search} onChange={setSearch} style={{ width: 180 }} />
        </div>
      </div>

      {/* CREATE TAB — full width, no 3-column */}
      {tab === 'create' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
          <div style={{ maxWidth: 720 }}>
            <Segmented value={createMode} onChange={setCreateMode} options={[
              { value: 'url',   label: 'From URL',    icon: <I name="link" size={13} /> },
              { value: 'topic', label: 'From topic',  icon: <I name="sparkle" size={13} /> },
              { value: 'paste', label: 'Paste text',  icon: <I name="copy" size={13} /> },
            ]} />
            <div style={{ marginTop: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
              {createMode === 'url' && (
                <>
                  <FieldLabel label="Source URL" hint="Any news article, blog post, or press release" />
                  <TextInput size="lg" value={createUrl} onChange={setCreateUrl} placeholder="https://example.com/article" icon="link" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>Agent will scrape → detect category → rewrite in the 1cw.org voice.</div>
                </>
              )}
              {createMode === 'topic' && (
                <>
                  <FieldLabel label="Topic or headline" />
                  <TextInput size="lg" value={createTopic} onChange={setCreateTopic} placeholder="e.g. India's AI compute buildout in 2026" style={{ marginBottom: 14 }} />
                  <FieldLabel label="Angle / thesis" hint="(optional)" />
                  <Textarea value={createInstruction} onChange={setCreateInstruction} rows={3} placeholder="Your angle on the topic…" />
                </>
              )}
              {createMode === 'paste' && (
                <>
                  <FieldLabel label="Source text" hint="Paste the article you want rewritten" />
                  <Textarea value={createPaste} onChange={setCreatePaste} rows={8} placeholder="Paste source content here…" />
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                <div>
                  <FieldLabel label="Category" />
                  <InlineSelect value={createCategory} onChange={setCreateCategory} options={CATEGORIES.map(c => ({ value: c, label: c }))} style={{ width: '100%' }} />
                </div>
                <div>
                  <FieldLabel label="Length" />
                  <Segmented value={createLength} onChange={setCreateLength} options={['short','medium','long'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
                </div>
              </div>
              {createMode !== 'topic' && (
                <div style={{ marginTop: 14 }}>
                  <FieldLabel label="Writing instruction" hint="(optional override)" />
                  <TextInput size="md" value={createInstruction} onChange={setCreateInstruction} placeholder="e.g. Focus on the India angle, keep under 400 words…" />
                </div>
              )}
              <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
                <Btn variant="accent" size="lg" leftIcon={createGenerating ? null : <I name="sparkle" size={14} />} onClick={handleCreate} disabled={createGenerating}>
                  {createGenerating ? <><Spinner size={13} /> Generating…</> : 'Generate article'}
                </Btn>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>Article appears in Generated tab</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3-COLUMN for Pulled/Generated/Saved/Drafted/Published */}
      {tab !== 'create' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Source sidebar — only for pulled */}
          {tab === 'pulled' && !sidebarCollapsed && (
            <div style={{ width: 190, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '10px 8px', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 8px' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Sources</span>
                <button onClick={() => setSidebarCollapsed(true)} style={{ background: 'none', border: 'none', color: 'var(--muted-2)', cursor: 'pointer', padding: 2 }}>
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
          <div style={{ flex: '0 0 42%', minWidth: 300, maxWidth: 480, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
            {/* List header */}
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, height: 38, flexShrink: 0 }}>
              {tab === 'pulled' && sidebarCollapsed && (
                <button onClick={() => setSidebarCollapsed(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                  <I name="chevronRight" size={12} />
                </button>
              )}
              {(tab === 'pulled' || tab === 'generated') && (
                <Checkbox checked={bulk.length === allItems.length && allItems.length > 0} onChange={v => v ? selectAll() : setBulk([])} size={14} />
              )}
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                {allItems.length} article{allItems.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* List body */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {tab === 'pulled' && (
                displayPulled.length === 0 && !isLoading
                  ? <EmptyState icon="◈" title="No articles" description={isLoading ? 'Loading…' : 'Refresh to pull from sources'} />
                  : displayPulled.map(item => (
                    <PulledRow key={item.url} item={item}
                      selected={(selectedId || displayPulled[0]?.url) === item.url}
                      checked={bulk.includes(item.url) || selected.includes(item.url)}
                      onClick={() => setSelectedId(item.url)}
                      onCheck={() => { toggleBulk(item.url); toggleSelect(item.url) }}
                      onGenerate={() => generate([item.url])}
                      onDelete={() => askDelete([item.url], 'pulled')}
                    />
                  ))
              )}
              {tab === 'generated' && (
                displayGenerated.length === 0
                  ? <EmptyState icon="✦" title="No articles ready" description="Generate from Pulled or Create tab" />
                  : displayGenerated.map(g => {
                    const url = g.item?.url || g.item?.link
                    return (
                      <GeneratedRow key={g.id || url} g={g}
                        selected={(selectedId || (displayGenerated[0]?.item?.url)) === url}
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
              {tab === 'saved' && (
                savedArticles.length === 0
                  ? <EmptyState icon="💾" title="No locally saved articles" description="Use 'Save Here' in the editor to save without sending to WordPress" />
                  : savedArticles.map((a, i) => (
                    <HistoryRow key={a.slug || i} item={{ title: a.title, primaryCategory: a.primaryCategory, timestamp: a.savedAt, status: 'local' }}
                      selected={(selectedId || savedArticles[0]?.slug) === a.slug}
                      onClick={() => setSelectedId(a.slug)}
                      onEdit={() => setEditingArticle(a)}
                      onDelete={() => askDelete([`1cw_local_${a.slug || ''}`], 'saved')}
                    />
                  ))
              )}
              {(tab === 'drafted' || tab === 'published') && (
                historyLoading
                  ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={20} /></div>
                  : (tab === 'drafted' ? draftedArticles : publishedArticles).length === 0
                    ? <EmptyState icon="⊘" title={`No ${tab} articles`} description={`Articles ${tab === 'drafted' ? 'saved as draft' : 'published'} to WordPress appear here`} />
                    : (tab === 'drafted' ? draftedArticles : publishedArticles).map((a, i) => (
                      <HistoryRow key={a.id || i}
                        item={{ title: a.title, primaryCategory: a.primary_category, timestamp: new Date(a.generated_at).getTime(), status: a.status, wpPostId: a.wp_post_id, wordCount: a.word_count, sourceName: a.source_name }}
                        selected={(selectedId || (tab === 'drafted' ? draftedArticles[0]?.id : publishedArticles[0]?.id)) === a.id}
                        onClick={() => setSelectedId(a.id)}
                        onEdit={() => openWpArticle(a.id)}
                        onDelete={null}
                      />
                    ))
              )}
              {/* generating articles that haven't completed yet — show in generated tab */}
              {tab === 'generated' && generated.filter(g => g.status === 'generating' || g.status === 'error').map(g => {
                const url = g.item?.url || g.item?.link
                return (
                  <GeneratedRow key={g.id || url} g={g}
                    selected={false} checked={false}
                    onClick={() => setSelectedId(url)}
                    onCheck={() => {}}
                    onEdit={() => {}}
                    onQuickSave={() => {}}
                    onDelete={() => askDelete([url], 'generated')}
                    onCancel={() => cancelGenerating(url)}
                    onRetry={() => retryGeneration(url)}
                  />
                )
              })}
            </div>
          </div>

          {/* Preview pane */}
          <div style={{ flex: 1, background: 'var(--bg)', overflow: 'auto', minWidth: 0 }}>
            {tab === 'pulled' && selectedItem && (
              <PulledPreview item={selectedItem} sources={sources} onGenerate={() => generate([selectedItem.url])} />
            )}
            {tab === 'generated' && selectedItem && (() => {
              const url = selectedItem.item?.url || selectedItem.item?.link
              return (
                <GeneratedPreview g={selectedItem}
                  onEdit={() => openEditor(url)}
                  onQuickSave={status => quickSave([url], status)}
                  onCancel={() => cancelGenerating(url)}
                  onRetry={() => retryGeneration(url)}
                />
              )
            })()}
            {(tab === 'saved' || tab === 'drafted' || tab === 'published') && selectedItem && (
              <WpArticlePreview item={selectedItem} tab={tab}
                onEdit={() => tab === 'saved' ? setEditingArticle(selectedItem) : openWpArticle(selectedItem.id)}
              />
            )}
            {!selectedItem && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Select an article to preview
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}

// ── Source item ──────────────────────────────────────────
function SourceItem({ src, active, count, loading, onClick }) {
  const iconFor = src.icon || (src.type === 'rss' ? 'rss' : src.type === 'youtube' ? 'youtube' : src.type === 'scrape' ? 'globe' : 'folder')
  return (
    <button onClick={onClick} className="nav-item"
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 5, marginBottom: 1, background: active ? 'var(--surface-2)' : 'transparent', color: active ? 'var(--ink)' : 'var(--ink-2)', border: 'none', cursor: 'pointer', fontSize: 12.5, textAlign: 'left', boxShadow: active ? 'inset 0 0 0 1px var(--border)' : 'none' }}>
      <I name={iconFor} size={13} color={active ? 'var(--accent)' : 'var(--muted)'} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.name}</span>
      {loading ? <Spinner size={10} /> : count != null && count > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{count}</span>}
    </button>
  )
}

// ── Pulled row ───────────────────────────────────────────
function PulledRow({ item, selected, checked, onClick, onCheck, onGenerate, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'flex-start', background: selected ? 'var(--accent-soft)' : hover ? 'var(--surface-2)' : 'transparent', borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`, transition: 'background 0.1s' }}>
      <div style={{ paddingTop: 1 }}><Checkbox checked={checked} onChange={onCheck} size={15} /></div>
      {item.image && (
        <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase' }}>{item.sourceName}</span>
          {item.sourceType === 'youtube' && <Badge tone="red" size="sm">YT</Badge>}
          {item.pubDate && <span style={{ fontSize: 10, color: 'var(--muted-2)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>{relTime(new Date(item.pubDate).getTime())}</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, marginBottom: 3, letterSpacing: '-0.005em' }}>{item.title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{item.summary?.replace(/<[^>]+>/g, '')}</div>
      </div>
      {(hover || selected) && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          <Tip label="Generate"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onGenerate() }}><I name="sparkle" size={12} color="var(--accent)" /></Btn></Tip>
          <Tip label="Open"><a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', padding: '3px 4px', color: 'var(--muted)', border: '1px solid transparent', borderRadius: 4 }}><I name="external" size={12} /></a></Tip>
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
      style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'flex-start', background: selected ? 'var(--accent-soft)' : hover ? 'var(--surface-2)' : 'transparent', borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`, transition: 'background 0.1s' }}>
      <div style={{ paddingTop: 1 }}>{isDone ? <Checkbox checked={checked} onChange={onCheck} size={15} /> : <div style={{ width: 15 }} />}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 20, flexShrink: 0, marginTop: 2 }}>{statusDot}</div>
      {g.article?.featuredImageUrl && (
        <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <img src={g.article.featuredImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
          {g.article?.primaryCategory && <Badge tone="blue" size="sm">{g.article.primaryCategory.split('&')[0].trim()}</Badge>}
          {g.article?.wordCount > 0 && <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{g.article.wordCount}w</span>}
          {g.status === 'generating' && <Badge tone="blue" size="sm">Generating…</Badge>}
          {g.status === 'error' && <Badge tone="red" size="sm">Error</Badge>}
          <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)' }}>{relTime(g.generatedAt)}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: g.status === 'error' ? 'var(--danger)' : 'var(--ink)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {g.article?.title || g.item?.title}
        </div>
        {g.status === 'generating' && <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}><div style={{ width: '40%', height: '100%', background: 'var(--accent)', animation: 'pulse 1.4s ease-in-out infinite' }} /></div>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
        {g.status === 'generating' && <Tip label="Cancel"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onCancel?.() }}><I name="x" size={12} color="var(--danger)" /></Btn></Tip>}
        {g.status === 'error' && <Tip label="Retry"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onRetry?.() }}><I name="refresh" size={12} color="var(--accent)" /></Btn></Tip>}
        {isDone && (hover || selected) && <>
          <Tip label="Edit"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onEdit() }}><I name="edit" size={12} /></Btn></Tip>
          <Tip label="Draft"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onQuickSave('draft') }}><I name="copy" size={12} /></Btn></Tip>
          <Tip label="Publish"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onQuickSave('publish') }}><I name="wordpress" size={12} color="var(--accent)" /></Btn></Tip>
        </>}
        {(isDone || g.status === 'error') && (hover || selected) && (
          <Tip label="Delete"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onDelete() }}><I name="trash" size={12} color="var(--danger)" /></Btn></Tip>
        )}
      </div>
    </div>
  )
}

// ── History/WP row ────────────────────────────────────────
function HistoryRow({ item, selected, onClick, onEdit, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'flex-start', background: selected ? 'var(--accent-soft)' : hover ? 'var(--surface-2)' : 'transparent', borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`, transition: 'background 0.1s' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
          {item.primaryCategory && <Badge tone="blue" size="sm">{(item.primaryCategory || '').split('&')[0].trim()}</Badge>}
          {item.status === 'publish' && <Badge tone="green" size="sm">Live</Badge>}
          {item.status === 'draft' && <Badge tone="amber" size="sm">Draft</Badge>}
          {item.status === 'local' && <Badge tone="neutral" size="sm">Local</Badge>}
          {item.wpPostId && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)' }}>#{item.wpPostId}</span>}
          <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)' }}>{item.timestamp ? relTime(item.timestamp) : ''}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35 }}>{item.title}</div>
        {item.sourceName && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.sourceName}{item.wordCount ? ` · ${item.wordCount}w` : ''}</div>}
      </div>
      {(hover || selected) && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          <Tip label="Edit"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onEdit() }}><I name="edit" size={12} /></Btn></Tip>
          {onDelete && <Tip label="Delete"><Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); onDelete() }}><I name="trash" size={12} color="var(--danger)" /></Btn></Tip>}
        </div>
      )}
    </div>
  )
}

// ── Pulled preview pane ──────────────────────────────────
function PulledPreview({ item, sources, onGenerate }) {
  const [category, setCategory] = useState('')
  const src = sources?.find(s => s.id === item.sourceId)
  return (
    <div style={{ padding: 28, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Badge tone="mono">{item.sourceName}</Badge>
        {item.sourceType === 'youtube' && <Badge tone="red">YouTube</Badge>}
        {item.pubDate && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{new Date(item.pubDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
        <div style={{ marginLeft: 'auto' }}>
          <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {item.sourceType === 'youtube' ? 'Watch' : 'View source'} <I name="external" size={11} />
          </a>
        </div>
      </div>
      {item.image && (
        <div style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '16/9' }}>
          <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <h1 style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.015em', margin: '0 0 12px', color: 'var(--ink)' }}>{item.title}</h1>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 24px' }}>{item.summary?.replace(/<[^>]+>/g, '')}</p>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Generation setup</div>
          <Badge tone="blue" size="sm">Claude Sonnet</Badge>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Primary category</div>
          <InlineSelect size="sm" value={category || src?.primaryCategory || ''} onChange={setCategory}
            options={[{value:'',label:'— Auto-detect —'}, ...CATEGORIES.map(c => ({ value: c, label: c }))]} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="accent" size="lg" leftIcon={<I name="sparkle" size={14} />} onClick={onGenerate}>Generate article</Btn>
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
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>Claude Sonnet · {relTime(g.generatedAt)}</div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 16 }}>{g.item?.title}</div>
        <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ width: '40%', height: '100%', background: 'var(--accent)', animation: 'pulse 1.4s ease-in-out infinite' }} />
        </div>
        <Btn variant="secondary" size="sm" leftIcon={<I name="x" size={12} />} onClick={onCancel}>Cancel</Btn>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {a.primaryCategory && <Badge tone="blue">{a.primaryCategory}</Badge>}
        {a.wordCount && <Badge tone="mono">{a.wordCount} words</Badge>}
        {!g.article?.wpPostId && <Badge tone="mono">Not saved</Badge>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>from {g.item?.sourceName} · {relTime(g.generatedAt)}</span>
      </div>
      {a.featuredImageUrl && (
        <div style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '16/9' }}>
          <img src={a.featuredImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 10px', color: 'var(--ink)' }}>{a.title}</h1>
      {a.tagline && <div style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 16, fontStyle: 'italic' }}>{a.tagline}</div>}
      {a.excerpt && <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px' }}>{a.excerpt}</p>}
      {a.body && <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: a.body }} />}
      <div style={{ marginTop: 20, padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>SEO</div>
        {[['Slug', a.slug && `/${a.slug}`], ['Focus keyword', a.focusKeyword], ['SEO title', a.seoTitle]].filter(([,v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 10, padding: '4px 0', fontSize: 12, borderBottom: '1px dashed var(--border)' }}>
            <div style={{ width: 90, color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', flexShrink: 0 }}>{k}</div>
            <div style={{ color: 'var(--ink-2)' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 10 }}>
        <Btn variant="primary" size="lg" leftIcon={<I name="edit" size={14} />} onClick={onEdit}>Open editor</Btn>
        <Btn variant="secondary" size="lg" onClick={() => onQuickSave('draft')}>Save as draft</Btn>
        <Btn variant="accent" size="lg" leftIcon={<I name="wordpress" size={14} />} onClick={() => onQuickSave('publish')}>Publish</Btn>
      </div>
    </div>
  )
}

// ── WP article preview ────────────────────────────────────
function WpArticlePreview({ item, tab, onEdit }) {
  const a = item
  const title = a.title || a.title
  const category = a.primaryCategory || a.primary_category
  return (
    <div style={{ padding: 28, maxWidth: 640 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {category && <Badge tone="blue">{category}</Badge>}
        {a.status === 'publish' && <Badge tone="green">Published</Badge>}
        {a.status === 'draft' && <Badge tone="amber">Draft</Badge>}
        {a.status === 'local' && <Badge tone="neutral">Saved locally</Badge>}
        {(a.wpPostId || a.wp_post_id) && <Badge tone="mono">#{a.wpPostId || a.wp_post_id}</Badge>}
        {(a.wordCount || a.word_count) && <Badge tone="mono">{a.wordCount || a.word_count}w</Badge>}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.015em', margin: '0 0 12px', color: 'var(--ink)' }}>{title}</h1>
      {a.excerpt && <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 20px' }}>{a.excerpt}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" size="lg" leftIcon={<I name="edit" size={14} />} onClick={onEdit}>Open editor</Btn>
      </div>
    </div>
  )
}
