import { Router } from 'express';
import multer from 'multer';
import { getDb, queryOne, run } from './db.js';
import { authMiddleware } from './auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.use(authMiddleware);

// POST /api/media/:milestoneId/:kind  — upload media
router.post('/:milestoneId/:kind', upload.single('file'), async (req, res) => {
  await getDb();
  const { milestoneId, kind } = req.params;

  if (!['photo', 'audio', 'video'].includes(kind)) {
    return res.status(400).json({ error: 'kind must be photo, audio, or video' });
  }

  const milestone = queryOne('SELECT id FROM milestones WHERE id = ? AND user_id = ?', [milestoneId, req.user.id]);
  if (!milestone) return res.status(404).json({ error: 'milestone not found' });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'no file uploaded' });

  const id = `${milestoneId}-${kind}`;
  const now = new Date().toISOString();

  run('DELETE FROM media WHERE id = ? AND user_id = ?', [id, req.user.id]);
  run(`INSERT INTO media (id, user_id, milestone_id, kind, mime_type, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, req.user.id, milestoneId, kind, file.mimetype, file.buffer, now]);

  if (kind === 'photo') {
    run('UPDATE milestones SET has_photo = 1, updated_at = ? WHERE id = ? AND user_id = ?', [now, milestoneId, req.user.id]);
  } else {
    run('UPDATE milestones SET media_type = ?, updated_at = ? WHERE id = ? AND user_id = ?', [kind, now, milestoneId, req.user.id]);
  }

  res.json({ ok: true, id, size: file.size });
});

// GET /api/media/:milestoneId/:kind  — retrieve media blob
router.get('/:milestoneId/:kind', async (req, res) => {
  await getDb();
  const { milestoneId, kind } = req.params;

  if (!['photo', 'audio', 'video'].includes(kind)) {
    return res.status(400).json({ error: 'kind must be photo, audio, or video' });
  }

  // Verify milestone belongs to user
  const milestone = queryOne('SELECT id FROM milestones WHERE id = ? AND user_id = ?', [milestoneId, req.user.id]);
  if (!milestone) return res.status(404).json({ error: 'milestone not found' });

  const row = queryOne('SELECT * FROM media WHERE id = ? AND user_id = ?', [`${milestoneId}-${kind}`, req.user.id]);
  if (!row) return res.status(404).json({ error: 'not found' });

  const data = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
  res.set('Content-Type', row.mime_type);
  res.set('Content-Length', String(data.length));
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.send(data);
});

// DELETE /api/media/:milestoneId/:kind
router.delete('/:milestoneId/:kind', async (req, res) => {
  await getDb();
  const { milestoneId, kind } = req.params;

  if (!['photo', 'audio', 'video'].includes(kind)) {
    return res.status(400).json({ error: 'kind must be photo, audio, or video' });
  }

  const milestone = queryOne('SELECT id FROM milestones WHERE id = ? AND user_id = ?', [milestoneId, req.user.id]);
  if (!milestone) return res.status(404).json({ error: 'milestone not found' });

  const id = `${milestoneId}-${kind}`;
  run('DELETE FROM media WHERE id = ? AND user_id = ?', [id, req.user.id]);

  const now = new Date().toISOString();
  if (kind === 'photo') {
    run('UPDATE milestones SET has_photo = 0, updated_at = ? WHERE id = ? AND user_id = ?', [now, milestoneId, req.user.id]);
  } else {
    run('UPDATE milestones SET media_type = NULL, updated_at = ? WHERE id = ? AND user_id = ?', [now, milestoneId, req.user.id]);
  }

  res.json({ ok: true });
});

// DELETE /api/media/:milestoneId — delete all media for a milestone
router.delete('/:milestoneId', async (req, res) => {
  await getDb();
  const { milestoneId } = req.params;
  const milestone = queryOne('SELECT id FROM milestones WHERE id = ? AND user_id = ?', [milestoneId, req.user.id]);
  if (!milestone) return res.status(404).json({ error: 'milestone not found' });

  run('DELETE FROM media WHERE milestone_id = ? AND user_id = ?', [milestoneId, req.user.id]);
  const now = new Date().toISOString();
  run('UPDATE milestones SET has_photo = 0, media_type = NULL, updated_at = ? WHERE id = ? AND user_id = ?', [now, milestoneId, req.user.id]);
  res.json({ ok: true });
});

export default router;
