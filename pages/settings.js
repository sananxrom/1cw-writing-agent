// pages/settings.js — matching design SettingsPage
import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { Topbar, Btn, I, Switch, TextInput, Textarea, InlineSelect, Segmented, Badge, Spinner, FieldLabel } from '../components/UI'
import { wpRequest } from '../lib/api'
import { storage, PROVIDER_MODELS, DEFAULT_SETTINGS } from '../lib/storage'

const TABS = [
  { id: 'sources',   label: 'Sources' },
  { id: 'wordpress', label: 'WordPress' },
  { id: 'models',    label: 'Models' },
  { id: 'prompts',   label: 'Prompts' },
  { id: 'authors',   label: 'Authors' },
  { id: 'schedule',  label: 'Schedule' },
]

const CATEGORIES = [
  '','Artificial Intelligence','XR, VR, AR – XROM','Blockchain','Quantum & Nanotechnology',
  'Robotics & Automation','Automotive','Life Sciences & Biotechnology','Earth & Environment',
  'Health & Medicine','Space & Astronomy','Startups & Entrepreneurship','Policy & Economy',
  'Corporate Tech & Semiconductors','Telecom & Energy Tech',
]

const POST_FORMATS = ['standard','video','audio','gallery','image','link','quote','status']

const DEFAULT_PROMPTS = {
  global: `You write for 1cw.org — a crisp, analytical news site covering AI, semiconductors, space, and emerging tech.\n\nVoice: direct, informed, never breathless. Lead with the news, then the why-it-matters. Avoid marketing copy, hype words ("revolutionary", "game-changing"), and content-mill tropes.\n\nStructure:\n- Open with a 1-2 sentence lede that states the news.\n- Give 2-3 paragraphs of context.\n- Close with forward-looking significance.\n\nAlways cite the original source at least once. Prefer specificity over generality: numbers, names, dates.`,
  article: `Given the source content, draft a 900-1200 word article.\n\nAlways:\n- Open with a tight lede that states what's new.\n- Embed the source link in-line near the top.\n- Use subheadings only when the piece runs past ~600 words.\n- End with a "what it means" paragraph tying this to the broader trend.`,
  title: `Rewrite the source headline as a 1cw.org title.\n\nRules:\n- 50-70 characters.\n- No clickbait, no emoji.\n- Front-load the subject.\n- Prefer verbs over gerunds.`,
  summary: `Write a 140-160 character summary of the article. No trailing period unless needed. Should work as both the WP excerpt and the meta description.`,
  image: `Write a single-sentence image prompt for the featured image.\n\nStyle: editorial, photoreal, neutral background, no text overlays, 16:9 aspect.`,
}

export default function Settings() {
  const [tab, setTab] = useState('sources')

  return (
    <Layout>
      <Topbar title="Settings" />
      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 32px', display: 'flex', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              height: 38, padding: '0 14px', background: 'transparent', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? 'var(--ink)' : 'var(--muted)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
            }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: 860 }}>
          {tab === 'sources' && <SourcesTab />}
          {tab === 'wordpress' && <WordPressTab />}
          {tab === 'models' && <ModelsTab />}
          {tab === 'prompts' && <PromptsTab />}
          {tab === 'authors' && <AuthorsTab />}
          {tab === 'schedule' && <ScheduleTab />}
        </div>
      </div>
    </Layout>
  )
}

// ── Sources ─────────────────────────────────────────────
function SourcesTab() {
  const [sources, setSources] = useState(storage.getSources)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  function save() {
    const updated = editing === 'new'
      ? [...sources, { ...form, id: 's' + Date.now(), active: true }]
      : sources.map(s => s.id === editing ? { ...s, ...form } : s)
    setSources(updated); storage.setSources(updated); setEditing(null)
  }
  function del(id) { const u = sources.filter(s => s.id !== id); setSources(u); storage.setSources(u) }
  function startEdit(src) { setForm({ ...src }); setEditing(src.id) }
  function startNew() { setForm({ name: '', url: '', type: 'rss', active: true, maxArticles: 10, primaryCategory: '' }); setEditing('new') }
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  if (editing) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Btn variant="ghost" size="sm" leftIcon={<I name="chevronLeft" size={13} />} onClick={() => setEditing(null)}>Back</Btn>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{editing === 'new' ? 'Add source' : `Edit: ${form.name}`}</div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><FieldLabel label="Name" /><TextInput value={form.name || ''} onChange={v => f('name', v)} placeholder="TechCrunch" /></div>
          <div><FieldLabel label="Type" />
            <InlineSelect value={form.type || 'rss'} onChange={v => f('type', v)} options={[{value:'rss',label:'RSS'},{value:'scrape',label:'Scrape'},{value:'youtube',label:'YouTube'}]} style={{ width: '100%' }} />
          </div>
        </div>
        <div><FieldLabel label={form.type === 'youtube' ? 'Channel URL' : 'Feed URL'} />
          <TextInput value={form.url || ''} onChange={v => f('url', v)} placeholder={form.type === 'rss' ? 'https://site.com/feed/' : form.type === 'youtube' ? 'https://www.youtube.com/@channel' : 'https://site.com/news'} mono />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><FieldLabel label="Primary category" />
            <InlineSelect value={form.primaryCategory || ''} onChange={v => f('primaryCategory', v)} options={CATEGORIES.map(c => ({ value: c, label: c || '— None —' }))} style={{ width: '100%' }} />
          </div>
          <div><FieldLabel label="Max articles per pull" />
            <TextInput value={String(form.maxArticles || 10)} onChange={v => f('maxArticles', parseInt(v) || 10)} mono />
          </div>
        </div>
        <div><FieldLabel label="Filter prompt" hint="What to include/exclude" />
          <Textarea value={form.filterPrompt || ''} onChange={v => f('filterPrompt', v)} rows={2} placeholder="Only pull articles about AI and semiconductors. Skip opinion pieces." />
        </div>
        <div><FieldLabel label="Writing prompt" hint="How to write articles from this source" />
          <Textarea value={form.writingPrompt || ''} onChange={v => f('writingPrompt', v)} rows={3} placeholder="Focus on practical implications. Lead with impact. Under 600 words." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><FieldLabel label="Post format" />
            <InlineSelect value={form.postFormat || 'standard'} onChange={v => f('postFormat', v)} options={POST_FORMATS.map(f => ({ value: f, label: f }))} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
            <Switch checked={!!form.active} onChange={v => f('active', v)} />
            <span style={{ fontSize: 13 }}>Active</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Btn variant="primary" onClick={save}>Save source</Btn>
          <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Content sources</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>RSS feeds, scraped sites, and YouTube channels the agent pulls from.</div>
        </div>
        <Btn variant="accent" leftIcon={<I name="plus" size={13} />} onClick={startNew}>Add source</Btn>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={tableHeader}>
          <span></span><span>Source</span><span>Type</span><span>Category</span><span>Max</span><span>Active</span>
        </div>
        {sources.map((s, i) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 100px 180px 60px 80px', gap: 12, padding: '11px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', alignItems: 'center', fontSize: 13, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
            onClick={() => startEdit(s)}>
            <I name={s.type === 'rss' ? 'rss' : s.type === 'youtube' ? 'youtube' : 'globe'} size={14} color={s.active ? 'var(--accent)' : 'var(--muted-2)'} />
            <span style={{ fontWeight: 500 }}>{s.name}</span>
            <Badge tone="mono" size="sm">{s.type}</Badge>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.primaryCategory || '—'}</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{s.maxArticles || 10}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
              <Switch checked={!!s.active} onChange={v => { const u = sources.map(x => x.id === s.id ? {...x, active: v} : x); setSources(u); storage.setSources(u) }} />
              <Btn variant="ghost" size="xs" onClick={e => { e.stopPropagation(); if (confirm('Delete ' + s.name + '?')) del(s.id) }}><I name="trash" size={12} color="var(--danger)" /></Btn>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── WordPress ────────────────────────────────────────────
function WordPressTab() {
  const [wpUrl, setWpUrl] = useState(process.env.NEXT_PUBLIC_WP_URL || '')
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState(null)
  const [syncMsg, setSyncMsg] = useState('')

  async function testConnection() {
    setTesting(true); setStatus(null)
    try {
      const r = await fetch('/api/wordpress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: 'users/me', method: 'GET' }) })
      const d = await r.json()
      if (r.ok) setStatus({ ok: true, msg: `Connected as ${d.name} (${d.roles?.join(', ')})` })
      else setStatus({ ok: false, msg: d.error || 'Connection failed' })
    } catch (err) { setStatus({ ok: false, msg: err.message }) }
    setTesting(false)
  }

  async function syncWPData() {
    setSyncMsg('Syncing…')
    try {
      const [cats, tags, users] = await Promise.all([
        fetch('/api/wordpress', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: 'categories?per_page=100', method: 'GET' }) }).then(r => r.json()),
        fetch('/api/wordpress', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: 'tags?per_page=100', method: 'GET' }) }).then(r => r.json()),
        fetch('/api/wordpress', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: 'users?per_page=50', method: 'GET' }) }).then(r => r.json()),
      ])
      storage.setWPCache({ categories: Array.isArray(cats) ? cats : [], tags: Array.isArray(tags) ? tags : [], users: Array.isArray(users) ? users : [] })
      setSyncMsg(`Synced: ${Array.isArray(cats) ? cats.length : 0} categories, ${Array.isArray(tags) ? tags.length : 0} tags, ${Array.isArray(users) ? users.length : 0} users`)
    } catch (err) { setSyncMsg('Sync failed: ' + err.message) }
    setTimeout(() => setSyncMsg(''), 4000)
  }

  const cache = storage.getWPCache()

  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>WordPress connection</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>The agent publishes via the WP REST API using application passwords. Set credentials in Vercel environment variables.</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
        {status && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: status.ok ? 'var(--success-soft)' : 'var(--danger-soft)', border: `1px solid ${status.ok ? '#bbf7d0' : '#fecaca'}`, borderRadius: 6, marginBottom: 20 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: status.ok ? 'var(--success)' : 'var(--danger)' }} />
            <span style={{ fontSize: 13, color: status.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>{status.msg}</span>
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 6, marginBottom: 20 }}>
          Set <code>WP_URL</code>, <code>WP_USER</code>, and <code>WP_PASSWORD</code> (application password) in Vercel → Project → Environment Variables.
        </div>
        {cache.fetchedAt > 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Cache: {cache.categories?.length || 0} categories · {cache.tags?.length || 0} tags · {cache.users?.length || 0} users
            <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 11 }}>
              (synced {new Date(cache.fetchedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
            </span>
          </div>
        )}
        {syncMsg && <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)', marginBottom: 12 }}>{syncMsg}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={testConnection} disabled={testing}>{testing ? <><Spinner size={12} /> Testing…</> : 'Test connection'}</Btn>
          <Btn variant="primary" onClick={syncWPData}>Sync categories & tags</Btn>
        </div>
      </div>
    </>
  )
}

// ── Models ───────────────────────────────────────────────
function ModelsTab() {
  const [providers, setProviders] = useState(storage.getAIProviders)
  const [testing, setTesting] = useState({})
  const [testResult, setTestResult] = useState({})

  const SLOTS = [
    { id: 'writing', label: 'Writing', desc: 'Main model that drafts each article from extracted facts.' },
    { id: 'editing', label: 'Editing / SEO', desc: 'Extracts facts from source, generates SEO metadata and taxonomy.' },
    { id: 'scraping', label: 'Web Research', desc: 'Reads source pages. Use Perplexity for live web search.' },
  ]

  const PROVIDER_OPTIONS = [
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai',    label: 'OpenAI' },
    { value: 'perplexity',label: 'Perplexity' },
  ]

  function update(slot, patch) {
    const next = { ...providers, [slot]: { ...providers[slot], ...patch } }
    if (patch.provider) next[slot].model = (PROVIDER_MODELS[patch.provider] || [])[0] || ''
    setProviders(next); storage.setAIProviders(next)
  }

  async function testProvider(slot) {
    const p = providers[slot]
    if (!p?.apiKey) { setTestResult(r => ({ ...r, [slot]: { ok: false, msg: 'No API key' } })); return }
    setTesting(t => ({ ...t, [slot]: true }))
    try {
      const headers = { 'Content-Type': 'application/json' }
      let body, url
      if (p.provider === 'anthropic') {
        url = 'https://api.anthropic.com/v1/messages'
        headers['x-api-key'] = p.apiKey; headers['anthropic-version'] = '2023-06-01'
        body = JSON.stringify({ model: p.model || 'claude-haiku-4-5', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] })
      } else {
        url = p.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.perplexity.ai/chat/completions'
        headers['Authorization'] = `Bearer ${p.apiKey}`
        body = JSON.stringify({ model: p.model, max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] })
      }
      const r = await fetch(url, { method: 'POST', headers, body })
      setTestResult(res => ({ ...res, [slot]: r.ok ? { ok: true, msg: '✓ Connected' } : { ok: false, msg: `Error ${r.status}` } }))
    } catch (err) { setTestResult(res => ({ ...res, [slot]: { ok: false, msg: err.message } })) }
    setTesting(t => ({ ...t, [slot]: false }))
  }

  const estimatedCost = '$0.08–0.18 / article'

  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Models</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Configure each provider slot. Writing uses the most tokens — use a capable model. Editing is cheaper calls.</div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={tableHeader2}><span>Slot</span><span>Provider</span><span>Model</span><span>API Key</span><span></span></div>
        {SLOTS.map((slot, i) => {
          const p = providers[slot.id] || {}
          const models = (PROVIDER_MODELS[p.provider] || []).map(m => ({ value: m, label: m }))
          const res = testResult[slot.id]
          return (
            <div key={slot.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 220px 1fr 80px', gap: 12, padding: '14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{slot.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{slot.desc}</div>
                {res && <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: res.ok ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>{res.msg}</div>}
              </div>
              <InlineSelect size="sm" value={p.provider || 'anthropic'} onChange={v => update(slot.id, { provider: v })} options={PROVIDER_OPTIONS} style={{ width: '100%' }} />
              <InlineSelect size="sm" value={p.model || ''} onChange={v => update(slot.id, { model: v })} options={models.length ? models : [{ value: '', label: 'Select model' }]} style={{ width: '100%' }} />
              <TextInput size="sm" type="password" value={p.apiKey || ''} onChange={v => update(slot.id, { apiKey: v })} placeholder={p.provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'} mono />
              <Btn variant="secondary" size="sm" onClick={() => testProvider(slot.id)} disabled={testing[slot.id]}>
                {testing[slot.id] ? <Spinner size={10} /> : 'Test'}
              </Btn>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Estimated cost: <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)', fontWeight: 500 }}>{estimatedCost}</span>
        </div>
        <div>
          <Btn variant="secondary" size="sm" onClick={() => { const def = storage.getAIProviders(); setProviders(def) }}>Reset to defaults</Btn>
        </div>
      </div>
    </>
  )
}

// ── Prompts ──────────────────────────────────────────────
function PromptsTab() {
  const PROMPT_LIST = [
    { id: 'global',   label: 'Global style',         desc: 'Applied as a system directive to every generation.' },
    { id: 'article',  label: 'Article generation',   desc: 'Drives the full draft — structure, tone, length.' },
    { id: 'title',    label: 'Title rewriting',      desc: 'Rewrites source headlines in 1cw voice.' },
    { id: 'summary',  label: 'Summary / meta',       desc: 'Generates the excerpt and SEO description.' },
    { id: 'image',    label: 'Featured image prompt',desc: 'Writes the prompt for the art model.' },
  ]
  const [active, setActive] = useState('global')
  const [drafts, setDrafts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('1cw_prompts') || '{}') } catch { return {} }
  })
  const get = id => drafts[id] ?? DEFAULT_PROMPTS[id] ?? ''
  const set = (id, v) => {
    const next = { ...drafts, [id]: v }; setDrafts(next)
    localStorage.setItem('1cw_prompts', JSON.stringify(next))
  }
  const current = get(active)

  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Prompts</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Per-stage prompts the agent sends to the model.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
          {PROMPT_LIST.map((p, i) => (
            <button key={p.id} onClick={() => setActive(p.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: active === p.id ? 'var(--accent-soft)' : 'transparent', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: active === p.id ? 'var(--accent)' : 'var(--ink)' }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{PROMPT_LIST.find(p => p.id === active)?.label}</div>
            <Btn variant="ghost" size="sm" onClick={() => set(active, DEFAULT_PROMPTS[active] || '')}>Revert</Btn>
          </div>
          <Textarea value={current} onChange={v => set(active, v)} rows={14} mono />
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', marginTop: 8 }}>
            {current.length} chars · ~{Math.ceil(current.length / 4)} tokens
          </div>
        </div>
      </div>
    </>
  )
}

// ── Authors ──────────────────────────────────────────────
function AuthorsTab() {
  const [authors, setAuthors] = useState(storage.getAuthors)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  function save() {
    const u = editing === 'new' ? [...authors, { ...form, id: 'a' + Date.now() }] : authors.map(a => a.id === editing ? { ...a, ...form } : a)
    setAuthors(u); storage.setAuthors(u); setEditing(null)
  }

  const wpCache = storage.getWPCache()
  const wpUsers = wpCache.users || []

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Authors</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bylines with per-author writing style overrides.</div>
        </div>
        <Btn variant="accent" leftIcon={<I name="plus" size={13} />} onClick={() => { setForm({ name: '', style: '', wpUserId: '' }); setEditing('new') }}>Add author</Btn>
      </div>
      {editing && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div><FieldLabel label="Name" /><TextInput value={form.name || ''} onChange={v => setForm(p => ({ ...p, name: v }))} /></div>
            <div><FieldLabel label="WP User" />
              <InlineSelect value={String(form.wpUserId || '')} onChange={v => setForm(p => ({ ...p, wpUserId: parseInt(v) || v }))}
                options={[{ value: '', label: '— Select —' }, ...wpUsers.map(u => ({ value: String(u.id), label: u.name }))]} style={{ width: '100%' }} />
            </div>
          </div>
          <div><FieldLabel label="Writing style" hint="Brief voice description" />
            <Textarea value={form.style || ''} onChange={v => setForm(p => ({ ...p, style: v }))} rows={2} placeholder="More analytical, longer-form, academic citations preferred" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Btn variant="primary" onClick={save}>Save</Btn>
            <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </div>
      )}
      {authors.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 }}>
            {a.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.style || 'Default style'}{a.wpUserId ? ` · WP #${a.wpUserId}` : ''}</div>
          </div>
          <Btn variant="ghost" size="sm" onClick={() => { setForm({ ...a }); setEditing(a.id) }}><I name="edit" size={12} /></Btn>
          <Btn variant="ghost" size="sm" onClick={() => { const u = authors.filter(x => x.id !== a.id); setAuthors(u); storage.setAuthors(u) }}><I name="trash" size={12} color="var(--danger)" /></Btn>
        </div>
      ))}
    </>
  )
}

// ── Schedule ─────────────────────────────────────────────
function ScheduleTab() {
  const [settings, setSettings] = useState(storage.getSettings)
  const u = (k, v) => { const n = { ...settings, [k]: v }; setSettings(n); storage.setSettings(n) }

  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Automation schedule</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Let the agent pull, generate, and publish on its own.</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
        {[
          { key: 'autoPull', label: 'Auto-pull sources', desc: 'Fetch new articles from active sources automatically.', hasInterval: true, intervalKey: 'pullInterval', intervalOpts: ['30m','1h','2h','4h'] },
          { key: 'autoGenerate', label: 'Auto-generate articles', desc: 'Rewrite new pulled articles without manual selection. Off by default.' },
          { key: 'autoPublish', label: 'Auto-publish', desc: 'Push generated articles to WordPress.', hasInterval: true, intervalKey: 'publishStatus', intervalOpts: [{value:'draft',label:'As draft'},{value:'publish',label:'Publish live'}] },
        ].map((item, i, arr) => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: i < arr.length - 1 ? 16 : 0, marginBottom: i < arr.length - 1 ? 16 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <Switch checked={!!settings[item.key]} onChange={v => u(item.key, v)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.desc}</div>
            </div>
            {item.hasInterval && settings[item.key] && (
              <InlineSelect size="sm" value={settings[item.intervalKey] || item.intervalOpts[0]?.value || item.intervalOpts[0]}
                onChange={v => u(item.intervalKey, v)}
                options={(item.intervalOpts || []).map(o => typeof o === 'string' ? { value: o, label: o } : o)} />
            )}
          </div>
        ))}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Writing defaults</div>
          <FieldLabel label="Global writing prompt" />
          <Textarea value={settings.globalWritingPrompt || ''} onChange={v => u('globalWritingPrompt', v)} rows={4} />
          <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel label="Batch delay (ms)" hint="Between articles in bulk generate" />
              <TextInput value={String(settings.batchDelay ?? 600)} onChange={v => u('batchDelay', parseInt(v) || 600)} mono />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel label="Output language" />
              <InlineSelect value={settings.language || 'English'} onChange={v => u('language', v)}
                options={['English','Hindi','Spanish','French','German','Arabic'].map(l => ({ value: l, label: l }))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const tableHeader = { display: 'grid', gridTemplateColumns: '24px 1fr 100px 180px 60px 80px', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }
const tableHeader2 = { display: 'grid', gridTemplateColumns: '1fr 130px 220px 1fr 80px', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }
