import { getDb } from '../../lib/db'

// Export getDb — need to expose it
import { neon } from '@neondatabase/serverless'
function getDbLocal() {
  const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL
  if (!url) throw new Error('No DB URL')
  return neon(url)
}

export default async function handler(req, res) {
  try {
    const sql = getDbLocal()
    const rows = await sql`SELECT url FROM seen_urls ORDER BY seen_at DESC LIMIT 2000`
    return res.json({ urls: rows.map(r => r.url) })
  } catch (err) {
    return res.status(500).json({ error: err.message, urls: [] })
  }
}
