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

// ── RSS ────────────────────────────────────────────────────
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
  const providerConfigs = getProviderConfigs()
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, ...providerConfigs, batchIndex, batchDelay }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Generation failed')
  return data
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
export async function uploadImageToWP(imageUrl, filename, altText) {
  const res = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, filename, altText }),
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
  return wpRequest(endpoint, method, postBody)
}

// ── Resolve categories/tags ────────────────────────────────
export async function resolveCategoryIds(categoryNames, allCategories) {
  return categoryNames
    .map(name => allCategories.find(c => c.name.toLowerCase() === name.toLowerCase())?.id)
    .filter(Boolean)
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
