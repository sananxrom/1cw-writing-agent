// pages/api/generate.js
// 3-stage pipeline: extract → write → SEO
// Retry logic, rate limiting, DB persistence

import { runPipeline, stageRegen, sleep } from '../../lib/pipeline'
import { saveArticle, logGeneration, markUrlSeen } from '../../lib/db'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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
  const writingProvider = wpOverride || { provider, model, apiKey: apiKey || fallbackKey }
  const editingProvider = epOverride || writingProvider

  if (!writingProvider.apiKey) {
    return res.status(500).json({ error: 'No API key provided. Add one in Settings → AI Providers.' })
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
