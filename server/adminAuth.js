import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me'
const TOKEN_EXPIRY = '12h'

export function signAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, username: admin.username, isSuper: admin.isSuper },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )
}

export function requireAdmin(req, res, next) {
  const header = req.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })
  try {
    req.admin = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
