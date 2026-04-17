// pages/youtube.js - YouTube podcast to article
import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Btn, Badge, Spinner, Topbar } from '../components/UI'
import { getYouTubeChannel, getTranscript, generateArticle } from '../lib/api'
import { storage } from '../lib/storage'

const ALL_CATEGORIES = [
  'Artificial Intelligence', 'XR, VR, AR – XROM', 'Blockchain',
  'Quantum & Nanotechnology', 'Robotics & Automation', 'Automotive',
  'Life Sciences & Biotechnology', 'Earth & Environment', 'Health & Medicine',
  'Space & Astronomy', 'Startups & Entrepreneurship', 'Policy & Economy',
  'Corporate Tech & Semiconductors', 'Telecom & Energy Tech',
]

export default function YouTube() {
  const [channel, setChannel] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [article, setArticle] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('Artificial Intelligence')

  useEffect(() => {
    loadChannel()
  }, [])

  async function loadChannel() {
    setLoading(true)
    setStatus('Loading channel...')
    try {
      const sources = storage.getSources()
      const ytSource = sources.find(s => s.type === 'youtube')
      if (!ytSource) {
        setStatus('No YouTube source configured. Add one in Settings → Sources.')
        setLoading(false)
        return
      }
      const handle = ytSource.url.replace('https://www.youtube.com/', '').replace('https://youtube.com/', '')
      const data = await getYouTubeChannel(handle)
      setChannel(data)
      setVideos(data.videos || [])
      setStatus('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setLoading(false)
  }

  async function convertVideo(video) {
    setGenerating(true)
    setStatus('Fetching transcript...')
    try {
      const settings = storage.getSettings()
      const sources = storage.getSources()
      const ytSource = sources.find(s => s.type === 'youtube')

      const transcriptData = await getTranscript(video.videoId)
      setStatus('Generating article from transcript...')

      const authors = storage.getAuthors()
      const authorObj = authors.find(a => a.id === ytSource?.defaultAuthor)

      const result = await generateArticle({
        content: transcriptData.contentForClaude || transcriptData.transcript || video.description,
        title: video.title,
        sourceUrl: `https://youtube.com/watch?v=${video.videoId}`,
        sourceName: channel?.channelTitle || '1CW Podcast',
        primaryCategory: selectedCategory,
        writingPrompt: ytSource?.writingPrompt || settings.globalWritingPrompt,
        authorStyle: authorObj?.style || '',
        postFormat: 'video',
        mode: 'youtube',
      })

      setArticle({
        ...result,
        postFormat: 'video',
        videoUrl: `https://youtube.com/watch?v=${video.videoId}`,
        featuredImageUrl: video.thumbnail || '',
        sourceUrl: `https://youtube.com/watch?v=${video.videoId}`,
        sourceName: channel?.channelTitle || '1CW Podcast',
      })

      storage.addSeenUrl(`https://youtube.com/watch?v=${video.videoId}`)
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setGenerating(false)
  }

  if (article) {
    return (
      <Layout>
        <ArticleEditor
          article={article}
          onBack={() => setArticle(null)}
          onSaved={() => setArticle(null)}
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <Topbar
        title="YouTube"
        subtitle="Podcast → Article"
        actions={
          <Btn variant="secondary" size="sm" onClick={loadChannel} disabled={loading}>
            {loading ? <Spinner size={12} /> : '↺'} Refresh
          </Btn>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {status && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 7, background: '#fef1eb', border: '1px solid #f5c4a8', fontSize: 13, color: '#c8440a', fontFamily: "'DM Mono', monospace" }}>
            {status}
          </div>
        )}

        {/* Category selector */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 12, color: '#9c9a92', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Primary category for converted articles</label>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #dedad2', borderRadius: 6, fontSize: 13, fontFamily: "'Sora', sans-serif", background: '#fdfcf9', color: '#0d0d0d' }}>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Channel header */}
        {channel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '14px 16px', background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 10 }}>
            {channel.channelThumbnail && (
              <img src={channel.channelThumbnail} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#0d0d0d' }}>{channel.channelTitle}</div>
              <div style={{ fontSize: 12, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>{videos.length} recent videos loaded</div>
            </div>
          </div>
        )}

        {/* Video list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {videos.map((video, i) => (
            <div key={video.videoId}
              style={{ background: '#fdfcf9', border: '1px solid #dedad2', borderRadius: 10, overflow: 'hidden', display: 'flex', gap: 0 }}>
              {/* Thumbnail */}
              <div style={{ width: 200, flexShrink: 0, position: 'relative', background: '#1a1a1a' }}>
                {video.thumbnail ? (
                  <img src={video.thumbnail} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: 120, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.3)' }}>▶</span>
                  </div>
                )}
                {i === 0 && (
                  <div style={{ position: 'absolute', top: 8, left: 8, background: '#c8440a', color: '#fff', fontSize: 9, fontFamily: "'DM Mono', monospace", padding: '2px 7px', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase' }}>
                    Latest
                  </div>
                )}
                {storage.isUrlSeen(`https://youtube.com/watch?v=${video.videoId}`) && (
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Badge color="gray">Done</Badge>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0d0d0d', marginBottom: 6, lineHeight: 1.4 }}>{video.title}</div>
                  <div style={{ fontSize: 12, color: '#9c9a92', fontFamily: "'DM Mono', monospace" }}>
                    {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#9c9a92', marginTop: 6, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {video.description?.slice(0, 150)}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Btn variant={i === 0 ? 'primary' : 'secondary'} size="sm"
                    onClick={() => convertVideo(video)}
                    disabled={generating}>
                    {generating ? <><Spinner size={12} />{status}</> : 'Convert to Article →'}
                  </Btn>
                </div>
              </div>
            </div>
          ))}

          {videos.length === 0 && !loading && !status && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9c9a92', fontSize: 14 }}>
              No videos loaded. Make sure your YouTube source is configured in Settings.
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
