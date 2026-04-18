// pages/api/generate-write.js — Stage 2: write article
export const config = { maxDuration: 10 }
import { stageWrite } from '../../lib/pipeline'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { extracted, title, sourceUrl, sourceName, primaryCategory, writingPrompt, authorStyle, postFormat, mode, provider, model, apiKey } = req.body
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!resolvedKey) return res.status(500).json({ error: 'No API key' })
  try {
    const written = await stageWrite({ extracted, title, sourceUrl, sourceName, primaryCategory, writingPrompt, authorStyle, postFormat, mode, provider: provider || 'anthropic', model, apiKey: resolvedKey })
    return res.status(200).json(written)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
