import { YoutubeTranscript } from 'youtube-transcript'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { videoId } = req.body
  if (!videoId) return res.status(400).json({ error: 'videoId required' })

  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
    const transcript = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()
    return res.json({ transcript, hasTranscript: transcript.length > 100, length: transcript.length })
  } catch (err) {
    // No transcript available
    console.log('[yt-transcript] failed:', err.message)
    return res.json({ transcript: '', hasTranscript: false, length: 0, error: err.message })
  }
}
