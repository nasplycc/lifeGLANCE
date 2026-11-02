import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, queryOne, run } from './db.js';
import { authMiddleware } from './auth.js';
import { sendVerificationEmail, generateCode } from './email.js';

const router = Router();

router.use(authMiddleware);

// POST /api/account/send-code — send verification code for account changes
router.post('/send-code', async (req, res) => {
  await getDb();
  const { purpose } = req.body; // 'reset_password' | 'change_email'
  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  if (!['reset_password', 'change_email'].includes(purpose)) {
    return res.status(400).json({ error: '无效的验证码用途' });
  }

  const email = purpose === 'change_email' ? req.body.email : user.email;
  if (!email) {
    return res.status(400).json({ error: '邮箱不能为空' });
  }

  // If changing email, check new email not taken
  if (purpose === 'change_email') {
    const existing = queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (existing) {
      return res.status(409).json({ error: '该邮箱已被其他账号使用' });
    }
  }

  // Rate limit
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

  res.json({ ok: true, message: '验证码已发送', ...(result.dev ? { dev: true } : {}) });
});

// POST /api/account/change-username — change username (requires password)
router.post('/change-username', async (req, res) => {
  await getDb();
  const { newUsername, password } = req.body;

  if (!newUsername || !password) {
    return res.status(400).json({ error: '新用户名和密码不能为空' });
  }
  if (newUsername.length < 2 || newUsername.length > 30) {
    return res.status(400).json({ error: '用户名长度需要 2-30 个字符' });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: '密码错误' });
  }

  const existing = queryOne('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, req.user.id]);
  if (existing) {
    return res.status(409).json({ error: '用户名已被占用' });
  }

  const now = new Date().toISOString();
  run('UPDATE users SET username = ?, updated_at = ? WHERE id = ?', [newUsername, now, req.user.id]);

  res.json({ ok: true, user: { id: user.id, username: newUsername, email: user.email } });
});

// POST /api/account/change-password — change password (requires old password + verification code)
router.post('/change-password', async (req, res) => {
  await getDb();
  const { oldPassword, newPassword, code } = req.body;

  if (!oldPassword || !newPassword || !code) {
    return res.status(400).json({ error: '旧密码、新密码和验证码不能为空' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少需要 6 个字符' });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const match = await bcrypt.compare(oldPassword, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: '旧密码错误' });
  }

  // Verify code
  const record = queryOne(
    "SELECT * FROM verification_codes WHERE email = ? AND purpose = 'reset_password' AND used = 0 ORDER BY created_at DESC LIMIT 1",
    [user.email]
  );
  if (!record || record.code !== code) {
    return res.status(400).json({ error: '验证码错误' });
  }
  if (new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }

  run('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);

  const hashed = await bcrypt.hash(newPassword, 10);
  const now = new Date().toISOString();
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hashed, now, req.user.id]);

  res.json({ ok: true, message: '密码修改成功' });
});

// POST /api/account/change-email — change email (requires verification code for new email)
router.post('/change-email', async (req, res) => {
  await getDb();
  const { newEmail, code } = req.body;

  if (!newEmail || !code) {
    return res.status(400).json({ error: '新邮箱和验证码不能为空' });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  // Check new email not taken
  const existing = queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, req.user.id]);
  if (existing) {
    return res.status(409).json({ error: '该邮箱已被其他账号使用' });
  }

  // Verify code for new email
  const record = queryOne(
    "SELECT * FROM verification_codes WHERE email = ? AND purpose = 'change_email' AND used = 0 ORDER BY created_at DESC LIMIT 1",
    [newEmail]
  );
  if (!record || record.code !== code) {
    return res.status(400).json({ error: '验证码错误' });
  }
  if (new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }

  run('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);

  const now = new Date().toISOString();
  run('UPDATE users SET email = ?, email_verified = 1, updated_at = ? WHERE id = ?', [newEmail, now, req.user.id]);

  res.json({ ok: true, message: '邮箱修改成功', user: { id: user.id, username: user.username, email: newEmail } });
});

export default router;
