// pages/api/generate.js
// Generate full article using Claude API server-side

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' })

  const {
    content,        // raw article content / transcript
    title,          // source title hint
    sourceUrl,      // original URL
    sourceName,     // publication name
    primaryCategory, // suggested from source config
    writingPrompt,  // source or global writing style
    authorStyle,    // author voice description
    postFormat,     // standard/video/audio/gallery
    mode,           // 'rewrite' | 'youtube' | 'create'
    regenerateField, // if regenerating single field
    regenerateInstruction, // user instruction for regen
    currentArticle, // current article state for regen
  } = req.body

  // Single field regeneration
  if (regenerateField && currentArticle) {
    return handleRegenerate(res, apiKey, regenerateField, regenerateInstruction, currentArticle, writingPrompt)
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
  "tagline": "one punchy subheadline sentence expanding on the title",
  "body": "full article in clean HTML using <p><h2><h3><ul><li><strong> tags only",
  "excerpt": "2-3 sentence summary for article preview",
  "seoTitle": "SEO title 50-60 chars",
  "metaDescription": "meta description 140-155 chars",
  "focusKeyword": "primary SEO keyword phrase",
  "slug": "url-slug-with-hyphens",
  "primaryCategory": "exact category name from the available list",
  "additionalCategories": ["up to 2 more exact category names"],
  "regionTags": ["relevant region tags from the list only, empty if none"],
  "keywordTags": ["4 to 6 specific SEO keyword tags"],
  "enableToc": false,
  "postFormat": "${postFormat || 'standard'}"
}`

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      return res.status(500).json({ error: `Claude API error: ${claudeRes.status}`, details: err })
    }

    const claudeData = await claudeRes.json()
    const raw = claudeData.content[0].text

    // Parse JSON safely
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const article = JSON.parse(cleaned)

    // Calculate word count
    const wordCount = (article.body || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean).length

    return res.status(200).json({
      ...article,
      wordCount,
      sourceUrl: sourceUrl || '',
      sourceName: sourceName || '',
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

async function handleRegenerate(res, apiKey, field, instruction, article, writingPrompt) {
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

  const prompt = `You are editing an article for 1CW (1cw.org).
Writing style: ${writingPrompt || 'Clear, authoritative, conversational.'}

Current article:
Title: ${article.title}
Body summary: ${(article.body || '').replace(/<[^>]+>/g, ' ').slice(0, 500)}

Task: Regenerate ONLY the "${field}" field (${fieldDescriptions[field] || field}).
User instruction: "${instruction || 'Improve it'}"

Return ONLY valid JSON with a single key "${field}" and its new value. No markdown, no explanation.`

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const claudeData = await claudeRes.json()
    const raw = claudeData.content[0].text
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
