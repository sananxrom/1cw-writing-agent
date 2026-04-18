// lib/api.js
// Frontend helpers — all external API calls proxied through Vercel serverless functions

// ── WordPress ──────────────────────────────────────────────
export async function wpRequest(endpoint, method = 'GET', body = null) {
  const res = await fetch('/api/wordpress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, method, body }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'WordPress request failed')
  return data
}

// ── RSS (legacy, still used for direct fetch) ──────────────
export async function fetchRSS(url) {
  const res = await fetch('/api/rss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'RSS fetch failed')
  return data
}

// ── Scrape ─────────────────────────────────────────────────
export async function scrapeArticle(url) {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Scrape failed')
  return data
}

// ── Pull source (DB-backed, handles RSS + scrape) ──────────
export async function pullSource({ source, dateRange = 'all', refresh = false }) {
  const res = await fetch('/api/pull-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, dateRange, refresh }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Pull failed')
  return data
}

export async function deletePulledFromDB(urls) {
  const res = await fetch('/api/pull-source', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Delete failed')
  return data
}

export async function updatePulledStatusDB(urls, status) {
  const res = await fetch('/api/pull-source', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, status }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Update failed')
  return data
}

// ── Generate ───────────────────────────────────────────────
// Reads provider config from localStorage and injects into request
function getProviderConfigs() {
  if (typeof window === 'undefined') return {}
  try {
    const providers = JSON.parse(localStorage.getItem('1cw_ai_providers') || '{}')
    return {
      writingProvider: providers.writing?.apiKey ? providers.writing : null,
      editingProvider: providers.editing?.apiKey ? providers.editing : null,
    }
  } catch { return {} }
}

export async function generateArticle(params, { batchIndex = 0, batchDelay = 0 } = {}) {
  const { writingProvider, editingProvider } = getProviderConfigs()
  const wp = writingProvider || {}
  const ep = editingProvider || writingProvider || {}

  const base = {
    provider: wp.provider || 'anthropic',
    model: wp.model,
    apiKey: wp.apiKey || null,
  }
  const epBase = {
    provider: ep.provider || 'anthropic',
    model: ep.model,
    apiKey: ep.apiKey || null,
  }

  // Stage 1 — Extract (editing provider, fast)
  const r1 = await fetch('/api/generate-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, ...epBase }),
  })
  let extracted
  try { extracted = await r1.json() } catch { throw new Error('Extract stage: server returned non-JSON (possible timeout). Try again.') }
  if (!r1.ok) throw new Error(extracted.error || 'Extract failed')

  // Stage 2 — Write (writing provider)
  const r2 = await fetch('/api/generate-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extracted,
      title: params.title,
      sourceUrl: params.sourceUrl,
      sourceName: params.sourceName,
      primaryCategory: params.primaryCategory || extracted.suggested_category,
      writingPrompt: params.writingPrompt,
      authorStyle: params.authorStyle,
      postFormat: params.postFormat,
      mode: params.mode,
      ...base,
    }),
  })
  let written
  try { written = await r2.json() } catch { throw new Error('Write stage: server returned non-JSON (possible timeout). Try again.') }
  if (!r2.ok) throw new Error(written.error || 'Write failed')

  // Stage 3 — SEO (editing provider, fast)
  const r3 = await fetch('/api/generate-seo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: written.title,
      body: written.body,
      excerpt: written.excerpt,
      primaryCategory: params.primaryCategory || extracted.suggested_category,
      extracted,
      ...epBase,
    }),
  })
  let seo
  try { seo = await r3.json() } catch { throw new Error('SEO stage: server returned non-JSON (possible timeout). Try again.') }
  if (!r3.ok) throw new Error(seo.error || 'SEO failed')

  const wordCount = (written.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length

  return {
    ...written,
    ...seo,
    wordCount,
    sourceUrl: params.sourceUrl || '',
    sourceName: params.sourceName || '',
    _extracted: extracted,
  }
}

// ── Pixabay ────────────────────────────────────────────────
export async function searchPixabay(query) {
  const res = await fetch('/api/pixabay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Pixabay search failed')
  return data
}

// ── Image upload ───────────────────────────────────────────
export async function uploadImageToWP(imageUrl, filename, altText, caption) {
  const res = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, filename, altText, caption }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Image upload failed')
  return data
}

// ── YouTube ────────────────────────────────────────────────
export async function getYouTubeChannel(handle) {
  const res = await fetch('/api/youtube-channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'YouTube channel fetch failed')
  return data
}

export async function getTranscript(videoId, channelId) {
  const res = await fetch('/api/transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, channelId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Transcript fetch failed')
  return data
}

// ── DB history ─────────────────────────────────────────────
export async function fetchDbHistory({ limit = 50, offset = 0 } = {}) {
  const res = await fetch(`/api/history-db?limit=${limit}&offset=${offset}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'History fetch failed')
  return data
}

// ── WordPress save ─────────────────────────────────────────
export async function saveToWordPress(article, wpMeta) {
  const { categoryIds, tagIds, authorId, featuredImageId } = wpMeta

  const postBody = {
    title: article.title,
    content: article.body,
    excerpt: article.excerpt,
    status: article.status || 'draft',
    slug: article.slug,
    author: authorId,
    categories: categoryIds,
    tags: tagIds,
    format: article.postFormat || 'standard',
    meta: {
      rank_math_title: article.seoTitle,
      rank_math_description: article.metaDescription,
      rank_math_focus_keyword: article.focusKeyword,
      ruby_tagline: article.tagline,
      foxiz_content_total_word: String(article.wordCount || 0),
      foxiz_video_url: article.videoUrl || '',
      foxiz_audio_url: article.audioUrl || '',
      foxiz_toc: article.enableToc ? '1' : '0',
      foxiz_sponsored: article.sponsored ? '1' : '0',
      foxiz_sponsored_label: article.sponsoredLabel || '',
      foxiz_hide_ads: article.hideAds ? '1' : '0',
      foxiz_hide_featured: article.hideFeatured ? '1' : '0',
      foxiz_inline_related: article.inlineRelated ? '1' : '0',
      foxiz_single_layout: article.singleLayout || '',
      foxiz_review_score: article.reviewScore ? String(article.reviewScore) : '',
      _source_url: article.sourceUrl || '',
      _source_name: article.sourceName || '',
    },
  }

  if (featuredImageId) postBody.featured_media = featuredImageId

  const endpoint = article.wpPostId ? `posts/${article.wpPostId}` : 'posts'
  const method = article.wpPostId ? 'PUT' : 'POST'
  const post = await wpRequest(endpoint, method, postBody)

  // Try to set ruby_tagline via separate meta update (requires meta to be registered in WP)
  if (article.tagline && post.id) {
    try {
      await wpRequest(`posts/${post.id}`, 'POST', {
        meta: { ruby_tagline: article.tagline }
      })
    } catch {}
  }

  return post
}

// ── Resolve categories/tags ────────────────────────────────
export async function resolveCategoryIds(categoryNames, allCategories) {
  const ids = []
  for (const name of categoryNames) {
    if (!name) continue
    // Exact match first
    let found = allCategories.find(c => c.name.toLowerCase() === name.toLowerCase())
    // Partial match fallback
    if (!found) found = allCategories.find(c =>
      c.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(c.name.toLowerCase())
    )
    if (found) {
      ids.push(found.id)
    } else {
      // Auto-create missing category
      try {
        const created = await wpRequest("categories", "POST", { name })
        ids.push(created.id)
      } catch {}
    }
  }
  return ids
}

export async function resolveTagIds(tagNames, allTags) {
  const ids = []
  for (const name of tagNames) {
    const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      ids.push(existing.id)
    } else {
      try {
        const newTag = await wpRequest('tags', 'POST', { name })
        ids.push(newTag.id)
      } catch {}
    }
  }
  return ids
}
