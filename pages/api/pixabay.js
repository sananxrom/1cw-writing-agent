// pages/api/pixabay.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query } = req.body
  if (!query) return res.status(400).json({ error: 'Query required' })

  const key = process.env.PIXABAY_API_KEY
  if (!key) return res.status(500).json({ error: 'Pixabay API key not configured' })

  try {
    const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=photo&per_page=9&safesearch=true&orientation=horizontal&min_width=800`
    const r = await fetch(url)
    const data = await r.json()

    const images = (data.hits || []).map(img => ({
      id: img.id,
      previewURL: img.previewURL,
      webformatURL: img.webformatURL,
      largeImageURL: img.largeImageURL,
      tags: img.tags,
      user: img.user,
    }))

    return res.status(200).json({ images })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
