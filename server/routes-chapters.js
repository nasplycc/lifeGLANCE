import { Router } from 'express';
import { getDb, queryAll, queryOne, run } from './db.js';
import { authMiddleware } from './auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/chapters
router.get('/', async (req, res) => {
  await getDb();
  const rows = queryAll('SELECT * FROM chapters WHERE user_id = ? ORDER BY start ASC', [req.user.id]);
  for (const row of rows) {
    row.milestoneIds = JSON.parse(row.milestoneIds);
  }
  res.json(rows);
});

// GET /api/chapters/:id
router.get('/:id', async (req, res) => {
  await getDb();
  const row = queryOne('SELECT * FROM chapters WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: 'not found' });
  row.milestoneIds = JSON.parse(row.milestoneIds);
  res.json(row);
});

// POST /api/chapters
router.post('/', async (req, res) => {
  await getDb();
  const c = req.body;
  run(`INSERT INTO chapters (id, user_id, title, start, end, color, description,
    defaultMemberVisibility, parentChapterId, milestoneIds, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    c.id, req.user.id, c.title, c.start, c.end || null, c.color || null,
    c.description || '', c.defaultMemberVisibility || 'shown',
    c.parentChapterId || null,
    JSON.stringify(c.milestoneIds || []),
    c.created_at || new Date().toISOString(),
    c.updated_at || new Date().toISOString()
  ]);
  const created = queryOne('SELECT * FROM chapters WHERE id = ?', [c.id]);
  created.milestoneIds = JSON.parse(created.milestoneIds);
  res.status(201).json(created);
});

// PUT /api/chapters/:id
router.put('/:id', async (req, res) => {
  await getDb();
  const existing = queryOne('SELECT * FROM chapters WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const c = req.body;
  const milestoneIdsJson = JSON.stringify(c.milestoneIds ?? JSON.parse(existing.milestoneIds));
  run(`UPDATE chapters SET title=?, start=?, end=?, color=?, description=?,
    defaultMemberVisibility=?, parentChapterId=?, milestoneIds=?, updated_at=?
    WHERE id=? AND user_id=?`, [
    c.title ?? existing.title,
    c.start ?? existing.start,
    c.end !== undefined ? c.end : existing.end,
    c.color ?? existing.color,
    c.description ?? existing.description,
    c.defaultMemberVisibility ?? existing.defaultMemberVisibility,
    c.parentChapterId !== undefined ? c.parentChapterId : existing.parentChapterId,
    milestoneIdsJson,
    new Date().toISOString(),
    req.params.id,
    req.user.id
  ]);
  const updated = queryOne('SELECT * FROM chapters WHERE id = ?', [req.params.id]);
  updated.milestoneIds = JSON.parse(updated.milestoneIds);
  res.json(updated);
});

// DELETE /api/chapters/:id
router.delete('/:id', async (req, res) => {
  await getDb();
  const existing = queryOne('SELECT * FROM chapters WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  run('DELETE FROM chapters WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// POST /api/chapters/restore — bulk restore
router.post('/restore', async (req, res) => {
  await getDb();
  const items = req.body;
  run('DELETE FROM chapters WHERE user_id = ?', [req.user.id]);
  for (const c of items) {
    run(`INSERT INTO chapters (id, user_id, title, start, end, color, description,
      defaultMemberVisibility, parentChapterId, milestoneIds, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      c.id, req.user.id, c.title, c.start, c.end || null, c.color || null,
      c.description || '', c.defaultMemberVisibility || 'shown',
      c.parentChapterId || null,
      JSON.stringify(c.milestoneIds || []),
      c.created_at || new Date().toISOString(),
      c.updated_at || new Date().toISOString()
    ]);
  }
  res.json({ ok: true, count: items.length });
});

export default router;