// pages/api/get-article.js
// Fetch full article from DB by ID for re-editing

import { initDb } from '../../lib/db'
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id required' })

  try {
    const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL)
    await initDb()
    const rows = await sql`SELECT * FROM articles WHERE id = ${parseInt(id)}`
    if (!rows.length) return res.status(404).json({ error: 'Article not found' })
    const a = rows[0]
    return res.status(200).json({
      title: a.title,
      slug: a.slug,
      body: a.body,
      excerpt: a.excerpt,
      seoTitle: a.seo_title,
      metaDescription: a.meta_description,
      focusKeyword: a.focus_keyword,
      primaryCategory: a.primary_category,
      additionalCategories: a.meta?.additionalCategories || [],
      keywordTags: a.tags?.filter(t => !['India','North America','Europe','Asia-Pacific','China','Latin America','Middle East & Africa'].includes(t)) || [],
      regionTags: a.tags?.filter(t => ['India','North America','Europe','Asia-Pacific','China','Latin America','Middle East & Africa'].includes(t)) || [],
      wordCount: a.word_count,
      sourceUrl: a.source_url,
      sourceName: a.source_name,
      wpPostId: a.wp_post_id,
      status: a.status,
      provider: a.provider,
      model: a.model,
      enableToc: a.meta?.enableToc || false,
      _dbId: a.id,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
