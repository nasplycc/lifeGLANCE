import { Router } from 'express';
import { getDb, queryAll, queryOne, run } from './db.js';
import { authMiddleware } from './auth.js';

const router = Router();

// All milestone routes require auth
router.use(authMiddleware);

// GET /api/milestones — list all for current user
router.get('/', async (req, res) => {
  await getDb();
  const rows = queryAll('SELECT * FROM milestones WHERE user_id = ? ORDER BY date ASC', [req.user.id]);
  for (const row of rows) {
    const photo = queryOne('SELECT id FROM media WHERE milestone_id = ? AND kind = ? AND user_id = ?', [row.id, 'photo', req.user.id]);
    row.has_photo = !!row.has_photo || !!photo;
  }
  res.json(rows);
});

// GET /api/milestones/:id
router.get('/:id', async (req, res) => {
  await getDb();
  const row = queryOne('SELECT * FROM milestones WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: 'not found' });
  const photo = queryOne('SELECT id FROM media WHERE milestone_id = ? AND kind = ? AND user_id = ?', [row.id, 'photo', req.user.id]);
  row.has_photo = !!row.has_photo || !!photo;
  res.json(row);
});

// POST /api/milestones — create
router.post('/', async (req, res) => {
  await getDb();
  const m = req.body;
  if (!m.id) return res.status(400).json({ error: 'milestone id is required' });
  run(`INSERT OR REPLACE INTO milestones (id, user_id, title, date, date_precision, direction, category, color,
    note, has_photo, media_type, url, recurrence, recurrence_id, mainTimelineVisibility,
    created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    m.id, req.user.id, m.title, m.date, m.date_precision || 'day', m.direction || 'past', m.category || 'personal', m.color || null,
    m.note || '', m.has_photo ? 1 : 0, m.media_type || null, m.url || '',
    m.recurrence || null, m.recurrence_id || null,
    m.mainTimelineVisibility || 'inherit',
    m.created_at || new Date().toISOString(),
    m.updated_at || new Date().toISOString()
  ]);
  const created = queryOne('SELECT * FROM milestones WHERE id = ?', [m.id]);
  if (!created) return res.status(500).json({ error: '创建后查询失败' });
  created.has_photo = !!created.has_photo;
  res.status(201).json(created);
});

// PUT /api/milestones/:id — update
router.put('/:id', async (req, res) => {
  await getDb();
  const existing = queryOne('SELECT * FROM milestones WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const m = req.body;
  run(`UPDATE milestones SET title=?, date=?, date_precision=?, direction=?, category=?, color=?,
    note=?, has_photo=?, media_type=?, url=?, recurrence=?, recurrence_id=?,
    mainTimelineVisibility=?, updated_at=?
    WHERE id=? AND user_id=?`, [
    m.title ?? existing.title,
    m.date ?? existing.date,
    m.date_precision ?? existing.date_precision,
    m.direction ?? existing.direction,
    m.category ?? existing.category,
    m.color ?? existing.color,
    m.note ?? existing.note,
    (m.has_photo !== undefined ? (m.has_photo ? 1 : 0) : existing.has_photo),
    m.media_type !== undefined ? m.media_type : existing.media_type,
    m.url ?? existing.url,
    m.recurrence !== undefined ? m.recurrence : existing.recurrence,
    m.recurrence_id !== undefined ? m.recurrence_id : existing.recurrence_id,
    m.mainTimelineVisibility ?? existing.mainTimelineVisibility,
    new Date().toISOString(),
    req.params.id,
    req.user.id
  ]);
  const updated = queryOne('SELECT * FROM milestones WHERE id = ?', [req.params.id]);
  if (!updated) return res.status(500).json({ error: '更新后查询失败' });
  updated.has_photo = !!updated.has_photo;
  res.json(updated);
});

// DELETE /api/milestones/series/:recurrenceId
router.delete('/series/:recurrenceId', async (req, res) => {
  await getDb();
  const members = queryAll('SELECT id FROM milestones WHERE recurrence_id = ? AND user_id = ?',
    [req.params.recurrenceId, req.user.id]);
  const ids = members.map(m => m.id);
  if (ids.length > 0) {
    for (const id of ids) {
      run('DELETE FROM media WHERE milestone_id = ? AND user_id = ?', [id, req.user.id]);
    }
    run('DELETE FROM milestones WHERE recurrence_id = ? AND user_id = ?',
      [req.params.recurrenceId, req.user.id]);
  }
  res.json({ ok: true, deleted: ids.length });
});

// DELETE /api/milestones/:id
router.delete('/:id', async (req, res) => {
  await getDb();
  const existing = queryOne('SELECT * FROM milestones WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  run('DELETE FROM media WHERE milestone_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  run('DELETE FROM milestones WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// POST /api/milestones/restore — bulk restore (replaces all for this user)
router.post('/restore', async (req, res) => {
  await getDb();
  const items = req.body;
  // Only delete milestones and media NOT in the restore set
  const incomingIds = items.map(m => m.id).filter(Boolean);
  if (incomingIds.length > 0) {
    const placeholders = incomingIds.map(() => '?').join(',');
    run(`DELETE FROM media WHERE milestone_id IN (SELECT id FROM milestones WHERE user_id = ? AND id NOT IN (${placeholders}))`, [req.user.id, ...incomingIds]);
    run(`DELETE FROM milestones WHERE user_id = ? AND id NOT IN (${placeholders})`, [req.user.id, ...incomingIds]);
  } else {
    run('DELETE FROM media WHERE milestone_id IN (SELECT id FROM milestones WHERE user_id = ?)', [req.user.id]);
    run('DELETE FROM milestones WHERE user_id = ?', [req.user.id]);
  }
  const insert = `INSERT OR REPLACE INTO milestones (id, user_id, title, date, date_precision, direction, category, color,
    note, has_photo, media_type, url, recurrence, recurrence_id, mainTimelineVisibility,
    created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const m of items) {
    run(insert, [
      m.id, req.user.id, m.title, m.date, m.date_precision || 'day', m.direction, m.category,
      m.color || null, m.note || '', m.has_photo ? 1 : 0, m.media_type || null,
      m.url || '', m.recurrence || null, m.recurrence_id || null,
      m.mainTimelineVisibility || 'inherit',
      m.created_at || new Date().toISOString(),
      m.updated_at || new Date().toISOString()
    ]);
  }
  res.json({ ok: true, count: items.length });
});

export default router;
