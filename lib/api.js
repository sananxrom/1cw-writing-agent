// lib/api.js
// Frontend helpers that call our Vercel API routes

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

export async function generateArticle(params) {
  // Inject writing provider config
  if (typeof window !== 'undefined') {
    try {
      const providers = JSON.parse(localStorage.getItem('1cw_ai_providers') || '{}')
      const cfg = params.regenerateField
        ? (providers.editing || {})
        : (providers.writing || {})
      if (cfg.apiKey && !params.apiKey) {
        params = { ...params, provider: cfg.provider, model: cfg.model, apiKey: cfg.apiKey }
      }
    } catch {}
  }
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Generation failed')
  return data
}

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

// Save article as draft to WordPress with all meta
export async function saveToWordPress(article, wpMeta) {
  const { categoryIds, tagIds, authorId, featuredImageId } = wpMeta

  // Build post body
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
      // Rank Math SEO
      rank_math_title: article.seoTitle,
      rank_math_description: article.metaDescription,
      rank_math_focus_keyword: article.focusKeyword,
      // Foxiz theme
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
      // Source attribution
      _source_url: article.sourceUrl || '',
      _source_name: article.sourceName || '',
    },
  }

  // Set featured image if uploaded
  if (featuredImageId) {
    postBody.featured_media = featuredImageId
  }

  // Create or update post
  const endpoint = article.wpPostId
    ? `posts/${article.wpPostId}`
    : 'posts'
  const method = article.wpPostId ? 'PUT' : 'POST'

  const post = await wpRequest(endpoint, method, postBody)
  return post
}

// Resolve category names to IDs
export async function resolveCategoryIds(categoryNames, allCategories) {
  return categoryNames
    .map(name => {
      const found = allCategories.find(
        c => c.name.toLowerCase() === name.toLowerCase()
      )
      return found?.id
    })
    .filter(Boolean)
}

// Resolve or create tags
export async function resolveTagIds(tagNames, allTags) {
  const ids = []
  for (const name of tagNames) {
    const existing = allTags.find(
      t => t.name.toLowerCase() === name.toLowerCase()
    )
    if (existing) {
      ids.push(existing.id)
    } else {
      try {
        const newTag = await wpRequest('tags', 'POST', { name })
        ids.push(newTag.id)
      } catch (e) {
        // Tag creation failed, skip
      }
    }
  }
  return ids
}
