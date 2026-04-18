// pages/api/generate-seo.js — Stage 3: SEO + taxonomy
export const config = { maxDuration: 10 }
import { stageSEO } from '../../lib/pipeline'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { title, body, excerpt, primaryCategory, extracted, provider, model, apiKey } = req.body
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!resolvedKey) return res.status(500).json({ error: 'No API key' })
  try {
    const seo = await stageSEO({ title, body, excerpt, primaryCategory, extracted, provider: provider || 'anthropic', model, apiKey: resolvedKey })
    return res.status(200).json(seo)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
