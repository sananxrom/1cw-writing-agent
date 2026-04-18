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
