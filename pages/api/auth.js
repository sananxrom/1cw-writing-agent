export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user, password } = req.body

  const users = [
    { slot: '1', name: process.env.USER1_NAME || 'Sanan', password: process.env.USER1_PASSWORD },
    { slot: '2', name: process.env.USER2_NAME || 'Eddie', password: process.env.USER2_PASSWORD },
  ]

  const match = users.find(u => u.name === user && u.password && u.password === password)
  if (!match) return res.status(401).json({ error: 'Invalid credentials' })

  return res.json({ ok: true, slot: match.slot, name: match.name })
}
