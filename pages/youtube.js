// pages/youtube.js — matching design YouTubePage
import { useState } from 'react'
import Layout from '../components/Layout'
import ArticleEditor from '../components/ArticleEditor'
import { Topbar, Btn, I, Switch, TextInput, Spinner, Badge } from '../components/UI'
import { getYouTubeChannel, getTranscript, generateArticle } from '../lib/api'
import { storage } from '../lib/storage'

export default function YouTube() {
  const [singleUrl, setSingleUrl] = useState('')
  const [processing, setProcessing] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const sources = storage.getSources().filter(s => s.type === 'youtube')

  async function handleSingle() {
    if (!singleUrl.trim()) return
    setProcessing(true)
    try {
      const videoId = singleUrl.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1]
      if (!videoId) throw new Error('Invalid YouTube URL')
      const transcript = await getTranscript(videoId)
      const settings = storage.getSettings()
      const article = await generateArticle({
        content: transcript.text || '',
        title: transcript.title || 'YouTube Video',
        sourceUrl: singleUrl,
        mode: 'youtube',
        writingPrompt: settings.globalWritingPrompt,
      })
      setEditingArticle({ ...article, sourceUrl: singleUrl, videoUrl: singleUrl })
    } catch (err) { alert('Failed: ' + err.message) }
    setProcessing(false)
  }

  if (editingArticle) return (
    <Layout>
      <ArticleEditor article={editingArticle} onBack={() => setEditingArticle(null)} onSaved={() => setEditingArticle(null)} />
    </Layout>
  )

  return (
    <Layout>
      <Topbar title="YouTube" subtitle="Transcribe and rewrite video content"
        actions={<Btn variant="accent" size="sm" leftIcon={<I name="plus" size={13} />}>Add channel</Btn>} />
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: 860 }}>
          {/* Single video */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Pull single video</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <TextInput value={singleUrl} onChange={setSingleUrl} placeholder="Paste YouTube URL" icon="youtube" style={{ flex: 1 }} />
              <Btn variant="primary" onClick={handleSingle} disabled={processing}>
                {processing ? <><Spinner size={13} /> Processing…</> : 'Transcribe → Rewrite'}
              </Btn>
            </div>
          </div>

          {/* Tracked channels */}
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Tracked channels</div>
          {sources.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 8 }}>
              No YouTube channels configured. Add one in <a href="/settings" style={{ color: 'var(--accent)' }}>Settings → Sources</a>.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {sources.map(s => (
              <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
                  <I name="youtube" size={18} color="var(--danger)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>{s.primaryCategory}</div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
                    <Btn variant="secondary" size="sm" leftIcon={<I name="refresh" size={11} />}>Pull latest</Btn>
                    <Btn variant="ghost" size="sm"><I name="settings" size={11} /></Btn>
                  </div>
                </div>
                <Switch checked={s.active} onChange={() => {}} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
