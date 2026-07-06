// lib/storage.js
// Shared data (sources, authors, settings, generated) → DB via /api/data
// Sensitive data (AI keys, WP profile) → localStorage only

export const DEFAULT_SOURCES = [
  {
    id: 's1', name: 'XR Today', url: 'https://xrtoday.com/feed/', type: 'rss', active: true,
    filterPrompt: 'Pull XR, VR, AR hardware launches, enterprise use cases, and platform updates. Skip gaming-only coverage.',
    writingPrompt: 'Focus on practical implications for businesses and developers.',
    primaryCategory: 'XR, VR, AR – XROM', additionalCategories: [],
    defaultAuthor: '', imageMode: 'pixabay', postFormat: 'standard', maxArticles: 5, schedule: 'daily',
  },
  {
    id: 's2', name: 'New Atlas', url: 'https://newatlas.com/index.rss', type: 'rss', active: true,
    filterPrompt: 'Pull science, technology, and innovation stories. Skip lifestyle and consumer reviews.',
    writingPrompt: 'Make complex science accessible. Explain the breakthrough and its significance.',
    primaryCategory: 'Earth & Environment', additionalCategories: [],
    defaultAuthor: '', imageMode: 'pixabay', postFormat: 'standard', maxArticles: 5, schedule: 'daily',
  },
  {
    id: 's3', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'rss', active: true,
    filterPrompt: 'Only AI, semiconductor, robotics, deep tech. Skip social media gossip and small funding rounds.',
    writingPrompt: 'Lead with the headline impact. Sharp and analytical. Under 600 words.',
    primaryCategory: 'Artificial Intelligence', additionalCategories: [],
    defaultAuthor: '', imageMode: 'pixabay', postFormat: 'standard', maxArticles: 5, schedule: 'daily',
  },
  {
    id: 's4', name: '1CW Podcast', url: 'https://www.youtube.com/@1CWpodcast', type: 'youtube', active: true,
    filterPrompt: 'Convert latest podcast episode transcript to article.',
    writingPrompt: "Convert transcript to structured article. Add headings, remove filler, preserve voice.",
    primaryCategory: 'Artificial Intelligence', additionalCategories: [],
    defaultAuthor: '', imageMode: 'source', postFormat: 'video', maxArticles: 1, schedule: 'manual',
  },
]

export const DEFAULT_AI_PROVIDERS = {
  writing: { provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: '' },
  scraping: { provider: 'perplexity', model: 'llama-3.1-sonar-large-128k-online', apiKey: '' },
  editing: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', apiKey: '' },
}

export const PROVIDER_MODELS = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
  perplexity: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'],
  qwen: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  ollama: ['llama3', 'mistral', 'gemma2', 'qwen2.5'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
}

export const DEFAULT_SETTINGS = {
  globalWritingPrompt: 'Write in a clear, authoritative tone for a tech-savvy but non-expert audience. Lead with what matters. 500-800 words.',
  language: 'English',
  seoPlugin: 'rankmath',
  batchDelay: 600,
}

// ── localStorage helpers (sensitive / per-device only) ────
function safeGet(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function safeSet(key, value) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ── DB helpers (shared data) ──────────────────────────────
async function dbGet(resource) {
  const r = await fetch(`/api/data?resource=${resource}`)
  if (!r.ok) throw new Error(`DB get ${resource} failed`)
  return r.json()
}
async function dbPut(resource, body) {
  const r = await fetch(`/api/data?resource=${resource}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`DB put ${resource} failed`)
  return r.json()
}
async function dbDelete(resource, body) {
  const r = await fetch(`/api/data?resource=${resource}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`DB delete ${resource} failed`)
  return r.json()
}

// ── storage API ───────────────────────────────────────────
export const storage = {
  // SHARED — DB backed
  async getSources() {
    try { return await dbGet('sources') } catch { return [] }  // empty = user must add sources
  },
  async saveSource(src) { return dbPut('sources', src) },
  async deleteSource(id) { return dbDelete('sources', { id }) },

  async getAuthors() {
    try { return await dbGet('authors') } catch { return [] }
  },
  async saveAuthor(author) { return dbPut('authors', author) },
  async deleteAuthor(id) { return dbDelete('authors', { id }) },

  async getSettings() {
    try {
      const s = await dbGet('settings')
      return { ...DEFAULT_SETTINGS, ...s.globalSettings }
    } catch { return DEFAULT_SETTINGS }
  },
  async saveSettings(settings) { return dbPut('settings', { key: 'globalSettings', value: settings }) },

  async getGeneratedQueue() {
    try { return await dbGet('generated') } catch { return [] }
  },
  async saveGenerated(item) { return dbPut('generated', item) },
  async deleteGenerated(ids) { return dbDelete('generated', { ids }) },
  async clearPublishedFromQueue() { return dbDelete('generated', { clearPublished: true }) },

  // LOCAL ONLY — sensitive / per-device
  getAIProviders: () => safeGet('1cw_ai_providers', DEFAULT_AI_PROVIDERS),
  setAIProviders: (v) => safeSet('1cw_ai_providers', v),

  getWPCache: () => safeGet('1cw_wp_cache', { categories: [], tags: [], users: [], fetchedAt: 0 }),
  setWPCache: (v) => safeSet('1cw_wp_cache', { ...v, fetchedAt: Date.now() }),

  // Profile (which WP user slot to use)
  getProfile: () => safeGet('1cw_profile', { slot: '1' }), // slot '1' or '2'
  setProfile: (v) => safeSet('1cw_profile', v),

  // Seen URLs — local dedup cache (also in DB but this is fast path)
  getSeenUrls: () => new Set(safeGet('1cw_seen_urls', [])),
  addSeenUrl: (url) => {
    const s = safeGet('1cw_seen_urls', [])
    if (!s.includes(url)) { s.unshift(url); safeSet('1cw_seen_urls', s.slice(0, 1000)) }
  },
  isUrlSeen: (url) => safeGet('1cw_seen_urls', []).includes(url),

  // History (legacy local — DB articles table is source of truth)
  getHistory: () => safeGet('1cw_history', []),
  addHistory: (item) => {
    const h = safeGet('1cw_history', [])
    h.unshift({ ...item, timestamp: Date.now() })
    safeSet('1cw_history', h.slice(0, 200))
  },
}

// ── Migration: localStorage → DB (runs once on first load) ──
export async function migrateLocalToDb() {
  if (typeof window === 'undefined') return
  const migrated = localStorage.getItem('1cw_db_migrated')
  if (migrated) return

  try {
    // Migrate sources
    const localSources = (() => {
      try { const v = localStorage.getItem('1cw_sources'); return v ? JSON.parse(v) : null } catch { return null }
    })()
    if (localSources?.length) {
      const dbSources = await dbGet('sources').catch(() => [])
      if (!dbSources.length) {
        for (const src of localSources) await dbPut('sources', src).catch(() => {})
        console.log('[migration] Sources migrated to DB:', localSources.length)
      }
    }

    // Migrate authors
    const localAuthors = (() => {
      try { const v = localStorage.getItem('1cw_authors'); return v ? JSON.parse(v) : null } catch { return null }
    })()
    if (localAuthors?.length) {
      const dbAuthors = await dbGet('authors').catch(() => [])
      if (!dbAuthors.length) {
        for (const a of localAuthors) await dbPut('authors', a).catch(() => {})
        console.log('[migration] Authors migrated to DB:', localAuthors.length)
      }
    }

    // Migrate settings
    const localSettings = (() => {
      try { const v = localStorage.getItem('1cw_settings'); return v ? JSON.parse(v) : null } catch { return null }
    })()
    if (localSettings) {
      await dbPut('settings', { key: 'globalSettings', value: localSettings }).catch(() => {})
      console.log('[migration] Settings migrated to DB')
    }

    localStorage.setItem('1cw_db_migrated', '1')
  } catch (err) {
    console.warn('[migration] Failed:', err.message)
  }
}
