// pages/api/pull-source.js
// Handles RSS and scrape sources — fetches, dedupes, persists to DB
// Returns merged list from DB for given source/dateRange

import Parser from 'rss-parser'
import * as cheerio from 'cheerio'
import { upsertPulledArticles, getPulledArticles, deletePulledArticles, updatePulledStatus, initDb } from '../../lib/db'

const parser = new Parser({
  customFields: { item: ['media:content', 'media:thumbnail', 'enclosure'] },
})

function extractFirstImage(html = '') {
  const match = html.match(/<img[^>]+src=['"]([^'"]+)['"]/i)
  return match ? match[1] : ''
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
    sourceId: source.id,
    sourceName: source.name,
    sourceType: 'rss',
  })).filter(i => i.url)
}

async function fetchScrape(source) {
  // For scrape type: treat URL as article URL OR as a page to discover links from
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 1CWAgent/1.0)', 'Accept': 'text/html' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()
  const $ = cheerio.load(html)

  // Try to discover article links from the page
  const links = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    const text = $(el).text().trim()
    if (!href || text.length < 20) return
    // Resolve relative URLs
    let url = href
    try {
      url = new URL(href, source.url).href
    } catch {}
    if (url.startsWith('http') && !links.find(l => l.url === url)) {
      links.push({
        url,
        title: text.slice(0, 200),
        summary: '',
        content: '',
        image: '',
        pubDate: new Date().toISOString(),
        sourceId: source.id,
        sourceName: source.name,
        sourceType: 'scrape',
      })
    }
  })

  // If no links found, treat the URL itself as the article
  if (!links.length) {
    const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || source.url
    const image = $('meta[property="og:image"]').attr('content') || ''
    const summary = $('meta[property="og:description"]').attr('content') || ''
    links.push({
      url: source.url, title, summary, content: '', image,
      pubDate: new Date().toISOString(),
      sourceId: source.id, sourceName: source.name, sourceType: 'scrape',
    })
  }

  return links.slice(0, source.maxArticles || 10)
}


async function resolveYouTubeChannelId(url) {
  // Direct channel ID in URL
  const channelMatch = url.match(/youtube\.com\/channel\/([A-Za-z0-9_-]{20,})/)
  if (channelMatch) return channelMatch[1]

  // Fetch channel page with proper browser headers
  const channelUrl = url.includes('youtube.com') ? url.replace(/\/$/, '') : `https://www.youtube.com/${url}`
  const r = await fetch(channelUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  })
  if (!r.ok) throw new Error(`YouTube channel page ${r.status}`)
  const html = await r.text()

  // Multiple patterns — try all
  const patterns = [
    /"channelId":"([A-Za-z0-9_-]{20,})"/,
    /"externalId":"([A-Za-z0-9_-]{20,})"/,
    /\/channel\/([A-Za-z0-9_-]{20,})"/,
    /"browseId":"([A-Za-z0-9_-]{20,})"/,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1] && m[1].startsWith('UC')) return m[1]
  }

  // Last resort: look for any UCxxxxxxx pattern
  const ucMatch = html.match(/UC[A-Za-z0-9_-]{21,}/)
  if (ucMatch) return ucMatch[0]

  throw new Error(`Could not resolve channel ID from ${url} (html length: ${html.length})`)
}

async function fetchYouTube(source) {
  const url = source.url.trim()
  const max = source.maxArticles || 10

  // Resolve channel ID
  let channelId
  try {
    channelId = await resolveYouTubeChannelId(url)
  } catch (e) {
    console.error('[pull-source] YouTube channel ID resolve failed:', e.message)
    return []
  }

  // YouTube RSS feed — official, no API key, no scraping
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const r = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/atom+xml,application/xml,text/xml' }
  })
  if (!r.ok) throw new Error(`YouTube RSS ${r.status}`)
  const xml = await r.text()

  // Parse Atom feed manually (no xml parser needed)
  const entries = xml.split('<entry>').slice(1)
  const videos = []
  for (const entry of entries.slice(0, max)) {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>') || ''
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1]
    const description = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1]?.trim().slice(0, 300) || ''
    if (!videoId || !title) continue
    videos.push({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      summary: description || `Watch: ${title}`,
      image: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      content: '',
      pubDate: published || null,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: 'youtube',
    })
  }
  return videos
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    const { urls } = req.body
    if (!urls?.length) return res.status(400).json({ error: 'urls required' })
    try {
      await deletePulledArticles(urls)
      return res.status(200).json({ deleted: urls.length })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'PATCH') {
    const { urls, status } = req.body
    if (!urls?.length || !status) return res.status(400).json({ error: 'urls and status required' })
    try {
      await updatePulledStatus(urls, status)
      return res.status(200).json({ updated: urls.length })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { source, dateRange = 'all', refresh = false } = req.body

  try {
    await initDb()

    if (refresh && source) {
      // Fetch fresh items and upsert
      let items = []
      try {
        if (source.type === 'rss') {
          items = await fetchRSS(source)
        } else if (source.type === 'youtube') {
          items = await fetchYouTube(source)
        } else if (source.type === 'scrape') {
          items = await fetchScrape(source)
        }
        await upsertPulledArticles(items)
      } catch (fetchErr) {
        console.error(`[pull-source] fetch failed for ${source.name}:`, fetchErr.message)
      }
    }

    // Return from DB
    const sourceIds = source ? [source.id] : null
    const rows = await getPulledArticles({ sourceIds, dateRange: dateRange === 'all' ? null : dateRange, limit: 200 })

    const articles = rows.map(r => ({
      url: r.url,
      link: r.url,
      title: r.title,
      summary: r.summary,
      image: r.image,
      sourceId: r.source_id,
      sourceName: r.source_name,
      sourceType: r.source_type,
      pubDate: r.pub_date,
      pulledAt: r.pulled_at,
      status: r.status,
      content: r.content,
      dbId: r.id,
    }))

    return res.status(200).json({ articles, total: articles.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
