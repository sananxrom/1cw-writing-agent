import Parser from 'rss-parser'
import * as cheerio from 'cheerio'
import { upsertPulledArticles, getPulledArticles, deletePulledArticles, updatePulledStatus, initDb } from '../../lib/db'

const parser = new Parser({ customFields: { item: ['media:content', 'media:thumbnail', 'enclosure'] } })

function extractFirstImage(html = '') {
  const m = html.match(/<img[^>]+src=['"]([^'"]+)['"]/i)
  return m ? m[1] : ''
}

async function fetchRSS(source) {
  const feed = await parser.parseURL(source.url)
  return (feed.items || []).slice(0, source.maxArticles || 20).map(item => ({
    url: item.link || item.guid || '',
    title: item.title || '',
    summary: item.contentSnippet || item.summary || item.description || '',
    content: item.content || item['content:encoded'] || '',
    image: item['media:content']?.$?.url || item['media:thumbnail']?.$?.url || item.enclosure?.url || extractFirstImage(item.content || item['content:encoded'] || '') || '',
    pubDate: item.pubDate || item.isoDate || null,
    sourceId: source.id, sourceName: source.name, sourceType: 'rss',
  })).filter(i => i.url)
}

async function fetchScrape(source) {
  const response = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()
  const $ = cheerio.load(html)
  const links = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href'); const text = $(el).text().trim()
    if (!href || text.length < 20) return
    let url = href
    try { url = new URL(href, source.url).href } catch {}
    if (url.startsWith('http') && !links.find(l => l.url === url)) {
      links.push({ url, title: text.slice(0, 200), summary: '', content: '', image: '', pubDate: new Date().toISOString(), sourceId: source.id, sourceName: source.name, sourceType: 'scrape' })
    }
  })
  if (!links.length) {
    links.push({ url: source.url, title: $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || source.url, summary: $('meta[property="og:description"]').attr('content') || '', content: '', image: $('meta[property="og:image"]').attr('content') || '', pubDate: new Date().toISOString(), sourceId: source.id, sourceName: source.name, sourceType: 'scrape' })
  }
  return links.slice(0, source.maxArticles || 10)
}

async function resolveYouTubeChannelId(url) {
  // Direct UC channel ID — no resolution needed
  const direct = url.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/)
  if (direct) return direct[1]

  // @handle — try handle-based RSS first (returns channel ID in feed)
  const handle = url.match(/youtube\.com\/@([A-Za-z0-9_.-]+)/)?.[1]
  if (handle) {
    // Try legacy user RSS
    const r1 = await fetch(`https://www.youtube.com/feeds/videos.xml?user=${handle}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (r1.ok) {
      const xml = await r1.text()
      const cid = xml.match(/<yt:channelId>([^<]+)<\/yt:channelId>/)
      if (cid?.[1]) { console.log('[yt] resolved via user RSS:', cid[1]); return cid[1] }
    }
  }

  // Fetch channel page — look for channel ID in HTML
  const pageUrl = url.includes('youtube.com') ? url.replace(/\/$/, '') : `https://www.youtube.com/${url}`
  const r = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  })
  const html = r.ok ? await r.text() : ''
  console.log(`[yt] page fetch ${r.status}, html ${html.length} bytes`)

  for (const p of [/"channelId":"(UC[A-Za-z0-9_-]{20,})"/, /"externalId":"(UC[A-Za-z0-9_-]{20,})"/, /"browseId":"(UC[A-Za-z0-9_-]{20,})"/]) {
    const m = html.match(p)
    if (m?.[1]) { console.log('[yt] resolved from page:', m[1]); return m[1] }
  }

  // Scan all UC ids, pick first
  const all = [...html.matchAll(/UC[A-Za-z0-9_-]{21}/g)].map(m => m[0])
  if (all[0]) { console.log('[yt] resolved via scan:', all[0]); return all[0] }

  throw new Error(`Cannot resolve channel ID. Use: youtube.com/channel/UC... directly. Page returned ${html.length} bytes.`)
}

async function fetchYouTube(source) {
  const max = source.maxArticles || 10
  let channelId
  try {
    channelId = await resolveYouTubeChannelId(source.url.trim())
  } catch (e) {
    console.error('[yt] resolve failed:', e.message)
    return []
  }

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  console.log('[yt] fetching RSS:', rssUrl)
  const r = await fetch(rssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) { console.error('[yt] RSS failed:', r.status); return [] }
  const xml = await r.text()
  console.log('[yt] RSS length:', xml.length, 'has entry:', xml.includes('<entry>'))

  return xml.split('<entry>').slice(1).slice(0, max).map(entry => {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim() || ''
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1]
    const description = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1]?.trim().slice(0, 300) || ''
    if (!videoId || !title) return null
    return { url: `https://www.youtube.com/watch?v=${videoId}`, title, summary: description || `Watch: ${title}`, image: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, content: '', pubDate: published || null, sourceId: source.id, sourceName: source.name, sourceType: 'youtube' }
  }).filter(Boolean)
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    try { await deletePulledArticles(req.body.urls || []); return res.json({ ok: true }) } catch (e) { return res.status(500).json({ error: e.message }) }
  }
  if (req.method === 'PATCH') {
    try { await updatePulledStatus(req.body.urls || [], req.body.status); return res.json({ ok: true }) } catch (e) { return res.status(500).json({ error: e.message }) }
  }
  if (req.method !== 'POST') return res.status(405).end()

  const { source, dateRange = 'all', refresh = false } = req.body
  try {
    await initDb()
    if (refresh && source) {
      let items = []
      try {
        if (source.type === 'rss') items = await fetchRSS(source)
        else if (source.type === 'youtube') items = await fetchYouTube(source)
        else if (source.type === 'scrape') items = await fetchScrape(source)
        if (items.length) await upsertPulledArticles(items)
      } catch (e) { console.error(`[pull-source] ${source.name}:`, e.message) }
    }
    const rows = await getPulledArticles({ sourceIds: source ? [source.id] : null, dateRange: dateRange === 'all' ? null : dateRange, limit: 200 })
    return res.json({ articles: rows.map(r => ({ url: r.url, link: r.url, title: r.title, summary: r.summary, image: r.image, sourceId: r.source_id, sourceName: r.source_name, sourceType: r.source_type, pubDate: r.pub_date, pulledAt: r.pulled_at, status: r.status, content: r.content, dbId: r.id })), total: rows.length })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
