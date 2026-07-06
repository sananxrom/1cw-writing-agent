// ONE-TIME USE — delete this file after use
import { neon } from '@neondatabase/serverless'
export default async function handler(req, res) {
  if (req.query.confirm !== 'yes-wipe-everything') return res.status(400).json({ error: 'add ?confirm=yes-wipe-everything' })
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL)
  await sql`TRUNCATE pulled_articles, articles, seen_urls, generation_log, generated_queue RESTART IDENTITY CASCADE`
  return res.json({ ok: true, wiped: ['pulled_articles','articles','seen_urls','generation_log','generated_queue'], note: 'Also clear localStorage: run localStorage.clear() in browser console' })
}
