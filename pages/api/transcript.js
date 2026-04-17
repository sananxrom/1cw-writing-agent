// pages/api/transcript.js
// Fetch YouTube video info and auto-captions server-side

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { videoId, channelId } = req.body

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' })

  try {
    // If channelId given, get latest video first
    let targetVideoId = videoId
    let videoInfo = {}

    if (channelId && !videoId) {
      const listRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=1&type=video`
      )
      const listData = await listRes.json()
      if (!listData.items?.length) return res.status(404).json({ error: 'No videos found' })
      targetVideoId = listData.items[0].id.videoId
      videoInfo = {
        title: listData.items[0].snippet.title,
        description: listData.items[0].snippet.description,
        thumbnail: listData.items[0].snippet.thumbnails?.high?.url || '',
        publishedAt: listData.items[0].snippet.publishedAt,
        channelTitle: listData.items[0].snippet.channelTitle,
      }
    }

    if (!targetVideoId) return res.status(400).json({ error: 'videoId or channelId required' })

    // Get video details if not already fetched
    if (!videoInfo.title) {
      const detailRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${targetVideoId}&part=snippet,contentDetails`
      )
      const detailData = await detailRes.json()
      if (detailData.items?.length) {
        const s = detailData.items[0].snippet
        videoInfo = {
          title: s.title,
          description: s.description,
          thumbnail: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || '',
          publishedAt: s.publishedAt,
          channelTitle: s.channelTitle,
          duration: detailData.items[0].contentDetails?.duration || '',
        }
      }
    }

    // Try to get transcript via timedtext API
    let transcript = ''
    try {
      // First get available caption tracks
      const captionListRes = await fetch(
        `https://www.googleapis.com/youtube/v3/captions?key=${apiKey}&videoId=${targetVideoId}&part=snippet`
      )
      const captionData = await captionListRes.json()

      if (captionData.items?.length) {
        // Prefer English auto-generated or manual captions
        const enCaption = captionData.items.find(c =>
          c.snippet.language === 'en' || c.snippet.language === 'en-US'
        ) || captionData.items[0]

        // Try timedtext endpoint (public, no auth needed for auto captions)
        const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${targetVideoId}&lang=${enCaption.snippet.language}&fmt=vtt`
        const ttRes = await fetch(timedTextUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })

        if (ttRes.ok) {
          const vtt = await ttRes.text()
          // Parse VTT to plain text
          transcript = vtt
            .split('\n')
            .filter(line =>
              line.trim() &&
              !line.startsWith('WEBVTT') &&
              !line.startsWith('NOTE') &&
              !/^\d{2}:\d{2}/.test(line) &&
              !/^\d+$/.test(line)
            )
            .join(' ')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        }
      }
    } catch (captionErr) {
      // Caption fetch failed - will use description only
      console.log('Caption fetch failed:', captionErr.message)
    }

    return res.status(200).json({
      videoId: targetVideoId,
      ...videoInfo,
      transcript,
      hasTranscript: transcript.length > 100,
      contentForClaude: transcript ||
        `Video Title: ${videoInfo.title}\n\nDescription: ${videoInfo.description}`,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
