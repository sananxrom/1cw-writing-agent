// Proxy — avoids CORS when testing API keys from browser
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { provider, apiKey, model } = req.body
  if (!apiKey) return res.status(400).json({ ok: false, msg: 'No API key' })

  try {
    let r
    if (provider === 'anthropic') {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }),
      })
    } else if (provider === 'openai') {
      r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'gpt-4o-mini', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }),
      })
    } else {
      r = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'sonar', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }),
      })
    }
    return res.status(200).json({ ok: r.ok, status: r.status })
  } catch (err) {
    return res.status(200).json({ ok: false, msg: err.message })
  }
}
