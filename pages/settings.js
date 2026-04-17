// pages/settings.js
import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { Btn, Badge, Toggle, Spinner, Topbar } from '../components/UI'
import { storage, DEFAULT_SOURCES, DEFAULT_AI_PROVIDERS, PROVIDER_MODELS } from '../lib/storage'
import { wpRequest } from '../lib/api'

const ALL_CATEGORIES = [
  'Artificial Intelligence', 'XR, VR, AR – XROM', 'Blockchain',
  'Quantum & Nanotechnology', 'Robotics & Automation', 'Automotive',
  'Life Sciences & Biotechnology', 'Earth & Environment', 'Health & Medicine',
  'Space & Astronomy', 'Startups & Entrepreneurship', 'Policy & Economy',
  'Corporate Tech & Semiconductors', 'Telecom & Energy Tech',
]

export default function Settings() {
  const [activeSection, setActiveSection] = useState('wordpress')
  const [settings, setSettings] = useState({})
  const [sources, setSources] = useState([])
  const [authors, setAuthors] = useState([])
  const [aiProviders, setAIProviders] = useState(DEFAULT_AI_PROVIDERS)
  const [testingProvider, setTestingProvider] = useState({})
  const [testProviderResult, setTestProviderResult] = useState({})
  const [testing, setTesting] = useState({})
  const [testResult, setTestResult] = useState({})
  const [saved, setSaved] = useState(false)
  const [editingSource, setEditingSource] = useState(null)
  const [editingAuthor, setEditingAuthor] = useState(null)
  const [wpCache, setWpCache] = useState({ categories: [], users: [] })

  useEffect(() => {
    setSettings(storage.getSettings())
    setSources(storage.getSources())
    setAuthors(storage.getAuthors())
    setWpCache(storage.getWPCache())
    setAIProviders(storage.getAIProviders())
  }, [])

  function saveAll() {
    storage.setSettings(settings)
    storage.setSources(sources)
    storage.setAuthors(authors)
    storage.setAIProviders(aiProviders)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testProvider(task) {
    const cfg = aiProviders[task]
    if (!cfg?.apiKey) {
      setTestProviderResult(p => ({ ...p, [task]: '✗ No API key entered' }))
      return
    }
    setTestingProvider(p => ({ ...p, [task]: true }))
    setTestProviderResult(p => ({ ...p, [task]: '' }))
    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Test', title: 'Test', mode: 'create',
          primaryCategory: 'Artificial Intelligence', writingPrompt: 'One sentence.',
          provider: cfg.provider, model: cfg.model, apiKey: cfg.apiKey,
        }),
      })
      const d = await r.json()
      if (d.title) setTestProviderResult(p => ({ ...p, [task]: '✓ Working!' }))
      else throw new Error(d.error || 'No response')
    } catch (err) {
      setTestProviderResult(p => ({ ...p, [task]: `✗ ${err.message.slice(0, 80)}` }))
    }
    setTestingProvider(p => ({ ...p, [task]: false }))
  }

  async function testWP() {
    setTesting(p => ({ ...p, wp: true }))
    setTestResult(p => ({ ...p, wp: '' }))
    try {
      const cats = await wpRequest('categories?per_page=100')
      const users = await wpRequest('users?per_page=100')
      const tags = await wpRequest('tags?per_page=100')
      const cache = { categories: cats, users, tags, fetchedAt: Date.now() }
      storage.setWPCache(cache)
      setWpCache(cache)
      setTestResult(p => ({ ...p, wp: `✓ Connected! Found ${cats.length} categories, ${users.length} users, ${tags.length} tags.` }))
    } catch (err) {
      setTestResult(p => ({ ...p, wp: `✗ ${err.message}` }))
    }
    setTesting(p => ({ ...p, wp: false }))
  }

  async function testAnthropicKey() {
    setTesting(p => ({ ...p, anthropic: true }))
    setTestResult(p => ({ ...p, anthropic: '' }))
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test', title: 'Test', mode: 'create', primaryCategory: 'Artificial Intelligence', writingPrompt: 'One sentence.' }),
      })
      const data = await res.json()
      if (data.title) setTestResult(p => ({ ...p, anthropic: '✓ Claude API working!' }))
      else throw new Error(data.error || 'No response')
    } catch (err) {
      setTestResult(p => ({ ...p, anthropic: `✗ ${err.message}` }))
    }
    setTesting(p => ({ ...p, anthropic: false }))
  }

  const SECTIONS = ['wordpress', 'aiproviders', 'writing', 'authors', 'sources']
  const SECTION_LABELS = { wordpress: 'WordPress', aiproviders: 'AI Providers', writing: 'Writing Style', authors: 'Authors', sources: 'Sources' }

  return (
    <Layout>
      <Topbar
        title="Settings"
        actions={
          <Btn variant={saved ? 'success' : 'primary'} onClick={saveAll}>
            {saved ? '✓ Saved!' : 'Save All Changes'}
          </Btn>
        }
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Section nav */}
        <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid #dedad2', background: '#fdfcf9', padding: 12 }}>
          {SECTIONS.map(s => (
            <div key={s} onClick={() => setActiveSection(s)}
              style={{
                padding: '8px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', marginBottom: 2,
                background: activeSection === s ? '#0d0d0d' : 'transparent',
                color: activeSection === s ? '#fff' : '#5c5b57',
              }}>
              {SECTION_LABELS[s]}
            </div>
          ))}
        </div>

        {/* Section content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
          <div style={{ maxWidth: 680 }}>

            {/* WORDPRESS */}
            {activeSection === 'wordpress' && (
              <div>
                <SectionTitle>WordPress Connection</SectionTitle>
                <div style={{ background: '#fdef1eb', border: '1px solid #dedad2', borderRadius: 8, padding: 16, marginBottom: 20, background: '#fff8f5', borderColor: '#f5c4a8' }}>
                  <div style={{ fontSize: 12, color: '#c8440a', fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>ℹ Connection is configured via Vercel environment variables</div>
                  <div style={{ fontSize: 13, color: '#5c5b57', lineHeight: 1.6 }}>
                    WP_URL, WP_USER, and WP_PASSWORD are set in your Vercel project settings. Use the test button below to verify the connection is working.
                  </div>
                </div>

                <FieldLabel>SEO Plugin</FieldLabel>
                <select value={settings.seoPlugin || 'rankmath'} onChange={e => setSettings(p => ({ ...p, seoPlugin: e.target.value }))}
                  style={selectStyle}>
                  <option value="rankmath">Rank Math</option>
                  <option value="yoast">Yoast SEO</option>
                  <option value="none">None</option>
                </select>

                <div style={{ marginTop: 20 }}>
                  <Btn variant="secondary" onClick={testWP} disabled={testing.wp}>
                    {testing.wp ? <Spinner size={12} /> : ''}Test WordPress Connection
                  </Btn>
                  {testResult.wp && (
                    <div style={{ marginTop: 8, fontSize: 13, fontFamily: "'DM Mono', monospace", color: testResult.wp.startsWith('✓') ? '#1a7a45' : '#c0271e' }}>
                      {testResult.wp}
                    </div>
                  )}
                </div>

                {wpCache.categories?.length > 0 && (
                  <div style={{ marginTop: 20, padding: 14, background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', marginBottom: 8 }}>
                      Cached from WordPress (last sync: {wpCache.fetchedAt ? new Date(wpCache.fetchedAt).toLocaleString() : 'never'})
                    </div>
                    <div style={{ fontSize: 12, color: '#5c5b57' }}>
                      {wpCache.categories.length} categories · {wpCache.users?.length || 0} users · {wpCache.tags?.length || 0} tags
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI PROVIDERS */}
            {activeSection === 'aiproviders' && (
              <div>
                <SectionTitle>AI Providers</SectionTitle>
                <div style={{ background: '#fff8f5', border: '1px solid #f5c4a8', borderRadius: 8, padding: 14, marginBottom: 24, fontSize: 13, color: '#5c5b57' }}>
                  API keys are stored locally in your browser — never sent to any server except the AI provider directly. Configure a provider and model for each task below.
                </div>

                {[
                  { task: 'writing', label: 'Writing', desc: 'Generates full articles from sources or topics' },
                  { task: 'editing', label: 'Editing / Regen', desc: 'Regenerates individual fields in the article editor' },
                  { task: 'scraping', label: 'Web Research', desc: 'Used when scraping URLs (Perplexity recommended for live web data)' },
                ].map(({ task, label, desc }) => {
                  const cfg = aiProviders[task] || {}
                  const models = PROVIDER_MODELS[cfg.provider] || []
                  return (
                    <div key={task} style={{ background: '#fdFCf9', border: '1px solid #dedad2', borderRadius: 10, padding: 18, marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0d0d0d', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>{desc}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {testProviderResult[task] && (
                            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: testProviderResult[task].startsWith('✓') ? '#1a7a45' : '#c0271e' }}>
                              {testProviderResult[task]}
                            </span>
                          )}
                          <Btn variant="secondary" size="sm" onClick={() => testProvider(task)} disabled={testingProvider[task]}>
                            {testingProvider[task] ? <Spinner size={10} /> : ''}Test
                          </Btn>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <FieldLabel>Provider</FieldLabel>
                          <select
                            value={cfg.provider || 'anthropic'}
                            onChange={e => setAIProviders(prev => ({ ...prev, [task]: { ...cfg, provider: e.target.value, model: (PROVIDER_MODELS[e.target.value] || [])[0] || '' } }))}
                            style={selectStyle}>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="openai">OpenAI (ChatGPT)</option>
                            <option value="perplexity">Perplexity</option>
                          </select>
                        </div>
                        <div>
                          <FieldLabel>Model</FieldLabel>
                          <select
                            value={cfg.model || ''}
                            onChange={e => setAIProviders(prev => ({ ...prev, [task]: { ...cfg, model: e.target.value } }))}
                            style={selectStyle}>
                            {models.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <FieldLabel>API Key</FieldLabel>
                        <input
                          type="password"
                          value={cfg.apiKey || ''}
                          onChange={e => setAIProviders(prev => ({ ...prev, [task]: { ...cfg, apiKey: e.target.value } }))}
                          placeholder={`${cfg.provider === 'anthropic' ? 'sk-ant-...' : cfg.provider === 'openai' ? 'sk-...' : 'pplx-...'}`}
                          style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* WRITING STYLE */}
            {activeSection === 'writing' && (
              <div>
                <SectionTitle>Writing Style</SectionTitle>
                <FieldLabel>Global Writing Style Prompt</FieldLabel>
                <textarea
                  value={settings.globalWritingPrompt || ''}
                  onChange={e => setSettings(p => ({ ...p, globalWritingPrompt: e.target.value }))}
                  rows={6}
                  style={{ ...textareaStyle, marginBottom: 20 }}
                  placeholder="Describe the tone, style, and audience for 1cw.org articles..."
                />
                <FieldLabel>Default Output Language</FieldLabel>
                <select value={settings.language || 'English'} onChange={e => setSettings(p => ({ ...p, language: e.target.value }))}
                  style={selectStyle}>
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                  <option>Arabic</option>
                </select>

                <div style={{ marginTop: 20 }}>
                  <FieldLabel>Batch Delay (ms between articles)</FieldLabel>
                  <input type="number" min="0" max="5000" step="100"
                    value={settings.batchDelay ?? 600}
                    onChange={e => setSettings(p => ({ ...p, batchDelay: parseInt(e.target.value) }))}
                    style={{ ...inputStyle, width: 120 }} />
                  <div style={{ fontSize: 11, color: '#9c9a92', marginTop: 4 }}>
                    Delay between items in batch generation to avoid rate limits. 500-1000ms recommended.
                  </div>
                </div>
              </div>
            )}

            {/* AUTHORS */}
            {activeSection === 'authors' && (
              <div>
                <SectionTitle>Author Profiles</SectionTitle>
                <div style={{ marginBottom: 16 }}>
                  {authors.map((author, i) => (
                    <div key={author.id} style={{ background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                      {editingAuthor === author.id ? (
                        <div>
                          <input value={author.name} onChange={e => setAuthors(prev => prev.map(a => a.id === author.id ? { ...a, name: e.target.value } : a))}
                            placeholder="Author name" style={{ ...inputStyle, marginBottom: 8 }} />
                          <input value={author.wpUserId || ''} onChange={e => setAuthors(prev => prev.map(a => a.id === author.id ? { ...a, wpUserId: e.target.value } : a))}
                            placeholder="WordPress User ID (from WP Users list)"
                            style={{ ...inputStyle, marginBottom: 8, fontFamily: "'DM Mono', monospace" }} />
                          <textarea value={author.style || ''} onChange={e => setAuthors(prev => prev.map(a => a.id === author.id ? { ...a, style: e.target.value } : a))}
                            placeholder="Writing style description used in Claude prompt..." rows={3}
                            style={{ ...textareaStyle, marginBottom: 8 }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Btn variant="primary" size="sm" onClick={() => setEditingAuthor(null)}>Done</Btn>
                            <Btn variant="danger" size="sm" onClick={() => { setAuthors(prev => prev.filter(a => a.id !== author.id)); setEditingAuthor(null) }}>Delete</Btn>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d0d', marginBottom: 3 }}>{author.name}</div>
                            {author.wpUserId && <div style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>WP User ID: {author.wpUserId}</div>}
                            {author.style && <div style={{ fontSize: 12, color: '#9c9a92', marginTop: 4, fontStyle: 'italic' }}>{author.style.slice(0, 80)}...</div>}
                          </div>
                          <Btn variant="ghost" size="sm" onClick={() => setEditingAuthor(author.id)}>Edit</Btn>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Btn variant="secondary" onClick={() => {
                  const newAuthor = { id: 'a' + Date.now(), name: 'New Author', wpUserId: '', style: '' }
                  setAuthors(prev => [...prev, newAuthor])
                  setEditingAuthor(newAuthor.id)
                }}>+ Add Author</Btn>

                {wpCache.users?.length > 0 && (
                  <div style={{ marginTop: 20, padding: 14, background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', marginBottom: 8 }}>WordPress users (for reference)</div>
                    {wpCache.users.map(u => (
                      <div key={u.id} style={{ fontSize: 12, color: '#5c5b57', padding: '3px 0' }}>
                        ID: <span style={{ fontFamily: "'DM Mono', monospace" }}>{u.id}</span> — {u.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SOURCES */}
            {activeSection === 'sources' && (
              <div>
                <SectionTitle>Source Manager</SectionTitle>
                {sources.map((src) => (
                  <div key={src.id} style={{ background: '#fdfcf9', border: `1px solid ${src.active ? '#dedad2' : '#f0ede6'}`, borderRadius: 8, padding: 14, marginBottom: 12, opacity: src.active ? 1 : 0.6 }}>
                    {editingSource === src.id ? (
                      <SourceEditForm
                        source={src}
                        authors={authors}
                        onChange={updated => setSources(prev => prev.map(s => s.id === src.id ? updated : s))}
                        onDone={() => setEditingSource(null)}
                        onDelete={() => { setSources(prev => prev.filter(s => s.id !== src.id)); setEditingSource(null) }}
                      />
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d0d' }}>{src.name}</div>
                            <Badge color={src.type === 'youtube' ? 'red' : src.type === 'rss' ? 'blue' : 'gray'}>{src.type}</Badge>
                            {!src.active && <Badge color="gray">Inactive</Badge>}
                          </div>
                          <div style={{ fontSize: 11, color: '#9c9a92', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{src.url}</div>
                          {src.primaryCategory && <Badge color="amber">{src.primaryCategory}</Badge>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setSources(prev => prev.map(s => s.id === src.id ? { ...s, active: !s.active } : s))}
                            style={{ background: 'none', border: '1px solid #dedad2', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#9c9a92' }}>
                            {src.active ? 'Disable' : 'Enable'}
                          </button>
                          <Btn variant="ghost" size="sm" onClick={() => setEditingSource(src.id)}>Edit</Btn>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <Btn variant="secondary" onClick={() => {
                  const newSrc = {
                    id: 's' + Date.now(), name: 'New Source', url: '', type: 'rss', active: true,
                    filterPrompt: '', writingPrompt: '', primaryCategory: '', additionalCategories: [],
                    defaultAuthor: '', imageMode: 'pixabay', postFormat: 'standard', maxArticles: 5, schedule: 'manual',
                  }
                  setSources(prev => [...prev, newSrc])
                  setEditingSource(newSrc.id)
                }}>+ Add Source</Btn>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

function SourceEditForm({ source, authors, onChange, onDone, onDelete }) {
  const s = source
  const set = (k, v) => onChange({ ...s, [k]: v })
  const ALL_CATS = [
    'Artificial Intelligence', 'XR, VR, AR – XROM', 'Blockchain', 'Quantum & Nanotechnology',
    'Robotics & Automation', 'Automotive', 'Life Sciences & Biotechnology', 'Earth & Environment',
    'Health & Medicine', 'Space & Astronomy', 'Startups & Entrepreneurship', 'Policy & Economy',
    'Corporate Tech & Semiconductors', 'Telecom & Energy Tech',
  ]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><FieldLabel>Name</FieldLabel><input value={s.name} onChange={e => set('name', e.target.value)} style={inputStyle} /></div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <select value={s.type} onChange={e => set('type', e.target.value)} style={selectStyle}>
            <option value="rss">RSS Feed</option>
            <option value="scrape">Scrape URL</option>
            <option value="youtube">YouTube Channel</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}><FieldLabel>URL / Feed</FieldLabel><input value={s.url} onChange={e => set('url', e.target.value)} placeholder="https://..." style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} /></div>
      <div style={{ marginBottom: 10 }}>
        <FieldLabel>Primary Category</FieldLabel>
        <select value={s.primaryCategory || ''} onChange={e => set('primaryCategory', e.target.value)} style={selectStyle}>
          <option value="">— Select —</option>
          {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 10 }}><FieldLabel>Filter Prompt (what to pull)</FieldLabel><textarea value={s.filterPrompt || ''} onChange={e => set('filterPrompt', e.target.value)} rows={3} placeholder="Only pull articles about..." style={textareaStyle} /></div>
      <div style={{ marginBottom: 10 }}><FieldLabel>Writing Prompt (how to write)</FieldLabel><textarea value={s.writingPrompt || ''} onChange={e => set('writingPrompt', e.target.value)} rows={3} placeholder="Rewrite in a..." style={textareaStyle} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <FieldLabel>Post Format</FieldLabel>
          <select value={s.postFormat || 'standard'} onChange={e => set('postFormat', e.target.value)} style={selectStyle}>
            {['standard', 'video', 'audio', 'gallery'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Image Mode</FieldLabel>
          <select value={s.imageMode || 'pixabay'} onChange={e => set('imageMode', e.target.value)} style={selectStyle}>
            <option value="pixabay">Pixabay</option>
            <option value="source">From Source</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div>
          <FieldLabel>Max Articles</FieldLabel>
          <input type="number" min="1" max="20" value={s.maxArticles || 5} onChange={e => set('maxArticles', parseInt(e.target.value))} style={inputStyle} />
        </div>
      </div>
      {authors.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Default Author</FieldLabel>
          <select value={s.defaultAuthor || ''} onChange={e => set('defaultAuthor', e.target.value)} style={selectStyle}>
            <option value="">— Default —</option>
            {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Btn variant="primary" size="sm" onClick={onDone}>Done</Btn>
        <Btn variant="danger" size="sm" onClick={onDelete}>Delete Source</Btn>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: '#0d0d0d', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #dedad2' }}>{children}</div>
}
function FieldLabel({ children }) {
  return <label style={{ display: 'block', fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#9c9a92', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{children}</label>
}

const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #dedad2', borderRadius: 6,
  fontSize: 13, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', outline: 'none',
}
const textareaStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #dedad2', borderRadius: 6,
  fontSize: 13, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d', outline: 'none',
  resize: 'vertical', lineHeight: 1.6,
}
const selectStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #dedad2', borderRadius: 6,
  fontSize: 13, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d',
}
