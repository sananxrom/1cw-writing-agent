import { saveArticle } from '../../lib/db'
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const id = await saveArticle(req.body)
    return res.json({ ok: true, id })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
