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


async function fetchYouTube(source) {
  // Scrape YouTube channel page for latest videos — no API needed
  const url = source.url.trim()
  // Normalize: handle @handle, /channel/, /c/ formats
  const channelUrl = url.includes('youtube.com') ? url : `https://www.youtube.com/${url}`
  
  const response = await fetch(channelUrl + '/videos', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!response.ok) throw new Error(`YouTube fetch HTTP ${response.status}`)
  const html = await response.text()
  
  const videos = []
  
  // YouTube embeds video data in ytInitialData JSON
  const match = html.match(/var ytInitialData = ({.+?});<\/script>/)
  if (match) {
    try {
      const data = JSON.parse(match[1])
      // Navigate the nested structure to find video items
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
      for (const tab of tabs) {
        const tabContent = tab?.tabRenderer?.content?.richGridRenderer?.contents || 
                          tab?.tabRenderer?.content?.sectionListRenderer?.contents || []
        for (const section of tabContent) {
          const items = section?.richItemRenderer ? [section.richItemRenderer] :
                       section?.itemSectionRenderer?.contents || []
          for (const item of items) {
            const video = item?.content?.videoRenderer || item?.videoRenderer
            if (!video?.videoId) continue
            const videoId = video.videoId
            const title = video.title?.runs?.[0]?.text || video.title?.simpleText || ''
            const thumb = video.thumbnail?.thumbnails?.slice(-1)[0]?.url || ''
            const description = video.descriptionSnippet?.runs?.map(r => r.text).join('') || ''
            const publishedText = video.publishedTimeText?.simpleText || ''
            videos.push({
              url: `https://www.youtube.com/watch?v=${videoId}`,
              title,
              summary: description || `Watch on YouTube: ${title}`,
              image: (thumb || '').split('?')[0].replace('hqdefault', 'mqdefault') || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              content: '',
              pubDate: null, // YouTube doesn't give exact dates easily
              sourceId: source.id,
              sourceName: source.name,
              sourceType: 'youtube',
            })
            if (videos.length >= (source.maxArticles || 10)) break
          }
          if (videos.length >= (source.maxArticles || 10)) break
        }
        if (videos.length) break
      }
    } catch (parseErr) {
      console.error('[pull-source] YouTube parse error:', parseErr.message)
    }
  }
  
  // Fallback: scrape og:title links if ytInitialData parse failed
  if (!videos.length) {
    const $2 = cheerio.load(html)
    $2('a[href*="/watch?v="]').each((_, el) => {
      const href = $2(el).attr('href')
      const title = $2(el).attr('title') || $2(el).text().trim()
      if (!href || !title || title.length < 5) return
      const videoId = href.match(/v=([^&]+)/)?.[1]
      if (!videoId || videos.find(v => v.url.includes(videoId))) return
      videos.push({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title,
        summary: `YouTube video: ${title}`,
        image: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        content: '',
        pubDate: null,
        sourceId: source.id,
        sourceName: source.name,
        sourceType: 'youtube',
      })
      if (videos.length >= (source.maxArticles || 10)) return false
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
