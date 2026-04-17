// pages/api/generate.js
// Supports multiple AI providers: anthropic, openai, perplexity
// API keys passed from frontend (stored in browser localStorage, never in env)

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

const PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-5',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
  },
  perplexity: {
    url: 'https://api.perplexity.ai/chat/completions',
    defaultModel: 'llama-3.1-sonar-large-128k-online',
  },
}

async function callAI({ provider, model, apiKey, system, user, maxTokens = 4000 }) {
  const cfg = PROVIDERS[provider] || PROVIDERS.anthropic
  const resolvedModel = model || cfg.defaultModel
  let url, headers, body

  if (provider === 'anthropic') {
    url = cfg.url
    headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    body = JSON.stringify({ model: resolvedModel, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  } else {
    url = cfg.url
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    body = JSON.stringify({ model: resolvedModel, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  }

  const r = await fetch(url, { method: 'POST', headers, body })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(`${provider} API error: ${r.status} — ${err.slice(0, 300)}`)
  }
  const data = await r.json()
  if (provider === 'anthropic') return data.content[0].text
  return data.choices[0].message.content
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    content, title, sourceUrl, sourceName, primaryCategory,
    writingPrompt, authorStyle, postFormat, mode,
    regenerateField, regenerateInstruction, currentArticle,
    provider = 'anthropic', model, apiKey,
  } = req.body

  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!resolvedKey) return res.status(500).json({ error: 'No API key provided. Add one in Settings → AI Providers.' })

  if (regenerateField && currentArticle) {
    return handleRegenerate(res, { provider, model, apiKey: resolvedKey }, regenerateField, regenerateInstruction, currentArticle, writingPrompt)
  }

  const systemPrompt = `You are a professional content editor for 1CW (1cw.org), a technology news publication covering future tech, science, and innovation.
${authorStyle ? `Author voice: ${authorStyle}` : ''}
Writing style: ${writingPrompt || 'Clear, authoritative, conversational. Lead with what matters. Under 700 words unless topic demands more.'}
Available primary categories: ${ALL_CATEGORIES.join(', ')}
Region tags (use ONLY these exact strings, only if clearly relevant): ${REGION_TAGS.join(', ')}
Post formats: standard, gallery, video, audio
${mode === 'youtube' ? 'This is a YouTube podcast transcript. Convert to a well-structured article preserving key insights.' : ''}
${mode === 'create' ? 'The user has provided a topic or seed idea. Expand it into a full original article.' : ''}`

  const userPrompt = `Transform the following into a complete article for 1CW.

Source: ${title || 'Article'}
${sourceUrl ? `URL: ${sourceUrl}` : ''}
${sourceName ? `Publication: ${sourceName}` : ''}
${primaryCategory ? `Suggested primary category: ${primaryCategory}` : ''}
Post format: ${postFormat || 'standard'}

Content:
${(content || '').slice(0, 5000)}

Return ONLY valid JSON (no markdown, no backticks, no explanation) with exactly these fields:
{
  "title": "compelling headline",
  "tagline": "one punchy subheadline sentence",
  "body": "full article in clean HTML using <p><h2><h3><ul><li><strong> tags only",
  "excerpt": "2-3 sentence summary",
  "seoTitle": "SEO title 50-60 chars",
  "metaDescription": "meta description 140-155 chars",
  "focusKeyword": "primary SEO keyword phrase",
  "slug": "url-slug-with-hyphens",
  "primaryCategory": "exact category name from the available list",
  "additionalCategories": [],
  "regionTags": [],
  "keywordTags": ["4 to 6 specific SEO keyword tags"],
  "enableToc": false,
  "postFormat": "${postFormat || 'standard'}"
}`

  try {
    const raw = await callAI({ provider, model, apiKey: resolvedKey, system: systemPrompt, user: userPrompt })
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const article = JSON.parse(cleaned)
    const wordCount = (article.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
    return res.status(200).json({ ...article, wordCount, sourceUrl: sourceUrl || '', sourceName: sourceName || '' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleRegenerate(res, { provider, model, apiKey }, field, instruction, article, writingPrompt) {
  const fieldDescriptions = {
    title: 'article title (headline)', tagline: 'tagline (one-sentence subheadline)',
    excerpt: 'excerpt (2-3 sentence summary)', seoTitle: 'SEO title (50-60 chars)',
    metaDescription: 'meta description (140-155 chars)', focusKeyword: 'focus keyword phrase',
    keywordTags: 'keyword tags array (4-6 specific tags)', body: 'article body in clean HTML',
  }
  const prompt = `You are editing an article for 1CW (1cw.org).
Writing style: ${writingPrompt || 'Clear, authoritative, conversational.'}
Current article title: ${article.title}
Body summary: ${(article.body || '').replace(/<[^>]+>/g, ' ').slice(0, 500)}
Task: Regenerate ONLY the "${field}" field (${fieldDescriptions[field] || field}).
User instruction: "${instruction || 'Improve it'}"
Return ONLY valid JSON with a single key "${field}" and its new value. No markdown, no explanation.`
  try {
    const raw = await callAI({ provider, model, apiKey, system: 'You are a content editor. Return only JSON.', user: prompt, maxTokens: 1000 })
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return res.status(200).json(JSON.parse(cleaned))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
