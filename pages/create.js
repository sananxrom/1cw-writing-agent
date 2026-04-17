// pages/create.js - Manual create mode
import { useState } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Btn, Spinner, Topbar, EmptyState } from '../components/UI'
import { scrapeArticle, generateArticle } from '../lib/api'
import { storage } from '../lib/storage'

const ALL_CATEGORIES = [
  'Artificial Intelligence', 'XR, VR, AR – XROM', 'Blockchain',
  'Quantum & Nanotechnology', 'Robotics & Automation', 'Automotive',
  'Life Sciences & Biotechnology', 'Earth & Environment', 'Health & Medicine',
  'Space & Astronomy', 'Startups & Entrepreneurship', 'Policy & Economy',
  'Corporate Tech & Semiconductors', 'Telecom & Energy Tech',
]

export default function Create() {
  const [mode, setMode] = useState('url') // 'url' | 'topic'
  const [input, setInput] = useState('')
  const [category, setCategory] = useState('')
  const [writingNote, setWritingNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [article, setArticle] = useState(null)

  async function handleGenerate() {
    if (!input.trim()) return
    setLoading(true)
    setStatus(mode === 'url' ? 'Fetching article...' : 'Generating...')

    try {
      const settings = storage.getSettings()
      let content = input
      let title = ''
      let sourceUrl = ''
      let image = ''

      if (mode === 'url') {
        try {
          setStatus('Scraping article content...')
          const scraped = await scrapeArticle(input)
          content = scraped.text || scraped.content || ''
          title = scraped.title || ''
          sourceUrl = input
          image = scraped.image || ''
        } catch (err) {
          setStatus('Scrape failed, generating from URL...')
          sourceUrl = input
        }
      }

      setStatus('Generating article with Claude...')

      const result = await generateArticle({
        content: content || input,
        title,
        sourceUrl,
        sourceName: sourceUrl ? new URL(sourceUrl).hostname : '',
        primaryCategory: category,
        writingPrompt: writingNote
          ? `${settings.globalWritingPrompt}\nAdditional instruction: ${writingNote}`
          : settings.globalWritingPrompt,
        mode: mode === 'url' ? 'rewrite' : 'create',
      })

      setArticle({
        ...result,
        featuredImageUrl: image,
        sourceUrl,
        sourceName: sourceUrl ? new URL(sourceUrl).hostname : '',
      })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setLoading(false)
    setStatus('')
  }

  if (article) {
    return (
      <Layout>
        <ArticleEditor
          article={article}
          onBack={() => setArticle(null)}
          onSaved={() => setArticle(null)}
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <Topbar title="Create" subtitle="Manual article creation" />

      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 8, padding: 3, marginBottom: 28, width: 'fit-content' }}>
            {['url', 'topic'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{
                  padding: '7px 20px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: 'none',
                  background: mode === m ? '#0d0d0d' : 'transparent',
                  color: mode === m ? '#fff' : '#5c5b57',
                  fontFamily: "'Sora', sans-serif", transition: 'all 0.15s',
                }}>
                {m === 'url' ? 'From URL' : 'From Topic'}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{mode === 'url' ? 'Article URL' : 'Topic or Idea'}</label>
            {mode === 'url' ? (
              <input value={input} onChange={e => setInput(e.target.value)}
                placeholder="https://techcrunch.com/..."
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
            ) : (
              <textarea value={input} onChange={e => setInput(e.target.value)}
                rows={4}
                placeholder="e.g. 'The geopolitical implications of China's RISC-V chip push in 2026' or 'Write about why quantum computing is closer than people think'"
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
            )}
            <div style={{ fontSize: 11, color: '#9c9a92', marginTop: 4 }}>
              {mode === 'url'
                ? 'Claude will fetch and rewrite this article in your style'
                : 'Claude will write an original article based on this topic'}
            </div>
          </div>

          {/* Category */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Primary Category (optional — Claude will suggest if not set)</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={selectStyle}>
              <option value="">— Let Claude decide —</option>
              {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Writing note */}
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Writing instruction (optional)</label>
            <input value={writingNote} onChange={e => setWritingNote(e.target.value)}
              placeholder="e.g. 'Focus on the India angle' or 'Keep it under 400 words'"
              style={inputStyle} />
          </div>

          <Btn variant="accent" size="lg" onClick={handleGenerate} disabled={loading || !input.trim()}>
            {loading ? <><Spinner size={14} />{status || 'Generating...'}</> : 'Generate Article →'}
          </Btn>

          {status && !loading && (
            <div style={{ marginTop: 12, fontSize: 13, color: status.startsWith('Error') ? '#c0271e' : '#1a7a45', fontFamily: "'DM Mono', monospace" }}>
              {status}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #dedad2', borderRadius: 7,
  fontSize: 13, fontFamily: "'Sora', sans-serif",
  background: '#fdfcf9', color: '#0d0d0d', outline: 'none',
}
const selectStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #dedad2', borderRadius: 7,
  fontSize: 13, fontFamily: "'Sora', sans-serif",
  background: '#fdfcf9', color: '#0d0d0d',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontFamily: "'DM Mono', monospace",
  color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
}
