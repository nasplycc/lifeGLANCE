import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, queryOne, run } from './db.js';
import { signToken } from './auth.js';
import { sendVerificationEmail, generateCode } from './email.js';

const router = Router();

// POST /api/auth/send-code — send email verification code
router.post('/send-code', async (req, res) => {
  await getDb();
  const { email, purpose } = req.body; // purpose: 'register' | 'login'

  if (!email || !purpose) {
    return res.status(400).json({ error: '邮箱和用途不能为空' });
  }
  if (!['register', 'login', 'reset_password'].includes(purpose)) {
    return res.status(400).json({ error: '无效的验证码用途' });
  }

  // For register: check email not already taken
  if (purpose === 'register') {
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }
  }

  // For login: check email exists
  if (purpose === 'login') {
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (!existing) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }
  }

  // For reset_password: check email exists
  if (purpose === 'reset_password') {
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (!existing) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }
  }

  // Rate limit: max 1 code per email per 60 seconds
  const recent = queryOne(
    "SELECT created_at FROM verification_codes WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1",
    [email, purpose]
  );
  if (recent) {
    const elapsed = Date.now() - new Date(recent.created_at).getTime();
    if (elapsed < 60000) {
      return res.status(429).json({ error: `请等待 ${Math.ceil((60000 - elapsed) / 1000)} 秒后重试` });
    }
  }

  const code = generateCode();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  run(
    'INSERT INTO verification_codes (email, code, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [email, code, purpose, expiresAt, now]
  );

  const result = await sendVerificationEmail(email, code);
  if (!result.ok) {
    return res.status(500).json({ error: '验证码发送失败，请稍后重试' });
  }

  res.json({ ok: true, message: '验证码已发送到邮箱', ...(result.dev ? { dev: true } : {}) });
});

// POST /api/auth/register — register with email + verification code
router.post('/register', async (req, res) => {
  await getDb();
  const { username, email, code, password } = req.body;

  if (!username || !email || !code || !password) {
    return res.status(400).json({ error: '用户名、邮箱、验证码和密码不能为空' });
  }
  if (username.length < 2 || username.length > 30) {
    return res.status(400).json({ error: '用户名长度需要 2-30 个字符' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少需要 6 个字符' });
  }

  // Check username not taken
  const existingUser = queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existingUser) {
    return res.status(409).json({ error: '用户名已被注册' });
  }

  // Check email not taken
  const existingEmail = queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existingEmail) {
    return res.status(409).json({ error: '该邮箱已被注册' });
  }

  // Verify code
  const record = queryOne(
    "SELECT * FROM verification_codes WHERE email = ? AND purpose = 'register' AND used = 0 ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (!record) {
    return res.status(400).json({ error: '请先获取验证码' });
  }
  if (record.code !== code) {
    return res.status(400).json({ error: '验证码错误' });
  }
  if (new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }

  // Mark code as used
  run('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);

  const id = crypto.randomUUID();
  const hashed = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  run('INSERT INTO users (id, username, email, email_verified, password_hash, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
    [id, username, email, hashed, now, now]);

  const token = signToken({ id, username, email });
  res.status(201).json({ token, user: { id, username, email } });
});

// POST /api/auth/login — login with password
router.post('/login', async (req, res) => {
  await getDb();
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = queryOne('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = signToken({ id: user.id, username: user.username, email: user.email });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// GET /api/auth/me — verify token and return user info
router.get('/me', async (req, res) => {
  await getDb();
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const jwt = await import('./auth.js');
    const decoded = jwt.verifyToken(header.slice(7));
    const user = queryOne('SELECT id, username, email, email_verified, created_at FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        email_verified: !!user.email_verified,
        created_at: user.created_at
      }
    });
  } catch {
    res.status(401).json({ error: '登录已过期' });
  }
});

// POST /api/auth/reset-password — reset password with email + verification code (no auth)
router.post('/reset-password', async (req, res) => {
  await getDb();
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: '邮箱、验证码和新密码不能为空' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少需要 6 个字符' });
  }

  const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return res.status(404).json({ error: '该邮箱未注册' });
  }

  // Verify code
  const record = queryOne(
    "SELECT * FROM verification_codes WHERE email = ? AND purpose = 'reset_password' AND used = 0 ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (!record || record.code !== code) {
    return res.status(400).json({ error: '验证码错误' });
  }
  if (new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }

  // Mark code as used
  run('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);

  // Reset password
  const hashed = await bcrypt.hash(newPassword, 10);
  const now = new Date().toISOString();
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hashed, now, user.id]);

  // Return new token so user is logged in after reset
  const token = signToken({ id: user.id, username: user.username, email: user.email });
  res.json({ ok: true, message: '密码重置成功', token, user: { id: user.id, username: user.username, email: user.email } });
});

export default router;
