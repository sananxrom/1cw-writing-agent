// lib/pipeline.js
// Multi-stage generation pipeline with retry + rate limiting
// Stage 1: Extract facts/angle from source
// Stage 2: Write original article
// Stage 3: Generate SEO + taxonomy

const ALL_CATEGORIES = [
  'Artificial Intelligence', 'XR, VR, AR – XROM', 'Blockchain',
  'Quantum & Nanotechnology', 'Robotics & Automation', 'Automotive',
  'Life Sciences & Biotechnology', 'Earth & Environment', 'Health & Medicine',
  'Space & Astronomy', 'Startups & Entrepreneurship', 'Policy & Economy',
  'Corporate Tech & Semiconductors', 'Telecom & Energy Tech',
]

const REGION_TAGS = [
  'India', 'North America', 'Europe', 'Asia-Pacific',
  'China', 'Latin America', 'Middle East & Africa',
]

const PROVIDER_URLS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  perplexity: 'https://api.perplexity.ai/chat/completions',
}

// ── Retry with exponential backoff ──────────────────────────
export async function withRetry(fn, { retries = 3, baseDelay = 1000, label = 'call' } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isLast = attempt === retries
      const isRateLimit = err.message?.includes('429') || err.message?.includes('rate')
      if (isLast) throw err
      const delay = isRateLimit
        ? baseDelay * Math.pow(2, attempt) * 2  // longer wait for rate limits
        : baseDelay * Math.pow(2, attempt - 1)
      console.log(`[pipeline] ${label} attempt ${attempt} failed: ${err.message} — retrying in ${delay}ms`)
      await sleep(delay)
    }
  }
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── AI call (normalised across providers) ───────────────────
export async function callAI({ provider = 'anthropic', model, apiKey, system, user, maxTokens = 2000 }) {
  const url = PROVIDER_URLS[provider]
  if (!url) throw new Error(`Unknown provider: ${provider}`)

  let headers, body
  if (provider === 'anthropic') {
    headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    body = JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  } else {
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    body = JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  }

  const r = await fetch(url, { method: 'POST', headers, body })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(`${provider} ${r.status}: ${err.slice(0, 200)}`)
  }
  const data = await r.json()
  if (provider === 'anthropic') return data.content[0].text
  return data.choices[0].message.content
}

function parseJSON(raw) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

// ── Stage 1: Extract facts + angle ──────────────────────────
export async function stageExtract({ content, title, sourceUrl, sourceName, provider, model, apiKey }) {
  const system = `You are a senior technology journalist. Your job is to extract the core facts, key claims, and the most newsworthy angle from source material. Be precise and objective. Return only JSON.`

  const user = `Extract the key information from this source material for 1CW (a tech news publication).

Source: ${title || 'Article'}
${sourceUrl ? `URL: ${sourceUrl}` : ''}
${sourceName ? `Publication: ${sourceName}` : ''}

Content:
${(content || '').slice(0, 6000)}

Return ONLY valid JSON:
{
  "headline_angle": "the most newsworthy, original angle — what makes this worth writing about",
  "key_facts": ["5-8 specific, verifiable facts from the source"],
  "key_claims": ["notable claims, quotes, or assertions worth including"],
  "why_it_matters": "1-2 sentences on real-world significance",
  "related_topics": ["3-5 related concepts or technologies"],
  "suggested_category": "one of: ${ALL_CATEGORIES.join(' | ')}"
}`

  return withRetry(() => callAI({ provider, model, apiKey, system, user, maxTokens: 800 }).then(parseJSON), { label: 'extract' })
}

// ── Stage 2: Write article from extracted facts ──────────────
export async function stageWrite({ extracted, title, sourceUrl, sourceName, primaryCategory, writingPrompt, authorStyle, postFormat, mode, provider, model, apiKey }) {
  const system = `You are a professional content writer for 1CW (1cw.org), a technology news publication.
${authorStyle ? `Author voice: ${authorStyle}` : ''}
Writing style: ${writingPrompt || 'Clear, authoritative, conversational. Lead with impact. 500-800 words. Do not rewrite the source — write an original article informed by the facts.'}

IMPORTANT: You are writing an ORIGINAL article, not a summary or rewrite. Use the extracted facts as your research, then write with editorial voice and insight.`

  const user = `Write an original article for 1CW based on these extracted facts.

Headline angle: ${extracted.headline_angle}
Key facts:
${extracted.key_facts?.map(f => `- ${f}`).join('\n')}
Key claims:
${extracted.key_claims?.map(c => `- ${c}`).join('\n')}
Why it matters: ${extracted.why_it_matters}
${primaryCategory ? `Category: ${primaryCategory || extracted.suggested_category}` : ''}
Post format: ${postFormat || 'standard'}
${mode === 'youtube' ? 'This is from a podcast/video — preserve the speaker\'s voice and conversational insights.' : ''}
${mode === 'create' ? 'This is an original piece — develop the argument and add context beyond the source.' : ''}
${sourceUrl ? `Original source: ${sourceUrl} (reference it naturally, do not copy it)` : ''}

Return ONLY valid JSON:
{
  "title": "compelling, original headline",
  "tagline": "one punchy subheadline expanding on the title",
  "body": "full article in clean HTML using <p><h2><h3><ul><li><strong> only",
  "excerpt": "2-3 sentence summary for article preview"
}`

  return withRetry(() => callAI({ provider, model, apiKey, system, user, maxTokens: 2500 }).then(parseJSON), { label: 'write' })
}

// ── Stage 3: SEO + taxonomy ──────────────────────────────────
export async function stageSEO({ title, body, excerpt, primaryCategory, extracted, provider, model, apiKey }) {
  const system = `You are an SEO specialist for a tech news publication. Generate precise, effective SEO metadata. Return only JSON.`

  const user = `Generate SEO metadata for this article.

Title: ${title}
Excerpt: ${excerpt}
Primary category: ${primaryCategory || extracted?.suggested_category || ''}
Key topics: ${extracted?.related_topics?.join(', ') || ''}
Body preview: ${(body || '').replace(/<[^>]+>/g, ' ').slice(0, 500)}

Available primary categories: ${ALL_CATEGORIES.join(', ')}
Region tags (only if clearly relevant): ${REGION_TAGS.join(', ')}

Return ONLY valid JSON:
{
  "seoTitle": "SEO title 50-60 chars",
  "metaDescription": "compelling meta description 140-155 chars",
  "focusKeyword": "primary SEO keyword phrase",
  "slug": "url-slug-with-hyphens",
  "primaryCategory": "exact category name from the available list",
  "additionalCategories": [],
  "regionTags": [],
  "keywordTags": ["4-6 specific SEO keyword tags"],
  "enableToc": false
}`

  return withRetry(() => callAI({ provider, model, apiKey, system, user, maxTokens: 600 }).then(parseJSON), { label: 'seo' })
}

// ── Stage 4: Regen single field ──────────────────────────────
export async function stageRegen({ field, instruction, article, writingPrompt, provider, model, apiKey }) {
  const fieldDescriptions = {
    title: 'article title (headline)',
    tagline: 'tagline (one-sentence subheadline)',
    excerpt: 'excerpt (2-3 sentence summary)',
    seoTitle: 'SEO title (50-60 chars)',
    metaDescription: 'meta description (140-155 chars)',
    focusKeyword: 'focus keyword phrase',
    keywordTags: 'keyword tags array (4-6 specific tags)',
    body: 'article body in clean HTML',
  }

  const system = `You are editing an article for 1CW (1cw.org). Writing style: ${writingPrompt || 'Clear, authoritative, conversational.'}. Return only JSON.`
  const user = `Current article title: ${article.title}
Body preview: ${(article.body || '').replace(/<[^>]+>/g, ' ').slice(0, 400)}

Regenerate ONLY the "${field}" field (${fieldDescriptions[field] || field}).
User instruction: "${instruction || 'Improve it'}"

Return ONLY valid JSON: { "${field}": <new value> }`

  return withRetry(() => callAI({ provider, model, apiKey, system, user, maxTokens: 1000 }).then(parseJSON), { label: `regen:${field}` })
}

// ── Full pipeline ────────────────────────────────────────────
export async function runPipeline({
  content, title, sourceUrl, sourceName, primaryCategory,
  writingPrompt, authorStyle, postFormat, mode,
  writingProvider, editingProvider,
}) {
  const wp = writingProvider  // { provider, model, apiKey }
  const ep = editingProvider || writingProvider

  // Stage 1: Extract (use editing provider — cheaper/faster for structured extraction)
  const extracted = await stageExtract({
    content, title, sourceUrl, sourceName,
    provider: ep.provider, model: ep.model, apiKey: ep.apiKey,
  })

  // Stage 2: Write (use writing provider)
  const written = await stageWrite({
    extracted, title, sourceUrl, sourceName,
    primaryCategory: primaryCategory || extracted.suggested_category,
    writingPrompt, authorStyle, postFormat, mode,
    provider: wp.provider, model: wp.model, apiKey: wp.apiKey,
  })

  // Stage 3: SEO (use editing provider — structured task)
  const seo = await stageSEO({
    title: written.title,
    body: written.body,
    excerpt: written.excerpt,
    primaryCategory: primaryCategory || extracted.suggested_category,
    extracted,
    provider: ep.provider, model: ep.model, apiKey: ep.apiKey,
  })

  const wordCount = (written.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length

  return {
    ...written,
    ...seo,
    wordCount,
    sourceUrl: sourceUrl || '',
    sourceName: sourceName || '',
    _extracted: extracted,  // Keep for debugging/audit
  }
}
