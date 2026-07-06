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
  await sql`
    CREATE TABLE IF NOT EXISTS pulled_articles (
      id SERIAL PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      title TEXT,
      summary TEXT,
      image TEXT,
      source_id TEXT,
      source_name TEXT,
      source_type TEXT DEFAULT 'rss',
      pub_date TIMESTAMPTZ,
      pulled_at TIMESTAMPTZ DEFAULT NOW(),
      status TEXT DEFAULT 'new',
      content TEXT
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'rss',
      url TEXT,
      active BOOLEAN DEFAULT true,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS authors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS generated_queue (
      id TEXT PRIMARY KEY,
      item JSONB NOT NULL,
      article JSONB,
      status TEXT DEFAULT 'generating',
      error TEXT,
      source_url TEXT,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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

// ── Pulled articles ───────────────────────────────────────
export async function upsertPulledArticles(items) {
  if (!items.length) return []
  const sql = getDb()
  await initDb()
  const inserted = []
  for (const item of items) {
    try {
      const rows = await sql`
        INSERT INTO pulled_articles (url, title, summary, image, source_id, source_name, source_type, pub_date, content)
        VALUES (${item.url}, ${item.title}, ${item.summary || ''}, ${item.image || ''}, ${item.sourceId}, ${item.sourceName}, ${item.sourceType || 'rss'}, ${item.pubDate ? new Date(item.pubDate) : null}, ${item.content || ''})
        ON CONFLICT (url) DO NOTHING
        RETURNING id, url
      `
      if (rows.length) inserted.push(item.url)
    } catch {}
  }
  return inserted
}

export async function getPulledArticles({ sourceIds, dateRange, status, limit = 100 } = {}) {
  const sql = getDb()
  await initDb()

  let cutoff = null
  if (dateRange === 'today') cutoff = new Date(new Date().setHours(0,0,0,0))
  else if (dateRange === 'week') cutoff = new Date(Date.now() - 7 * 86400000)
  else if (dateRange === '3days') cutoff = new Date(Date.now() - 3 * 86400000)

  // Build query dynamically
  let rows
  if (cutoff && sourceIds?.length) {
    rows = await sql`
      SELECT * FROM pulled_articles
      WHERE pulled_at >= ${cutoff}
        AND source_id = ANY(${sourceIds})
        AND (${status ? sql`status = ${status}` : sql`TRUE`})
      ORDER BY pulled_at DESC
      LIMIT ${limit}
    `
  } else if (cutoff) {
    rows = await sql`
      SELECT * FROM pulled_articles
      WHERE pulled_at >= ${cutoff}
        AND (${status ? sql`status = ${status}` : sql`TRUE`})
      ORDER BY pulled_at DESC
      LIMIT ${limit}
    `
  } else if (sourceIds?.length) {
    rows = await sql`
      SELECT * FROM pulled_articles
      WHERE source_id = ANY(${sourceIds})
        AND (${status ? sql`status = ${status}` : sql`TRUE`})
      ORDER BY pulled_at DESC
      LIMIT ${limit}
    `
  } else {
    rows = await sql`
      SELECT * FROM pulled_articles
      WHERE (${status ? sql`status = ${status}` : sql`TRUE`})
      ORDER BY pulled_at DESC
      LIMIT ${limit}
    `
  }
  return rows
}

export async function updatePulledStatus(urls, status) {
  if (!urls.length) return
  const sql = getDb()
  await sql`UPDATE pulled_articles SET status = ${status} WHERE url = ANY(${urls})`
}

export async function deletePulledArticles(urls) {
  if (!urls.length) return
  const sql = getDb()
  await sql`DELETE FROM pulled_articles WHERE url = ANY(${urls})`
}

// ── Sources ───────────────────────────────────────────────
export async function getSources() {
  const sql = getDb(); await initDb()
  return sql`SELECT * FROM sources ORDER BY created_at ASC`
}

export async function upsertSource(src) {
  const sql = getDb()
  const { id, name, type, url, active, ...rest } = src
  await sql`
    INSERT INTO sources (id, name, type, url, active, config)
    VALUES (${id}, ${name}, ${type || 'rss'}, ${url || ''}, ${active !== false}, ${JSON.stringify(rest)})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, type = EXCLUDED.type, url = EXCLUDED.url,
      active = EXCLUDED.active, config = EXCLUDED.config
  `
}

export async function deleteSources(ids) {
  if (!ids.length) return
  const sql = getDb()
  await sql`DELETE FROM sources WHERE id = ANY(${ids})`
}

// ── Authors ───────────────────────────────────────────────
export async function getAuthors() {
  const sql = getDb()
  return sql`SELECT * FROM authors ORDER BY created_at ASC`
}

export async function upsertAuthor(author) {
  const sql = getDb()
  const { id, name, ...rest } = author
  await sql`
    INSERT INTO authors (id, name, config)
    VALUES (${id}, ${name}, ${JSON.stringify(rest)})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, config = EXCLUDED.config
  `
}

export async function deleteAuthor(id) {
  const sql = getDb()
  await sql`DELETE FROM authors WHERE id = ${id}`
}

// ── App settings ──────────────────────────────────────────
export async function getAppSettings() {
  const sql = getDb()
  const rows = await sql`SELECT key, value FROM app_settings`
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

export async function setAppSetting(key, value) {
  const sql = getDb()
  await sql`
    INSERT INTO app_settings (key, value) VALUES (${key}, ${JSON.stringify(value)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `
}

// ── Generated queue ───────────────────────────────────────
export async function getGeneratedQueue({ limit = 200 } = {}) {
  const sql = getDb()
  return sql`SELECT * FROM generated_queue ORDER BY generated_at DESC LIMIT ${limit}`
}

export async function upsertGenerated(item) {
  const sql = getDb()
  await sql`
    INSERT INTO generated_queue (id, item, article, status, error, source_url, generated_at)
    VALUES (${item.id}, ${JSON.stringify(item.item)}, ${item.article ? JSON.stringify(item.article) : null}, ${item.status}, ${item.error || null}, ${item.item?.url || ''}, ${new Date(item.generatedAt || Date.now())})
    ON CONFLICT (id) DO UPDATE SET
      article = EXCLUDED.article, status = EXCLUDED.status,
      error = EXCLUDED.error
  `
}

export async function deleteGenerated(ids) {
  if (!ids.length) return
  const sql = getDb()
  await sql`DELETE FROM generated_queue WHERE id = ANY(${ids})`
}

export async function clearPublishedFromQueue() {
  const sql = getDb()
  await sql`DELETE FROM generated_queue WHERE article->>'wpPostId' IS NOT NULL`
}
