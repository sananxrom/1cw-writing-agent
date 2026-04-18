// pages/api/generate-extract.js — Stage 1: extract facts
// Must complete in <10s (Hobby plan limit)
import { stageExtract } from '../../lib/pipeline'

export const config = { maxDuration: 10 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { content, title, sourceUrl, sourceName, provider, model, apiKey } = req.body
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!resolvedKey) return res.status(500).json({ error: 'No API key' })
  try {
    const extracted = await stageExtract({ content, title, sourceUrl, sourceName, provider: provider || 'anthropic', model, apiKey: resolvedKey })
    return res.status(200).json(extracted)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
