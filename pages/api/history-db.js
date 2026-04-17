// pages/api/history-db.js
// Fetch article history from Postgres

import { getArticles, getArticleCount } from '../../lib/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const limit = parseInt(req.query.limit || '50')
    const offset = parseInt(req.query.offset || '0')
    const [articles, total] = await Promise.all([getArticles({ limit, offset }), getArticleCount()])
    return res.status(200).json({ articles, total, limit, offset })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
