// pages/api/generate.js
// 3-stage pipeline: extract → write → SEO
// Retry logic, rate limiting, DB persistence

import { runPipeline, stageRegen, sleep } from '../../lib/pipeline'
import { saveArticle, logGeneration, markUrlSeen } from '../../lib/db'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Health ping
  if (req.body._ping) {
    const hasKey = !!(process.env.ANTHROPIC_API_KEY)
    return res.json({ ok: true, hasEnvKey: hasKey })
  }

  const {
    content, title, sourceUrl, sourceName, primaryCategory,
    writingPrompt, authorStyle, postFormat, mode,
    regenerateField, regenerateInstruction, currentArticle,
    // Provider configs from frontend (localStorage)
    provider = 'anthropic', model, apiKey,
    writingProvider: wpOverride,
    editingProvider: epOverride,
    // Rate limiting
    batchIndex = 0, batchDelay = 500,
  } = req.body

  // Resolve keys — frontend passes provider configs, fall back to env
  const fallbackKey = process.env.ANTHROPIC_API_KEY
  const DEFAULT_MODEL = 'claude-sonnet-4-6'
  const DEFAULT_EDIT_MODEL = 'claude-haiku-4-5-20251001'
  const writingProvider = wpOverride
    ? { ...wpOverride, model: wpOverride.model || DEFAULT_MODEL, apiKey: wpOverride.apiKey || fallbackKey }
    : { provider: provider || 'anthropic', model: model || DEFAULT_MODEL, apiKey: apiKey || fallbackKey }
  const editingProvider = epOverride
    ? { ...epOverride, model: epOverride.model || DEFAULT_EDIT_MODEL, apiKey: epOverride.apiKey || fallbackKey }
    : { ...writingProvider, model: writingProvider.model === DEFAULT_MODEL ? DEFAULT_EDIT_MODEL : writingProvider.model }

  if (!writingProvider.apiKey) {
    return res.status(500).json({ error: 'No API key provided. Add one in Settings → Models, or ask admin to set ANTHROPIC_API_KEY in Vercel env.' })
  }

  // Batch delay — prevent hammering APIs
  if (batchIndex > 0 && batchDelay > 0) {
    await sleep(batchIndex * batchDelay)
  }

  // ── Single field regen ──────────────────────────────────
  if (regenerateField && currentArticle) {
    const start = Date.now()
    try {
      const result = await stageRegen({
        field: regenerateField,
        instruction: regenerateInstruction,
        article: currentArticle,
        writingPrompt,
        provider: editingProvider.provider,
        model: editingProvider.model,
        apiKey: editingProvider.apiKey,
      })
      await logGeneration({
        stage: `regen:${regenerateField}`,
        provider: editingProvider.provider,
        model: editingProvider.model,
        duration_ms: Date.now() - start,
      })
      return res.status(200).json(result)
    } catch (err) {
      await logGeneration({
        stage: `regen:${regenerateField}`,
        provider: editingProvider.provider,
        model: editingProvider.model,
        duration_ms: Date.now() - start,
        error: err.message,
      })
      return res.status(500).json({ error: err.message })
    }
  }

  // ── Full pipeline ───────────────────────────────────────
  const start = Date.now()
  try {
    const article = await runPipeline({
      content, title, sourceUrl, sourceName, primaryCategory,
      writingPrompt, authorStyle, postFormat, mode,
      writingProvider, editingProvider,
    })

    // Persist to DB (non-blocking — don't fail if DB is down)
    let articleId = null
    try {
      articleId = await saveArticle({
        title: article.title,
        slug: article.slug,
        status: 'draft',
        source_url: sourceUrl,
        source_name: sourceName,
        primary_category: article.primaryCategory,
        word_count: article.wordCount,
        body: article.body,
        excerpt: article.excerpt,
        seo_title: article.seoTitle,
        meta_description: article.metaDescription,
        focus_keyword: article.focusKeyword,
        tags: [...(article.keywordTags || []), ...(article.regionTags || [])],
        meta: { additionalCategories: article.additionalCategories, enableToc: article.enableToc },
        provider: writingProvider.provider,
        model: writingProvider.model,
      })
      if (sourceUrl) await markUrlSeen(sourceUrl)
    } catch (dbErr) {
      console.error('[generate] DB save failed (non-fatal):', dbErr.message)
    }

    await logGeneration({
      article_id: articleId,
      stage: 'full_pipeline',
      provider: writingProvider.provider,
      model: writingProvider.model,
      duration_ms: Date.now() - start,
    })

    return res.status(200).json({ ...article, _articleId: articleId })
  } catch (err) {
    await logGeneration({
      stage: 'full_pipeline',
      provider: writingProvider.provider,
      model: writingProvider.model,
      duration_ms: Date.now() - start,
      error: err.message,
    })
    return res.status(500).json({ error: err.message })
  }
}
