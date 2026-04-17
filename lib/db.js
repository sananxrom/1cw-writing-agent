// lib/db.js
// Neon Postgres client + schema init + article/log persistence

import { neon } from '@neondatabase/serverless'

function getDb() {
  const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL
  if (!url) throw new Error('No database URL configured in environment variables')
  return neon(url)
}

// Auto-create tables on first use
export async function initDb() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      title TEXT,
      slug TEXT UNIQUE,
      status TEXT DEFAULT 'draft',
      source_url TEXT,
      source_name TEXT,
      wp_post_id INTEGER,
      primary_category TEXT,
      word_count INTEGER DEFAULT 0,
      body TEXT,
      excerpt TEXT,
      seo_title TEXT,
      meta_description TEXT,
      focus_keyword TEXT,
      tags JSONB DEFAULT '[]',
      meta JSONB DEFAULT '{}',
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      published_at TIMESTAMPTZ,
      provider TEXT,
      model TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS seen_urls (
      url TEXT PRIMARY KEY,
      seen_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS generation_log (
      id SERIAL PRIMARY KEY,
      article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
      stage TEXT,
      provider TEXT,
      model TEXT,
      duration_ms INTEGER,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  return true
}

// ── Articles ──────────────────────────────────────────────
export async function saveArticle(data) {
  const sql = getDb()
  await initDb()
  const {
    title, slug, status = 'draft', source_url, source_name,
    wp_post_id, primary_category, word_count, body, excerpt,
    seo_title, meta_description, focus_keyword, tags = [],
    meta = {}, provider, model,
  } = data

  // Upsert by slug
  const rows = await sql`
    INSERT INTO articles (
      title, slug, status, source_url, source_name, wp_post_id,
      primary_category, word_count, body, excerpt, seo_title,
      meta_description, focus_keyword, tags, meta, provider, model
    ) VALUES (
      ${title}, ${slug}, ${status}, ${source_url}, ${source_name}, ${wp_post_id},
      ${primary_category}, ${word_count}, ${body}, ${excerpt}, ${seo_title},
      ${meta_description}, ${focus_keyword}, ${JSON.stringify(tags)},
      ${JSON.stringify(meta)}, ${provider}, ${model}
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      status = EXCLUDED.status,
      wp_post_id = EXCLUDED.wp_post_id,
      word_count = EXCLUDED.word_count,
      body = EXCLUDED.body,
      excerpt = EXCLUDED.excerpt,
      seo_title = EXCLUDED.seo_title,
      meta_description = EXCLUDED.meta_description,
      focus_keyword = EXCLUDED.focus_keyword,
      tags = EXCLUDED.tags,
      meta = EXCLUDED.meta,
      provider = EXCLUDED.provider,
      model = EXCLUDED.model
    RETURNING id
  `
  return rows[0]?.id
}

export async function getArticles({ limit = 50, offset = 0 } = {}) {
  const sql = getDb()
  await initDb()
  return sql`
    SELECT id, title, slug, status, source_url, source_name, wp_post_id,
           primary_category, word_count, provider, model, generated_at, published_at
    FROM articles
    ORDER BY generated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
}

export async function getArticleCount() {
  const sql = getDb()
  await initDb()
  const rows = await sql`SELECT COUNT(*) as count FROM articles`
  return parseInt(rows[0]?.count || '0')
}

// ── Seen URLs ─────────────────────────────────────────────
export async function markUrlSeen(url) {
  const sql = getDb()
  await initDb()
  await sql`
    INSERT INTO seen_urls (url) VALUES (${url})
    ON CONFLICT (url) DO NOTHING
  `
}

export async function isUrlSeen(url) {
  const sql = getDb()
  await initDb()
  const rows = await sql`SELECT 1 FROM seen_urls WHERE url = ${url}`
  return rows.length > 0
}

export async function bulkCheckUrls(urls) {
  if (!urls.length) return {}
  const sql = getDb()
  await initDb()
  const rows = await sql`SELECT url FROM seen_urls WHERE url = ANY(${urls})`
  const seen = new Set(rows.map(r => r.url))
  return Object.fromEntries(urls.map(u => [u, seen.has(u)]))
}

// ── Generation Log ─────────────────────────────────────────
export async function logGeneration({ article_id, stage, provider, model, duration_ms, error }) {
  try {
    const sql = getDb()
    await sql`
      INSERT INTO generation_log (article_id, stage, provider, model, duration_ms, error)
      VALUES (${article_id || null}, ${stage}, ${provider}, ${model}, ${duration_ms}, ${error || null})
    `
  } catch {} // Non-critical, never throw
}
