// pages/api/youtube-channel.js
// Resolve @handle to channel ID and get latest video

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { handle } = req.body
  if (!handle) return res.status(400).json({ error: 'handle required' })

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' })

  try {
    // Search for channel by handle
    const cleanHandle = handle.replace('@', '')
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&q=${encodeURIComponent(cleanHandle)}&type=channel&part=snippet&maxResults=1`
    )
    const searchData = await searchRes.json()

    if (!searchData.items?.length) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    const channelId = searchData.items[0].id.channelId
    const channelTitle = searchData.items[0].snippet.title
    const channelThumbnail = searchData.items[0].snippet.thumbnails?.default?.url || ''

    // Get latest video
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=3&type=video`
    )
    const videosData = await videosRes.json()

    const videos = (videosData.items || []).map(v => ({
      videoId: v.id.videoId,
      title: v.snippet.title,
      description: v.snippet.description,
      thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || '',
      publishedAt: v.snippet.publishedAt,
    }))

    return res.status(200).json({ channelId, channelTitle, channelThumbnail, videos })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
