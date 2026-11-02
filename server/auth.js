import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'timora-secret-change-in-production-2026';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Express middleware: extracts user from Authorization header or ?token= query param
export function authMiddleware(req, res, next) {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// Optional auth: sets req.user if valid token, but doesn't block
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}
