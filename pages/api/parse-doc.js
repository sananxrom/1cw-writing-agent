// pages/api/parse-doc.js
// Parse uploaded .docx file → split into individual articles
// Uses mammoth for text extraction, Claude for splitting
export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } },
}

import mammoth from 'mammoth'
import { callAI } from '../../lib/pipeline'

const ALL_CATEGORIES = [
  'Artificial Intelligence','XR, VR, AR – XROM','Blockchain','Quantum & Nanotechnology',
  'Robotics & Automation','Automotive','Life Sciences & Biotechnology','Earth & Environment',
  'Health & Medicine','Space & Astronomy','Startups & Entrepreneurship','Policy & Economy',
  'Corporate Tech & Semiconductors','Telecom & Energy Tech',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { docBase64, docName, provider, model, apiKey, authorId, defaultCategory, autoDetect } = req.body
  if (!docBase64) return res.status(400).json({ error: 'docBase64 required' })

  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!resolvedKey) return res.status(500).json({ error: 'No API key' })

  try {
    // Decode base64 → buffer
    const buffer = Buffer.from(docBase64, 'base64')

    // Extract text + images using mammoth
    const textResult = await mammoth.extractRawText({ buffer })
    const htmlResult = await mammoth.convertToHtml({ buffer })
    const fullText = textResult.value || ''

    // Extract embedded images (base64)
    const images = []
    try {
      const imgResult = await mammoth.convertToHtml({
        buffer,
        convertImage: mammoth.images.imgElement(async (image) => {
          const b64 = (await image.read('base64'))
          const ct = image.contentType || 'image/jpeg'
          images.push({ dataUrl: `data:${ct};base64,${b64}`, contentType: ct })
          return { src: `__img_${images.length - 1}__` }
        })
      })
    } catch {}

    // Use Claude haiku to split into articles
    const splitPrompt = `You are parsing a document that contains multiple news articles compiled together.

Split the following document into individual articles. Each article has a headline/title and body text.

Return ONLY valid JSON array:
[
  {
    "title": "article headline",
    "body": "full article body text (preserve paragraphs)",
    "pubDate": "date if mentioned (ISO format) or null",
    "sourceName": "source publication if mentioned or null",
    "suggestedCategory": "one of: ${ALL_CATEGORIES.join(' | ')}"
  }
]

Document:
${fullText.slice(0, 12000)}`

    const raw = await callAI({
      provider: provider || 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      apiKey: resolvedKey,
      system: 'Split document into articles. Return only JSON array.',
      user: splitPrompt,
      maxTokens: 4000,
    })

    let articles = []
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      articles = JSON.parse(cleaned)
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response: ' + e.message, raw: raw.slice(0, 500) })
    }

    // Assign images to articles (rough heuristic: distribute evenly)
    const result = articles.map((article, i) => ({
      ...article,
      category: autoDetect ? article.suggestedCategory : (defaultCategory || article.suggestedCategory),
      authorId: authorId || null,
      // Assign first image to first article, try to distribute
      imageDataUrl: images[i]?.dataUrl || images[0]?.dataUrl || null,
      fromDoc: docName || 'document',
      docIndex: i,
    }))

    return res.status(200).json({ articles: result, totalImages: images.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
