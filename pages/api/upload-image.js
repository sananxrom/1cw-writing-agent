// pages/api/upload-image.js
// Fetch image from URL and upload to WordPress Media Library

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { imageUrl, filename, altText, caption, imageTitle } = req.body
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' })

  const wpUrl = process.env.WP_URL?.replace(/\/$/, '')
  const wpUser = process.env.WP_USER
  const wpPassword = process.env.WP_PASSWORD

  if (!wpUrl || !wpUser || !wpPassword) {
    return res.status(500).json({ error: 'WordPress credentials not configured' })
  }

  try {
    // Fetch the image
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`)

    const buffer = await imgRes.arrayBuffer()
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('webp') ? 'webp' : 'jpg'
    const name = filename || `1cw-image-${Date.now()}.${ext}`

    // Upload to WordPress
    const credentials = Buffer.from(`${wpUser}:${wpPassword}`).toString('base64')
    const uploadRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Type': contentType,
      },
      body: Buffer.from(buffer),
    })

    const uploadData = await uploadRes.json()
    if (!uploadRes.ok) throw new Error(uploadData?.message || 'Upload failed')

    // Set alt text, title, caption if provided
    if ((altText || caption || imageTitle) && uploadData.id) {
      const meta = {}
      if (altText) meta.alt_text = altText
      if (caption) meta.caption = caption
      if (imageTitle) meta.title = imageTitle
      await fetch(`${wpUrl}/wp-json/wp/v2/media/${uploadData.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(meta),
      }).catch(() => {})
    }

    return res.status(200).json({
      id: uploadData.id,
      url: uploadData.source_url,
      thumbnailUrl: uploadData.media_details?.sizes?.thumbnail?.source_url || uploadData.source_url,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
