// lib/storage.js
const KEYS = {
  SETTINGS: '1cw_settings',
  SOURCES: '1cw_sources',
  AUTHORS: '1cw_authors',
  HISTORY: '1cw_history',
  SEEN_URLS: '1cw_seen_urls',
  WP_CACHE: '1cw_wp_cache',
  AI_PROVIDERS: '1cw_ai_providers',
}

export const DEFAULT_SOURCES = [
  {
    id: 's1', name: 'XR Today', url: 'https://xrtoday.com/feed/', type: 'rss', active: true,
    filterPrompt: 'Pull XR, VR, AR hardware launches, enterprise use cases, and platform updates. Skip gaming-only coverage and opinion pieces.',
    writingPrompt: 'Focus on practical implications for businesses and developers. Who uses this and why it matters.',
    primaryCategory: 'XR, VR, AR – XROM', additionalCategories: [],
    defaultAuthor: '', imageMode: 'pixabay', postFormat: 'standard', maxArticles: 5, schedule: 'daily',
  },
  {
    id: 's2', name: 'New Atlas', url: 'https://newatlas.com/index.rss', type: 'rss', active: true,
    filterPrompt: 'Pull science, technology, and innovation stories. Skip lifestyle, travel, food, and consumer product reviews.',
    writingPrompt: 'Make complex science accessible without dumbing it down. Explain the breakthrough and its real-world significance.',
    primaryCategory: 'Earth & Environment', additionalCategories: [],
    defaultAuthor: '', imageMode: 'pixabay', postFormat: 'standard', maxArticles: 5, schedule: 'daily',
  },
  {
    id: 's3', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'rss', active: true,
    filterPrompt: 'Only AI, semiconductor, robotics, deep tech, and enterprise software. Skip social media gossip, consumer apps, and funding rounds under $50M.',
    writingPrompt: 'Lead with the headline impact. Keep it sharp and analytical. Under 600 words.',
    primaryCategory: 'Artificial Intelligence', additionalCategories: [],
    defaultAuthor: '', imageMode: 'pixabay', postFormat: 'standard', maxArticles: 5, schedule: 'daily',
  },
  {
    id: 's4', name: '1CW Podcast', url: 'https://www.youtube.com/@1CWpodcast', type: 'youtube', active: true,
    filterPrompt: 'Convert latest podcast episode transcript to article.',
    writingPrompt: "Convert transcript to a structured article. Add section headings, remove filler words, preserve the speaker's voice and key arguments.",
    primaryCategory: 'Artificial Intelligence', additionalCategories: [],
    defaultAuthor: '', imageMode: 'source', postFormat: 'video', maxArticles: 1, schedule: 'manual',
  },
]

export const DEFAULT_AI_PROVIDERS = {
  writing: { provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: '' },
  scraping: { provider: 'perplexity', model: 'llama-3.1-sonar-large-128k-online', apiKey: '' },
  editing: { provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: '' },
}

export const PROVIDER_MODELS = {
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
  perplexity: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-huge-128k-online'],
}

export const DEFAULT_SETTINGS = {
  globalWritingPrompt: 'Write in a clear, authoritative tone for a tech-savvy but non-expert audience. Lead with what matters. Avoid jargon without explanation. Keep articles between 500-800 words unless the topic demands more.',
  language: 'English',
  seoPlugin: 'rankmath',
}

function safeGet(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

function safeSet(key, value) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export const storage = {
  getSettings: () => safeGet(KEYS.SETTINGS, DEFAULT_SETTINGS),
  setSettings: (v) => safeSet(KEYS.SETTINGS, v),

  getSources: () => safeGet(KEYS.SOURCES, DEFAULT_SOURCES),
  setSources: (v) => safeSet(KEYS.SOURCES, v),

  getAuthors: () => safeGet(KEYS.AUTHORS, []),
  setAuthors: (v) => safeSet(KEYS.AUTHORS, v),

  getHistory: () => safeGet(KEYS.HISTORY, []),
  addHistory: (item) => {
    const h = safeGet(KEYS.HISTORY, [])
    h.unshift({ ...item, timestamp: Date.now() })
    safeSet(KEYS.HISTORY, h.slice(0, 200)) // keep last 200
  },

  getSeenUrls: () => new Set(safeGet(KEYS.SEEN_URLS, [])),
  addSeenUrl: (url) => {
    const s = safeGet(KEYS.SEEN_URLS, [])
    if (!s.includes(url)) {
      s.unshift(url)
      safeSet(KEYS.SEEN_URLS, s.slice(0, 1000))
    }
  },
  isUrlSeen: (url) => safeGet(KEYS.SEEN_URLS, []).includes(url),

  getWPCache: () => safeGet(KEYS.WP_CACHE, { categories: [], tags: [], users: [], fetchedAt: 0 }),
  setWPCache: (v) => safeSet(KEYS.WP_CACHE, { ...v, fetchedAt: Date.now() }),

  getAIProviders: () => safeGet(KEYS.AI_PROVIDERS, DEFAULT_AI_PROVIDERS),
  setAIProviders: (v) => safeSet(KEYS.AI_PROVIDERS, v),
}
