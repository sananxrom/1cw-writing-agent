// components/ArticleEditor.js
import { useState, useEffect, useRef } from 'react'
import { Btn, Input, Select, Toggle, Badge, Card, CardHeader, Spinner } from './UI'
import { generateArticle, searchPixabay, uploadImageToWP, resolveCategoryIds, resolveTagIds, saveToWordPress } from '../lib/api'
import { storage } from '../lib/storage'

const ALL_CATEGORIES = [
  'Artificial Intelligence', 'XR, VR, AR – XROM', 'Blockchain',
  'Quantum & Nanotechnology', 'Robotics & Automation', 'Automotive',
  'Life Sciences & Biotechnology', 'Earth & Environment', 'Health & Medicine',
  'Space & Astronomy', 'Startups & Entrepreneurship', 'Policy & Economy',
  'Corporate Tech & Semiconductors', 'Telecom & Energy Tech',
]
const REGION_TAGS = ['India', 'North America', 'Europe', 'Asia-Pacific', 'China', 'Latin America', 'Middle East & Africa']
const LAYOUTS = ['default', 'layout-1', 'layout-2', 'layout-3', 'layout-4', 'layout-5', 'layout-6', 'layout-7', 'layout-8']
const FORMATS = ['standard', 'video', 'audio', 'gallery']

export default function ArticleEditor({ article: initialArticle, onSaved, onBack, source }) {
  const [article, setArticle] = useState(initialArticle)
  const [activePanel, setActivePanel] = useState('content')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [regenLoading, setRegenLoading] = useState({})
  const [pixabayImages, setPixabayImages] = useState([])
  const [pixabayLoading, setPixabayLoading] = useState(false)
  const [pixabayQuery, setPixabayQuery] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [wpCache, setWpCache] = useState({ categories: [], tags: [], users: [] })
  const [htmlMode, setHtmlMode] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => {
    const cache = storage.getWPCache()
    setWpCache(cache)
    if (!pixabayQuery && article.title) {
      setPixabayQuery(article.focusKeyword || article.title.split(' ').slice(0, 3).join(' '))
    }
  }, [])

  const set = (key, val) => setArticle(prev => ({ ...prev, [key]: val }))

  const handleRegen = async (field, instruction) => {
    setRegenLoading(prev => ({ ...prev, [field]: true }))
    try {
      const settings = storage.getSettings()
      const result = await generateArticle({
        regenerateField: field,
        regenerateInstruction: instruction,
        currentArticle: article,
        writingPrompt: source?.writingPrompt || settings.globalWritingPrompt,
      })
      if (result[field] !== undefined) {
        set(field, result[field])
        if (field === 'body') {
          const wc = result[field].replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
          set('wordCount', wc)
        }
      }
    } catch (err) {
      alert('Regen failed: ' + err.message)
    }
    setRegenLoading(prev => ({ ...prev, [field]: false }))
  }

  const searchImages = async () => {
    if (!pixabayQuery) return
    setPixabayLoading(true)
    try {
      const result = await searchPixabay(pixabayQuery)
      setPixabayImages(result.images || [])
    } catch (err) {
      alert('Image search failed: ' + err.message)
    }
    setPixabayLoading(false)
  }

  const selectImage = async (img) => {
    setUploadLoading(true)
    try {
      const uploaded = await uploadImageToWP(img.largeImageURL, null, article.title)
      set('featuredImageId', uploaded.id)
      set('featuredImageUrl', uploaded.url)
    } catch (err) {
      // Store URL for display even if WP upload failed
      set('featuredImageUrl', img.webformatURL)
      set('featuredImagePixabay', img.largeImageURL)
    }
    setUploadLoading(false)
  }

  // Check for blank critical fields
  function getWarnings() {
    const w = []
    if (!article.title?.trim()) w.push('Title')
    if (!article.body?.trim()) w.push('Body')
    if (!article.primaryCategory) w.push('Primary Category')
    if (!article.seoTitle?.trim()) w.push('SEO Title')
    if (!article.metaDescription?.trim()) w.push('Meta Description')
    if (!article.slug?.trim()) w.push('Slug')
    return w
  }

  function handleLocalSave() {
    try {
      const key = '1cw_local_' + (article.slug || Date.now())
      localStorage.setItem(key, JSON.stringify({ ...article, savedAt: Date.now() }))
      setSaveMsg('Saved locally ✓ (not sent to WordPress)')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveMsg('Local save failed: ' + err.message)
    }
  }

  const [showWarnings, setShowWarnings] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)

  function handleSaveClick(status) {
    const warnings = getWarnings()
    if (warnings.length > 0) {
      setPendingStatus(status)
      setShowWarnings(true)
    } else {
      handleSave(status)
    }
  }

  const handleSave = async (status = 'draft') => {
    setShowWarnings(false)
    setSaving(true)
    setSaveMsg('')
    try {
      const cache = storage.getWPCache()

      // Auto-upload featured image to WP if we have a URL but no ID yet
      let featuredImageId = article.featuredImageId
      if (!featuredImageId && article.featuredImageUrl && !article.featuredImageUrl.startsWith('data:')) {
        setSaveMsg('Uploading featured image…')
        try {
          const uploaded = await uploadImageToWP(article.featuredImageUrl, null, article.title)
          featuredImageId = uploaded.id
          set('featuredImageId', uploaded.id)
          set('featuredImageUrl', uploaded.url)
        } catch (imgErr) {
          console.warn('Image upload failed (non-fatal):', imgErr.message)
        }
      }

      // Resolve categories
      const allCats = [article.primaryCategory, ...(article.additionalCategories || [])].filter(Boolean)
      const categoryIds = await resolveCategoryIds(allCats, cache.categories)

      // Resolve tags
      const allTags = [...(article.regionTags || []), ...(article.keywordTags || [])]
      const tagIds = await resolveTagIds(allTags, cache.tags)

      // Get author ID
      const authors = storage.getAuthors()
      const authorObj = authors.find(a => a.id === article.authorId) || authors[0]
      const authorId = authorObj?.wpUserId || undefined

      const post = await saveToWordPress(
        { ...article, status },
        { categoryIds, tagIds, authorId, featuredImageId }
      )

      set('wpPostId', post.id)
      set('wpPostUrl', post.link)
      setSaveMsg(`Saved as ${status}! Post ID: ${post.id}`)

      storage.addHistory({
        wpPostId: post.id,
        title: article.title,
        primaryCategory: article.primaryCategory,
        sourceUrl: article.sourceUrl,
        sourceName: article.sourceName,
        status,
        url: post.link,
      })

      if (onSaved) onSaved(post, article)
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    }
    setSaving(false)
  }

  const PANELS = ['content', 'seo', 'taxonomy', 'foxiz', 'image', 'publish']

  const panelStyle = (p) => ({
    padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 6,
    background: activePanel === p ? '#0d0d0d' : 'transparent',
    color: activePanel === p ? '#fff' : '#5c5b57',
    border: 'none', fontFamily: "'Sora', sans-serif",
    transition: 'all 0.15s',
  })

  const fieldLabel = (label, field, canRegen = true) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
      <label style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {canRegen && (
        <RegenBtn field={field} loading={!!regenLoading[field]} onRegen={handleRegen} />
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Warnings modal */}
      {showWarnings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fdfcf9', borderRadius: 12, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#0d0d0d', marginBottom: 12 }}>Fields missing</div>
            <div style={{ fontSize: 13, color: '#5c5b57', marginBottom: 16 }}>
              The following fields are empty:
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {getWarnings().map(w => <li key={w} style={{ color: '#c0271e', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{w}</li>)}
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => { setShowWarnings(false); setPendingStatus(null) }}>Go back</Btn>
              <Btn variant="accent" onClick={() => handleSave(pendingStatus)}>Proceed anyway</Btn>
            </div>
          </div>
        </div>
      )}
      {/* Top toolbar */}
      <div style={{ background: '#fdfcf9', borderBottom: '1px solid #dedad2', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c9a92', fontSize: 13 }}>← Back</button>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: '#0d0d0d' }}>
            {article.title?.slice(0, 60) || 'New Article'}
            {article.title?.length > 60 ? '…' : ''}
          </div>
          {article.wpPostId && <Badge color="green">Saved to WP #{article.wpPostId}</Badge>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveMsg && <span style={{ fontSize: 12, color: saveMsg.startsWith('Error') ? '#c0271e' : '#1a7a45', fontFamily: "'DM Mono', monospace" }}>{saveMsg}</span>}
          <Btn variant="secondary" size="sm" onClick={() => handleSaveClick('draft')} disabled={saving}>
            {saving ? <Spinner size={12} /> : ''}Save Draft
          </Btn>
          <Btn variant="accent" size="sm" onClick={() => handleSaveClick('publish')} disabled={saving}>
            Publish to 1cw.org
          </Btn>
        </div>
      </div>

      {/* Panel tabs */}
      <div style={{ background: '#edeae3', borderBottom: '1px solid #dedad2', padding: '6px 20px', display: 'flex', gap: 4, flexShrink: 0 }}>
        {PANELS.map(p => (
          <button key={p} style={panelStyle(p)} onClick={() => setActivePanel(p)}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* CONTENT PANEL */}
        {activePanel === 'content' && (
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div style={{ marginBottom: 16 }}>
              {fieldLabel('Title', 'title')}
              <input value={article.title || ''} onChange={e => set('title', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #dedad2', borderRadius: 7, fontSize: 18, fontFamily: "'Instrument Serif', serif", background: '#fdfcf9', color: '#0d0d0d', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              {fieldLabel('Tagline', 'tagline')}
              <input value={article.tagline || ''} onChange={e => set('tagline', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #dedad2', borderRadius: 7, fontSize: 14, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#5c5b57', fontStyle: 'italic', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                {fieldLabel('Body', 'body')}
                <button onClick={() => setHtmlMode(!htmlMode)}
                  style={{ fontSize: 11, color: '#9c9a92', background: 'none', border: '1px solid #dedad2', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                  {htmlMode ? 'Preview' : 'HTML'}
                </button>
              </div>
              {htmlMode ? (
                <textarea value={article.body || ''} onChange={e => {
                  set('body', e.target.value)
                  const wc = e.target.value.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
                  set('wordCount', wc)
                }}
                  style={{ width: '100%', minHeight: 400, padding: '12px', border: '1px solid #dedad2', borderRadius: 7, fontSize: 12, fontFamily: "'DM Mono', monospace", background: '#fdfcf9', color: '#0d0d0d', resize: 'vertical', outline: 'none', lineHeight: 1.6 }} />
              ) : (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => {
                    set('body', e.target.innerHTML)
                    const wc = e.target.innerText.split(/\s+/).filter(Boolean).length
                    set('wordCount', wc)
                  }}
                  dangerouslySetInnerHTML={{ __html: article.body || '' }}
                  style={{ width: '100%', minHeight: 400, padding: '16px', border: '1px solid #dedad2', borderRadius: 7, fontSize: 14, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', outline: 'none', lineHeight: 1.7 }}
                  className="prose-editor"
                />
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              {fieldLabel('Excerpt', 'excerpt')}
              <textarea value={article.excerpt || ''} onChange={e => set('excerpt', e.target.value)} rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #dedad2', borderRadius: 7, fontSize: 13, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', resize: 'vertical', outline: 'none', lineHeight: 1.6 }} />
            </div>
          </div>
        )}

        {/* SEO PANEL */}
        {activePanel === 'seo' && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ marginBottom: 16 }}>
              {fieldLabel('SEO Title', 'seoTitle')}
              <input value={article.seoTitle || ''} onChange={e => set('seoTitle', e.target.value)}
                style={inputStyle} />
              <div style={{ fontSize: 11, color: article.seoTitle?.length > 60 ? '#c0271e' : '#9c9a92', marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                {article.seoTitle?.length || 0}/60 chars
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              {fieldLabel('Meta Description', 'metaDescription')}
              <textarea value={article.metaDescription || ''} onChange={e => set('metaDescription', e.target.value)} rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ fontSize: 11, color: (article.metaDescription?.length || 0) > 155 ? '#c0271e' : '#9c9a92', marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                {article.metaDescription?.length || 0}/155 chars
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              {fieldLabel('Focus Keyword', 'focusKeyword')}
              <input value={article.focusKeyword || ''} onChange={e => set('focusKeyword', e.target.value)}
                style={inputStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              {fieldLabel('Slug', 'slug', false)}
              <input value={article.slug || ''} onChange={e => set('slug', e.target.value)}
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
              <div style={{ fontSize: 11, color: '#9c9a92', marginTop: 3 }}>
                1cw.org/{article.slug || '...'}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Canonical URL (optional)</label>
              <input value={article.canonicalUrl || ''} onChange={e => set('canonicalUrl', e.target.value)}
                placeholder="https://..." style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
            </div>

            {/* SEO Preview */}
            <div style={{ background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 8, padding: 16, marginTop: 8 }}>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Google preview</div>
              <div style={{ color: '#1a0dab', fontSize: 18, marginBottom: 2, cursor: 'pointer' }}>{article.seoTitle || article.title || 'Title'}</div>
              <div style={{ color: '#006621', fontSize: 13, marginBottom: 4, fontFamily: "'DM Mono', monospace" }}>1cw.org › {article.slug || '...'}</div>
              <div style={{ color: '#545454', fontSize: 14, lineHeight: 1.5 }}>{article.metaDescription || 'Meta description...'}</div>
            </div>
          </div>
        )}

        {/* TAXONOMY PANEL */}
        {activePanel === 'taxonomy' && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Primary Category *</label>
              <select value={article.primaryCategory || ''} onChange={e => set('primaryCategory', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #dedad2', borderRadius: 6, fontSize: 13, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d' }}>
                <option value="">Select primary category...</option>
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Additional Categories (up to 2)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ALL_CATEGORIES.filter(c => c !== article.primaryCategory).map(c => {
                  const selected = (article.additionalCategories || []).includes(c)
                  return (
                    <div key={c} onClick={() => {
                      const curr = article.additionalCategories || []
                      if (selected) set('additionalCategories', curr.filter(x => x !== c))
                      else if (curr.length < 2) set('additionalCategories', [...curr, c])
                    }}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                        border: `1px solid ${selected ? '#0d0d0d' : '#dedad2'}`,
                        background: selected ? '#0d0d0d' : '#fdfcf9',
                        color: selected ? '#fff' : '#5c5b57',
                      }}>
                      {c}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Region Tags (auto-detected)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {REGION_TAGS.map(r => {
                  const selected = (article.regionTags || []).includes(r)
                  return (
                    <div key={r} onClick={() => {
                      const curr = article.regionTags || []
                      set('regionTags', selected ? curr.filter(x => x !== r) : [...curr, r])
                    }}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                        border: `1px solid ${selected ? '#185fa5' : '#dedad2'}`,
                        background: selected ? '#e6f1fb' : '#fdfcf9',
                        color: selected ? '#185fa5' : '#5c5b57',
                      }}>
                      {r}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              {fieldLabel('Keyword Tags', 'keywordTags')}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {(article.keywordTags || []).map((tag, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: '#fef1eb', border: '1px solid #f5c4a8', color: '#c8440a', fontSize: 12 }}>
                    {tag}
                    <button onClick={() => set('keywordTags', article.keywordTags.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8440a', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
              <input
                placeholder="Add tag and press Enter"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    set('keywordTags', [...(article.keywordTags || []), e.target.value.trim()])
                    e.target.value = ''
                  }
                }}
                style={{ ...inputStyle, width: 'auto' }}
              />
            </div>
          </div>
        )}

        {/* FOXIZ PANEL */}
        {activePanel === 'foxiz' && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Post Format</label>
                <select value={article.postFormat || 'standard'} onChange={e => set('postFormat', e.target.value)}
                  style={selectStyle}>
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Single Layout</label>
                <select value={article.singleLayout || 'default'} onChange={e => set('singleLayout', e.target.value)}
                  style={selectStyle}>
                  {LAYOUTS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {(article.postFormat === 'video') && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Video URL (YouTube / Vimeo)</label>
                <input value={article.videoUrl || ''} onChange={e => set('videoUrl', e.target.value)}
                  placeholder="https://youtube.com/watch?v=..." style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
              </div>
            )}

            {(article.postFormat === 'audio') && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Audio URL</label>
                <input value={article.audioUrl || ''} onChange={e => set('audioUrl', e.target.value)}
                  placeholder="https://..." style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
              </div>
            )}

            <div style={{ background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Toggle label="Table of Contents" checked={!!article.enableToc} onChange={v => set('enableToc', v)} helpText="Auto-generate TOC from headings" />
              <Toggle label="Sponsored Post" checked={!!article.sponsored} onChange={v => set('sponsored', v)} />
              {article.sponsored && (
                <input value={article.sponsoredLabel || 'Sponsored'} onChange={e => set('sponsoredLabel', e.target.value)}
                  placeholder="Sponsored label text" style={{ ...inputStyle, marginBottom: 8 }} />
              )}
              <Toggle label="Hide Ads" checked={!!article.hideAds} onChange={v => set('hideAds', v)} helpText="Disable ads on this article" />
              <Toggle label="Hide Featured Image" checked={!!article.hideFeatured} onChange={v => set('hideFeatured', v)} />
              <Toggle label="Inline Related Posts" checked={!!article.inlineRelated} onChange={v => set('inlineRelated', v)} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Review Score (optional, 0–10)</label>
              <input type="number" min="0" max="10" step="0.5"
                value={article.reviewScore || ''} onChange={e => set('reviewScore', e.target.value)}
                style={{ ...inputStyle, width: 120 }} />
            </div>
          </div>
        )}

        {/* IMAGE PANEL */}
        {activePanel === 'image' && (
          <div style={{ maxWidth: 800 }}>
            {article.featuredImageUrl && (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Current Featured Image</label>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={article.featuredImageUrl} alt="Featured" style={{ maxWidth: 400, height: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid #dedad2' }} />
                  {article.featuredImageId && <div style={{ position: 'absolute', top: 8, right: 8 }}><Badge color="green">Uploaded to WP</Badge></div>}
                  <button onClick={() => { set('featuredImageUrl', ''); set('featuredImageId', null) }}
                    style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}>
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Pixabay search */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Search Pixabay</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={pixabayQuery} onChange={e => setPixabayQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchImages()}
                  placeholder="Search images..."
                  style={{ ...inputStyle, flex: 1 }} />
                <Btn variant="secondary" onClick={searchImages} disabled={pixabayLoading}>
                  {pixabayLoading ? <Spinner size={12} /> : 'Search'}
                </Btn>
              </div>

              {pixabayImages.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {pixabayImages.map(img => (
                    <div key={img.id} onClick={() => selectImage(img)}
                      style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: '2px solid transparent', transition: 'border 0.15s', position: 'relative' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#c8440a'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                      <img src={img.previewURL} alt={img.tags} style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                      {uploadLoading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual upload */}
            <div>
              <label style={labelStyle}>Manual Upload</label>
              <Btn variant="secondary" onClick={() => fileInputRef.current?.click()}>Upload Image</Btn>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploadLoading(true)
                  const reader = new FileReader()
                  reader.onload = async (ev) => {
                    set('featuredImageUrl', ev.target.result)
                    setUploadLoading(false)
                  }
                  reader.readAsDataURL(file)
                }} />
            </div>
          </div>
        )}

        {/* PUBLISH PANEL */}
        {activePanel === 'publish' && (
          <div style={{ maxWidth: 600 }}>
            {/* Author */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Author</label>
              <select value={article.authorId || ''} onChange={e => set('authorId', e.target.value)}
                style={selectStyle}>
                <option value="">— Default —</option>
                {storage.getAuthors().map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Meta summary */}
            <div style={{ background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Article summary</div>
              {[
                ['Word count', article.wordCount || 0],
                ['Primary category', article.primaryCategory || '—'],
                ['Post format', article.postFormat || 'standard'],
                ['Single layout', article.singleLayout || 'default'],
                ['Region tags', (article.regionTags || []).join(', ') || 'None'],
                ['Source', article.sourceName || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f5f3ee', fontSize: 13 }}>
                  <span style={{ color: '#9c9a92' }}>{k}</span>
                  <span style={{ color: '#2e2e2b', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Source attribution */}
            {article.sourceUrl && (
              <div style={{ background: '#fef1eb', border: '1px solid #f5c4a8', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 12 }}>
                <div style={{ color: '#c8440a', fontFamily: "'DM Mono', monospace", fontSize: 10, marginBottom: 4 }}>SOURCE ATTRIBUTION</div>
                <div style={{ color: '#2e2e2b' }}>{article.sourceName}</div>
                <div style={{ color: '#9c9a92', fontSize: 11, wordBreak: 'break-all', fontFamily: "'DM Mono', monospace" }}>{article.sourceUrl}</div>
              </div>
            )}

            {saveMsg && (
              <div style={{
                padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13,
                background: saveMsg.startsWith('Error') ? '#fdecea' : '#e4f4ec',
                color: saveMsg.startsWith('Error') ? '#c0271e' : '#1a7a45',
                border: `1px solid ${saveMsg.startsWith('Error') ? '#f5c0bc' : '#a8dfc0'}`,
              }}>
                {saveMsg}
                {article.wpPostUrl && !saveMsg.startsWith('Error') && (
                  <a href={article.wpPostUrl} target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: 8, color: '#1a7a45', textDecoration: 'underline' }}>
                    View in WP →
                  </a>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="ghost" size="lg" onClick={handleLocalSave} disabled={saving}>
                💾 Save Here
              </Btn>
              <Btn variant="secondary" size="lg" onClick={() => handleSaveClick('draft')} disabled={saving}>
                {saving ? <Spinner size={14} /> : ''}
                {article.wpPostId ? 'Update Draft' : 'Save as Draft'}
              </Btn>
              <Btn variant="accent" size="lg" onClick={() => handleSaveClick('publish')} disabled={saving}>
                Publish Now
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Inline styles
const inputStyle = {
  width: '100%', padding: '8px 10px',
  border: '1px solid #dedad2', borderRadius: 6,
  fontSize: 13, fontFamily: "'Sora', sans-serif",
  background: '#fdfcf9', color: '#0d0d0d', outline: 'none',
}
const selectStyle = {
  width: '100%', padding: '8px 10px',
  border: '1px solid #dedad2', borderRadius: 6,
  fontSize: 13, fontFamily: "'Sora', sans-serif",
  background: '#fdfcf9', color: '#0d0d0d',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontFamily: "'DM Mono', monospace",
  color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
}

// Inline RegenBtn to avoid circular import
function RegenBtn({ field, onRegen, loading }) {
  const [show, setShow] = useState(false)
  const [inst, setInst] = useState('')
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {!show ? (
        <button onClick={() => setShow(true)} style={{ background: 'none', border: '1px solid #dedad2', borderRadius: 4, padding: '1px 7px', fontSize: 10, color: '#9c9a92', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
          {loading ? '...' : '↺ regen'}
        </button>
      ) : (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input autoFocus value={inst} onChange={e => setInst(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onRegen(field, inst); setShow(false); setInst('') } if (e.key === 'Escape') { setShow(false); setInst('') } }}
            placeholder="Instruction... (Enter)"
            style={{ fontSize: 11, padding: '2px 7px', border: '1px solid #c8440a', borderRadius: 4, outline: 'none', width: 180, fontFamily: "'Sora', sans-serif" }} />
          <button onClick={() => { onRegen(field, inst); setShow(false); setInst('') }}
            style={{ background: '#c8440a', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Run</button>
          <button onClick={() => { setShow(false); setInst('') }}
            style={{ background: 'none', border: '1px solid #dedad2', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer', color: '#9c9a92' }}>✕</button>
        </span>
      )}
    </span>
  )
}
