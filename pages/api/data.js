// pages/api/data.js — unified CRUD for shared data
// sources, authors, settings, generated_queue
import {
  getSources, upsertSource, deleteSources,
  getAuthors, upsertAuthor, deleteAuthor,
  getAppSettings, setAppSetting,
  getGeneratedQueue, upsertGenerated, deleteGenerated, clearPublishedFromQueue,
} from '../../lib/db'

export default async function handler(req, res) {
  const { resource } = req.query

  try {
    // ── Sources ──────────────────────────────────────────
    if (resource === 'sources') {
      if (req.method === 'GET') {
        const rows = await getSources()
        const sources = rows.map(r => ({ id: r.id, name: r.name, type: r.type, url: r.url, active: r.active, ...r.config }))
        return res.json(sources)
      }
      if (req.method === 'PUT') {
        await upsertSource(req.body)
        return res.json({ ok: true })
      }
      if (req.method === 'DELETE') {
        await deleteSources(req.body.ids || [req.body.id])
        return res.json({ ok: true })
      }
    }

    // ── Authors ──────────────────────────────────────────
    if (resource === 'authors') {
      if (req.method === 'GET') {
        const rows = await getAuthors()
        return res.json(rows.map(r => ({ id: r.id, name: r.name, ...r.config })))
      }
      if (req.method === 'PUT') {
        await upsertAuthor(req.body)
        return res.json({ ok: true })
      }
      if (req.method === 'DELETE') {
        await deleteAuthor(req.body.id)
        return res.json({ ok: true })
      }
    }

    // ── Settings ─────────────────────────────────────────
    if (resource === 'settings') {
      if (req.method === 'GET') {
        const s = await getAppSettings()
        return res.json(s)
      }
      if (req.method === 'PUT') {
        const { key, value } = req.body
        await setAppSetting(key, value)
        return res.json({ ok: true })
      }
    }

    // ── Generated queue ───────────────────────────────────
    if (resource === 'generated') {
      if (req.method === 'GET') {
        const rows = await getGeneratedQueue()
        return res.json(rows.map(r => ({
          id: r.id, item: r.item, article: r.article,
          status: r.status, error: r.error,
          generatedAt: new Date(r.generated_at).getTime(),
        })))
      }
      if (req.method === 'PUT') {
        await upsertGenerated(req.body)
        return res.json({ ok: true })
      }
      if (req.method === 'DELETE') {
        const { ids, clearPublished } = req.body
        if (clearPublished) await clearPublishedFromQueue()
        else await deleteGenerated(ids || [])
        return res.json({ ok: true })
      }
    }

    return res.status(404).json({ error: 'Unknown resource' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
