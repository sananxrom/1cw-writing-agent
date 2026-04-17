// pages/api/wordpress.js
// Proxy all WordPress REST API calls server-side so credentials never hit the browser

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { endpoint, method = 'GET', body } = req.body

  const wpUrl = process.env.WP_URL?.replace(/\/$/, '')
  const wpUser = process.env.WP_USER
  const wpPassword = process.env.WP_PASSWORD

  if (!wpUrl || !wpUser || !wpPassword) {
    return res.status(500).json({ error: 'WordPress credentials not configured in environment variables' })
  }

  const credentials = Buffer.from(`${wpUser}:${wpPassword}`).toString('base64')
  const url = `${wpUrl}/wp-json/wp/v2/${endpoint}`

  try {
    const wpRes = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await wpRes.json()

    if (!wpRes.ok) {
      return res.status(wpRes.status).json({ error: data?.message || 'WordPress API error', details: data })
    }

    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
