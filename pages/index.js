// pages/index.js - Discover mode
import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Btn, Badge, Card, CardHeader, Spinner, EmptyState, Topbar } from '../components/UI'
import { fetchRSS, scrapeArticle, generateArticle } from '../lib/api'
import { storage } from '../lib/storage'

export default function Discover() {
  const [sources, setSources] = useState([])
  const [feedItems, setFeedItems] = useState({})
  const [loadingSource, setLoadingSource] = useState({})
  const [selected, setSelected] = useState([])
  const [generating, setGenerating] = useState(false)
  const [generatingItem, setGeneratingItem] = useState(null)
  const [editingArticle, setEditingArticle] = useState(null)
  const [activeSource, setActiveSource] = useState('all')

  useEffect(() => {
    const s = storage.getSources().filter(s => s.type === 'rss' && s.active)
    setSources(s)
    // Auto-fetch all active sources
    s.forEach(src => loadSource(src))
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
      }))
      setFeedItems(prev => ({ ...prev, [src.id]: items }))
    } catch (err) {
      setFeedItems(prev => ({ ...prev, [src.id]: [] }))
    }
    setLoadingSource(prev => ({ ...prev, [src.id]: false }))
  }

  const allItems = Object.entries(feedItems).flatMap(([srcId, items]) =>
    items.map(item => ({ ...item, sourceId: srcId }))
  )

  const displayItems = activeSource === 'all'
    ? allItems
    : feedItems[activeSource] || []

  const toggleSelect = (link) => {
    setSelected(prev => prev.includes(link) ? prev.filter(l => l !== link) : [...prev, link])
  }

  async function generateSelected() {
    if (!selected.length) return
    const settings = storage.getSettings()
    setGenerating(true)

    for (const link of selected) {
      const item = allItems.find(i => i.link === link)
      if (!item) continue
      const src = sources.find(s => s.id === item.sourceId)

      setGeneratingItem(item.title)
      try {
        // Scrape full article
        let content = item.content || item.summary || ''
        try {
          const scraped = await scrapeArticle(item.link)
          if (scraped.text && scraped.text.length > content.length) {
            content = scraped.text
          }
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
        })

        // Mark as seen
        storage.addSeenUrl(item.link)

        setGenerating(false)
        setGeneratingItem(null)
        setSelected([])
        setEditingArticle({
          ...article,
          featuredImageUrl: item.image || '',
          sourceUrl: item.link,
          sourceName: item.sourceName || src?.name,
          videoUrl: src?.postFormat === 'video' ? item.link : '',
        })
        return // Open editor for first generated article
      } catch (err) {
        console.error('Generate failed:', err)
      }
    }
    setGenerating(false)
    setGeneratingItem(null)
  }

  if (editingArticle) {
    return (
      <Layout>
        <ArticleEditor
          article={editingArticle}
          source={sources.find(s => s.name === editingArticle.sourceName)}
          onBack={() => setEditingArticle(null)}
          onSaved={() => setEditingArticle(null)}
        />
      </Layout>
    )
  }

  const isLoading = Object.values(loadingSource).some(Boolean)

  return (
    <Layout>
      <Topbar
        title="Discover"
        subtitle={`${allItems.length} articles`}
        actions={
          <>
            <Btn variant="secondary" size="sm" onClick={() => sources.forEach(s => loadSource(s))}>
              {isLoading ? <Spinner size={12} /> : ''}Refresh
            </Btn>
            {selected.length > 0 && (
              <Btn variant="accent" onClick={generateSelected} disabled={generating}>
                {generating ? <><Spinner size={12} />Generating "{generatingItem?.slice(0, 30)}..."</> : `Generate ${selected.length} article${selected.length > 1 ? 's' : ''} →`}
              </Btn>
            )}
          </>
        }
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Source filter sidebar */}
        <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid #dedad2', background: '#fdfcf9', padding: 12, overflow: 'auto' }}>
          <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '0 4px' }}>Sources</div>
          {[{ id: 'all', name: 'All Sources' }, ...sources].map(src => (
            <div key={src.id} onClick={() => setActiveSource(src.id)}
              style={{
                padding: '7px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', marginBottom: 2,
                background: activeSource === src.id ? '#0d0d0d' : 'transparent',
                color: activeSource === src.id ? '#fff' : '#5c5b57',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
              <span>{src.name}</span>
              {src.id !== 'all' && (
                <span style={{ fontSize: 10, opacity: 0.6 }}>
                  {loadingSource[src.id] ? '...' : (feedItems[src.id]?.length || 0)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Article list */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {displayItems.length === 0 && !isLoading && (
            <EmptyState icon="◈" title="No articles yet" description="Refresh to load latest articles from your sources" />
          )}

          {displayItems.map((item, i) => (
            <div key={item.link || i}
              style={{
                display: 'flex', gap: 12, padding: '14px 0',
                borderBottom: '1px solid #edeae3',
                opacity: item.seen ? 0.5 : 1,
              }}>
              {/* Checkbox */}
              <div onClick={() => !item.seen && toggleSelect(item.link)}
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 3,
                  border: `1.5px solid ${selected.includes(item.link) ? '#0d0d0d' : '#dedad2'}`,
                  background: selected.includes(item.link) ? '#0d0d0d' : '#fdfcf9',
                  cursor: item.seen ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {selected.includes(item.link) && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
              </div>

              {/* Thumbnail */}
              {item.image && (
                <div style={{ width: 72, height: 50, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: '#edeae3' }}>
                  <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                </div>
              )}

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase' }}>{item.sourceName}</span>
                  {item.seen && <Badge color="gray">Already generated</Badge>}
                  <span style={{ fontSize: 10, color: '#bbb', fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>
                    {item.pubDate ? new Date(item.pubDate).toLocaleDateString() : ''}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d0d', marginBottom: 4, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 12, color: '#9c9a92', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {item.summary?.replace(/<[^>]+>/g, '').slice(0, 160)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
