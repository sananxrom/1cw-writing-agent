// pages/api/scrape.js
// Scrape full article content from a URL server-side

import * as cheerio from 'cheerio'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 1CWAgent/1.0)',
        'Accept': 'text/html',
      },
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove clutter
    $('script, style, nav, footer, header, aside, .ad, .ads, .advertisement, .sidebar, .menu, .comments, .social-share, [class*="cookie"], [class*="popup"], [class*="newsletter"]').remove()

    // Try common article selectors
    const selectors = ['article', '[class*="article-body"]', '[class*="post-content"]', '[class*="entry-content"]', '[class*="story-body"]', 'main', '.content']
    let content = ''
    for (const sel of selectors) {
      const el = $(sel)
      if (el.length && el.text().trim().length > 200) {
        content = el.html() || ''
        break
      }
    }

    if (!content) content = $('body').html() || ''

    // Get meta image
    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('article img').first().attr('src') || ''

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').text().trim() || ''

    // Clean HTML - keep only useful tags
    const clean$ = cheerio.load(content)
    clean$('figure, picture, iframe, form, button, input').remove()
    const cleanContent = clean$.html() || ''

    // Plain text for Claude
    const text = clean$('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000)

    return res.status(200).json({ title, content: cleanContent, text, image })
  } catch (err) {
    return res.status(500).json({ error: `Scrape failed: ${err.message}` })
  }
}
