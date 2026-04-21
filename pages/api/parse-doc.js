// pages/api/parse-doc.js
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
    const buffer = Buffer.from(docBase64, 'base64')

    // Extract text
    const textResult = await mammoth.extractRawText({ buffer })
    const fullText = textResult.value || ''

    // Extract embedded images
    const images = []
    try {
      await mammoth.convertToHtml({
        buffer,
        convertImage: mammoth.images.imgElement(async (image) => {
          const b64 = await image.read('base64')
          const ct = image.contentType || 'image/jpeg'
          images.push({ dataUrl: `data:${ct};base64,${b64}` })
          return { src: `img_${images.length - 1}` }
        })
      })
    } catch {}

    // Step 1: use haiku to identify article boundaries (titles only — fast, small output)
    const indexPrompt = `This document contains multiple news articles. List the title of each article, one per line. Output ONLY the titles, nothing else.

Document:
${fullText.slice(0, 8000)}`

    const titlesRaw = await callAI({
      provider: provider || 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      apiKey: resolvedKey,
      system: 'List article titles only, one per line.',
      user: indexPrompt,
      maxTokens: 500,
    })

    const titles = titlesRaw.split('\n').map(t => t.replace(/^\d+[\.\)]\s*/, '').replace(/^\*+\s*/, '').replace(/^\-+\s*/, '').trim()).filter(t => t.length > 5)

    // Step 2: for each title, extract the matching section from the text
    // Simple heuristic: split text at each title
    const articles = []
    for (let i = 0; i < titles.length; i++) {
      const title = titles[i]
      const nextTitle = titles[i + 1]

      // Find start of this article in full text
      const startIdx = fullText.indexOf(title)
      if (startIdx === -1) continue
      const endIdx = nextTitle ? fullText.indexOf(nextTitle, startIdx + title.length) : fullText.length
      const body = fullText.slice(startIdx + title.length, endIdx > startIdx ? endIdx : fullText.length).trim()

      // Extract source name — look for "(Source: X)" pattern
      const sourceMatch = body.match(/\(Source:\s*([^)]+)\)/)
      const sourceName = sourceMatch?.[1]?.trim() || null
      const cleanBody = body.replace(/\(Source:[^)]+\)/g, '').trim()

      articles.push({
        title,
        body: cleanBody,
        sourceName,
        pubDate: null,
        suggestedCategory: null,
        category: defaultCategory || null,
        authorId: authorId || null,
        imageDataUrl: images[i]?.dataUrl || null,
        fromDoc: docName || 'document',
        docIndex: i,
      })
    }

    // Step 3: batch-assign categories if autoDetect (one haiku call for all)
    if (autoDetect && articles.length > 0) {
      try {
        const catPrompt = `For each article title below, pick the best category from this list: ${ALL_CATEGORIES.join(', ')}.
Return ONLY a JSON array of category strings in the same order, e.g. ["Artificial Intelligence","XR, VR, AR – XROM"]

Titles:
${articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}`

        const catRaw = await callAI({
          provider: provider || 'anthropic',
          model: 'claude-haiku-4-5-20251001',
          apiKey: resolvedKey,
          system: 'Return only a JSON array of category strings.',
          user: catPrompt,
          maxTokens: 300,
        })
        const cats = JSON.parse(catRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
        cats.forEach((cat, i) => { if (articles[i]) articles[i].category = cat || articles[i].category })
      } catch {}
    }

    return res.status(200).json({ articles, totalImages: images.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
