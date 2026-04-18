// pages/create.js — matching design CreatePage
import { useState } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Topbar, Btn, I, Segmented, TextInput, Textarea, InlineSelect, FieldLabel, Badge, relTime } from '../components/UI'
import { scrapeArticle, generateArticle } from '../lib/api'
import { storage } from '../lib/storage'

const CATEGORIES = [
  'Artificial Intelligence','XR, VR, AR – XROM','Blockchain','Quantum & Nanotechnology',
  'Robotics & Automation','Automotive','Life Sciences & Biotechnology','Earth & Environment',
  'Health & Medicine','Space & Astronomy','Startups & Entrepreneurship','Policy & Economy',
  'Corporate Tech & Semiconductors','Telecom & Energy Tech',
]

export default function Create() {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [topic, setTopic] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [instruction, setInstruction] = useState('')
  const [category, setCategory] = useState('Artificial Intelligence')
  const [length, setLength] = useState('medium')
  const [generating, setGenerating] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const recentHistory = storage.getHistory().slice(0, 3)

  async function handleGenerate() {
    setGenerating(true)
    try {
      const settings = storage.getSettings()
      let content = pasteText
      let title = topic

      if (mode === 'url' && url) {
        try {
          const scraped = await scrapeArticle(url)
          content = scraped.text || ''
          title = scraped.title || url
        } catch {}
      }

      const lengthPrompt = { short: 'Keep under 400 words.', medium: '500-800 words.', long: '900-1200 words.' }[length]

      const article = await generateArticle({
        content: content || topic,
        title: title || topic,
        sourceUrl: mode === 'url' ? url : '',
        primaryCategory: category,
        writingPrompt: (instruction ? instruction + ' ' : '') + lengthPrompt + ' ' + settings.globalWritingPrompt,
        mode: mode === 'url' ? 'rewrite' : 'create',
      })

      setEditingArticle({ ...article, sourceUrl: mode === 'url' ? url : '' })
    } catch (err) {
      alert('Generation failed: ' + err.message)
    }
    setGenerating(false)
  }

  if (editingArticle) return (
    <Layout>
      <ArticleEditor article={editingArticle} onBack={() => setEditingArticle(null)} onSaved={() => setEditingArticle(null)} />
    </Layout>
  )

  return (
    <Layout>
      <Topbar title="Create" subtitle="Generate a one-off article without a source" />
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
        <div style={{ maxWidth: 760 }}>
          <Segmented value={mode} onChange={setMode} options={[
            { value: 'url',   label: 'From URL',    icon: <I name="link" size={13} /> },
            { value: 'topic', label: 'From topic',  icon: <I name="sparkle" size={13} /> },
            { value: 'paste', label: 'Paste text',  icon: <I name="copy" size={13} /> },
          ]} />

          <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
            {mode === 'url' && (
              <>
                <FieldLabel label="Source URL" hint="Any news article, blog post, or press release" />
                <TextInput size="lg" value={url} onChange={setUrl} placeholder="https://example.com/article" icon="link" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>Agent will scrape → detect category → rewrite in the 1cw.org voice.</div>
              </>
            )}
            {mode === 'topic' && (
              <>
                <FieldLabel label="Topic or headline" />
                <TextInput size="lg" value={topic} onChange={setTopic} placeholder="e.g. India's AI compute buildout in 2026" style={{ marginBottom: 16 }} />
                <FieldLabel label="Angle / thesis" hint="What's the take? (optional)" />
                <Textarea value={instruction} onChange={setInstruction} rows={3} placeholder="Argue that NVIDIA's India capacity deals will primarily benefit startups, not incumbents." />
              </>
            )}
            {mode === 'paste' && (
              <>
                <FieldLabel label="Source text" hint="Paste the article you want rewritten" />
                <Textarea value={pasteText} onChange={setPasteText} rows={10} placeholder="Paste source content here…" />
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <FieldLabel label="Category" />
                <InlineSelect value={category} onChange={setCategory} options={CATEGORIES.map(c => ({ value: c, label: c }))} style={{ width: '100%' }} />
              </div>
              <div>
                <FieldLabel label="Length" />
                <Segmented value={length} onChange={setLength} options={[
                  { value: 'short', label: 'Short' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'long', label: 'Long' },
                ]} />
              </div>
            </div>

            {mode !== 'topic' && (
              <div style={{ marginTop: 16 }}>
                <FieldLabel label="Writing instruction" hint="(optional)" />
                <TextInput size="md" value={instruction} onChange={setInstruction} placeholder="e.g. Focus on the India angle, keep under 400 words…" />
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn variant="accent" size="lg" leftIcon={generating ? null : <I name="sparkle" size={14} />} onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating…' : 'Generate article'}
              </Btn>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>~ 15–20s with Claude Sonnet</span>
            </div>
          </div>

          {recentHistory.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Recent one-offs</div>
              {recentHistory.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, background: 'var(--surface)', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {h.primaryCategory && <Badge tone="blue" size="sm">{h.primaryCategory.split('&')[0].trim()}</Badge>}
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{h.wordCount ? h.wordCount + 'w · ' : ''}{relTime(h.timestamp)}</span>
                    </div>
                  </div>
                  <Btn variant="ghost" size="sm" rightIcon={<I name="chevronRight" size={11} />}>Open</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
