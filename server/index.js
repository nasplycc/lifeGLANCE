import express from 'express';
import cors from 'cors';
import { getDb, queryAll, queryOne, run, closeDb } from './db.js';
import { authMiddleware } from './auth.js';
import milestonesRouter from './routes-milestones.js';
import chaptersRouter from './routes-chapters.js';
import mediaRouter from './routes-media.js';
import authRouter from './routes-auth.js';
import accountRouter from './routes-account.js';
import musicRouter from './routes-music.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Auth routes (no auth)
app.use('/api/auth', authRouter);

// Account management (auth required)
app.use('/api/account', accountRouter);

// Music library (auth required)
app.use('/api/music', musicRouter);

// Protected routes
app.use('/api/milestones', milestonesRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/media', mediaRouter);

// Storage info (auth required)
app.get('/api/storage', authMiddleware, async (req, res) => {
  await getDb();
  const milestones = queryOne('SELECT COUNT(*) as count FROM milestones WHERE user_id = ?', [req.user.id]);
  const chapters = queryOne('SELECT COUNT(*) as count FROM chapters WHERE user_id = ?', [req.user.id]);
  const mediaSize = queryOne('SELECT COALESCE(SUM(LENGTH(data)), 0) as size FROM media WHERE user_id = ?', [req.user.id]);
  const musicCount = queryOne('SELECT COUNT(*) as count FROM music_library', []);
  res.json({
    milestones: milestones.count,
    chapters: chapters.count,
    mediaBytes: mediaSize.size,
    musicTracks: musicCount.count,
  });
});

// Clear all user data (auth required)
app.delete('/api/user/data', authMiddleware, async (req, res) => {
  await getDb();
  run('DELETE FROM media WHERE user_id = ?', [req.user.id]);
  run('DELETE FROM milestones WHERE user_id = ?', [req.user.id]);
  run('DELETE FROM chapters WHERE user_id = ?', [req.user.id]);
  console.log(`[user-data] Cleared all data for user ${req.user.id}`);
  res.json({ ok: true });
});

// Sync export (auth required)
app.get('/api/sync/export', authMiddleware, async (_req, res) => {
  await getDb();
  const milestones = queryAll('SELECT * FROM milestones WHERE user_id = ? ORDER BY date ASC', [_req.user.id]);
  const chapters = queryAll('SELECT * FROM chapters WHERE user_id = ? ORDER BY start ASC', [_req.user.id]);
  for (const m of milestones) {
    const photo = queryOne('SELECT id FROM media WHERE milestone_id = ? AND kind = ? AND user_id = ?', [m.id, 'photo', _req.user.id]);
    m.has_photo = !!m.has_photo || !!photo;
  }
  for (const c of chapters) c.milestoneIds = JSON.parse(c.milestoneIds);
  res.json({ milestones, chapters });
});

// Sync import (auth required, user-scoped)
app.post('/api/sync/import', authMiddleware, async (req, res) => {
  try {
    await getDb();
    const { milestones, chapters } = req.body;

    console.log(`[sync-import] user=${req.user.id} milestones=${milestones?.length || 0} chapters=${chapters?.length || 0}`);

    if (!Array.isArray(milestones)) {
      return res.status(400).json({ error: 'milestones must be an array' });
    }

    // DO NOT delete remote data — this is a MERGE, not a replace.
    // The client should send the full merged set, but even if it doesn't,
    // existing server data that's not in the payload must be preserved.
    // Only INSERT OR REPLACE — never DELETE.

    if (milestones.length) {
      const insertSql = `INSERT OR REPLACE INTO milestones (id, user_id, title, date, date_precision, direction, category, color,
        note, has_photo, media_type, url, recurrence, recurrence_id, mainTimelineVisibility,
        created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const m of milestones) {
        if (!m.id || !m.title || !m.date) {
          console.warn('[sync-import] Skipping invalid milestone:', m.id, m.title);
          continue;
        }
        run(insertSql, [
          m.id, req.user.id, m.title, m.date, m.date_precision || 'day', m.direction || 'past', m.category || 'personal',
          m.color || null, m.note || '', m.has_photo ? 1 : 0, m.media_type || null,
          m.url || '', m.recurrence || null, m.recurrence_id || null,
          m.mainTimelineVisibility || 'inherit',
          m.created_at || new Date().toISOString(),
          m.updated_at || new Date().toISOString()
        ]);
      }
    }

    if (chapters?.length) {
      const insertCh = `INSERT OR REPLACE INTO chapters (id, user_id, title, start, end, color, description,
        defaultMemberVisibility, parentChapterId, milestoneIds, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const c of chapters) {
        if (!c.id || !c.title || !c.start) {
          console.warn('[sync-import] Skipping invalid chapter:', c.id, c.title);
          continue;
        }
        run(insertCh, [
          c.id, req.user.id, c.title, c.start, c.end || null, c.color || null,
          c.description || '', c.defaultMemberVisibility || 'shown',
          c.parentChapterId || null,
          JSON.stringify(c.milestoneIds || []),
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString()
        ]);
      }
    }

    console.log(`[sync-import] Done. Saved ${milestones.length} milestones, ${chapters?.length || 0} chapters for user ${req.user.id}`);
    res.json({ ok: true, saved: { milestones: milestones.length, chapters: chapters?.length || 0 } });
  } catch (err) {
    console.error('[sync-import] Error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[timora-server] running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[timora-server] shutting down, saving db…');
  closeDb();
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[timora-server] shutting down, saving db…');
  closeDb();
  process.exit(0);
});
