import { Router } from 'express';
import multer from 'multer';
import { getDb, queryAll, queryOne, run } from './db.js';
import { authMiddleware, optionalAuth } from './auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('只支持音频文件'));
  }
});

// Public endpoints — accessible without auth (must be before authMiddleware)
router.get('/public', optionalAuth, async (req, res) => {
  await getDb();
  const rows = queryAll(
    'SELECT id, user_id, title, artist, mime_type, duration, created_at FROM music_library ORDER BY created_at DESC',
    []
  );
  res.json(rows);
});

// GET /api/music/:id/stream — stream audio (public, no auth required for <audio> element)
router.get('/:id/stream', optionalAuth, async (req, res) => {
  await getDb();
  const row = queryOne(
    'SELECT * FROM music_library WHERE id = ?',
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: 'not found' });

  res.set('Content-Type', row.mime_type);
  res.set('Cache-Control', 'private, max-age=31536000');
  res.set('Accept-Ranges', 'bytes');

  const buffer = Buffer.from(row.data);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
    res.status(206);
    res.set('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
    res.set('Content-Length', end - start + 1);
    res.send(buffer.slice(start, end + 1));
  } else {
    res.set('Content-Length', buffer.length);
    res.send(buffer);
  }
});

router.use(authMiddleware);

// Admin check helper
function isAdmin(req) {
  return req.user && req.user.username === 'jaben';
}

// GET /api/music — list all music (admin can see everything)
router.get('/', async (req, res) => {
  await getDb();
  const rows = queryAll(
    'SELECT id, user_id, title, artist, mime_type, duration, created_at FROM music_library ORDER BY created_at DESC',
    []
  );
  res.json(rows);
});

// POST /api/music — upload a music file (admin only)
router.post('/', upload.single('file'), async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '仅管理员可上传音乐' });

  await getDb();
  const file = req.file;
  if (!file) return res.status(400).json({ error: '请选择音频文件' });

  const { title, artist } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: '歌曲名不能为空' });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  run(`INSERT INTO music_library (id, user_id, title, artist, mime_type, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    id, req.user.id, title.trim(), artist?.trim() || '',
    file.mimetype, file.buffer, now
  ]);

  res.status(201).json({
    id, title: title.trim(), artist: artist?.trim() || '',
    mime_type: file.mimetype, created_at: now
  });
});



// PUT /api/music/:id — update title/artist (admin only)
router.put('/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '仅管理员可修改音乐' });

  await getDb();
  const existing = queryOne(
    'SELECT * FROM music_library WHERE id = ?',
    [req.params.id]
  );
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { title, artist } = req.body;
  run('UPDATE music_library SET title = ?, artist = ? WHERE id = ?', [
    title ?? existing.title,
    artist ?? existing.artist,
    req.params.id
  ]);

  const updated = queryOne('SELECT * FROM music_library WHERE id = ?', [req.params.id]);
  res.json(updated);
});

// DELETE /api/music/:id (admin only)
router.delete('/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '仅管理员可删除音乐' });

  await getDb();
  const existing = queryOne(
    'SELECT * FROM music_library WHERE id = ?',
    [req.params.id]
  );
  if (!existing) return res.status(404).json({ error: 'not found' });

  run('DELETE FROM music_library WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
