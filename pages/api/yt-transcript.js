// Fetch YouTube transcript without API key
// Uses timedtext endpoint + player response parsing
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { videoId } = req.body
  if (!videoId) return res.status(400).json({ error: 'videoId required' })

  try {
    // Fetch watch page to get caption track list
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })
    const html = pageRes.ok ? await pageRes.text() : ''

    // Extract captionTracks from ytInitialPlayerResponse
    let transcript = ''
    const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])\s*,\s*"audioTracks"/)
    if (captionMatch) {
      try {
        const tracks = JSON.parse(captionMatch[1])
        const en = tracks.find(t => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0]
        if (en?.baseUrl) {
          const ttRes = await fetch(en.baseUrl)
          if (ttRes.ok) {
            const xml = await ttRes.text()
            transcript = xml
              .replace(/<text[^>]*>/g, ' ')
              .replace(/<\/text>/g, '')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ').trim()
          }
        }
      } catch {}
    }

    // Fallback: try timedtext directly
    if (!transcript) {
      for (const lang of ['en', 'en-US', 'en-GB']) {
        const r = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=vtt`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        if (r.ok) {
          const vtt = await r.text()
          if (vtt.includes('WEBVTT')) {
            transcript = vtt.split('\n')
              .filter(l => l.trim() && !l.startsWith('WEBVTT') && !/^\d{2}:\d{2}/.test(l) && !/^\d+$/.test(l) && !l.startsWith('NOTE'))
              .join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
            if (transcript) break
          }
        }
      }
    }

    return res.json({ transcript, hasTranscript: transcript.length > 100, length: transcript.length })
  } catch (err) {
    return res.status(500).json({ error: err.message, transcript: '' })
  }
}
