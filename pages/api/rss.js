// pages/api/rss.js
// Fetch and parse RSS feeds server-side (bypasses CORS)

import Parser from 'rss-parser'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'enclosure'],
  },
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    const feed = await parser.parseURL(url)

    const items = (feed.items || []).slice(0, 20).map(item => ({
      title: item.title || '',
      link: item.link || item.guid || '',
      pubDate: item.pubDate || item.isoDate || '',
      summary: item.contentSnippet || item.summary || item.description || '',
      content: item.content || item['content:encoded'] || '',
      image: item['media:content']?.$.url ||
             item['media:thumbnail']?.$.url ||
             item.enclosure?.url ||
             extractFirstImage(item.content || item['content:encoded'] || '') ||
             '',
      author: item.author || item.creator || '',
    }))

    return res.status(200).json({ title: feed.title, items })
  } catch (err) {
    return res.status(500).json({ error: `RSS fetch failed: ${err.message}` })
  }
}

function extractFirstImage(html) {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match ? match[1] : ''
}
