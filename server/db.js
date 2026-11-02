import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'timora.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let SQL = null;

async function ensureSql() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
}

function loadOrCreate() {
  let buf;
  try {
    buf = fs.readFileSync(DB_PATH);
  } catch {
    buf = null;
  }
  db = new SQL.Database(buf);
  db.run('PRAGMA journal_mode = WAL');
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasColumn(table, col) {
  try {
    const rows = queryAll(`PRAGMA table_info(${table})`);
    return rows.some(r => r.name === col);
  } catch {
    return false;
  }
}

function hasTable(name) {
  try {
    const row = queryOne("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]);
    return !!row;
  } catch {
    return false;
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────

function initSchema() {
  // 1. Create tables (idempotent — columns added later are safe if table already exists)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE DEFAULT '',
      email_verified INTEGER DEFAULT 0,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT NOT NULL,
      code       TEXT NOT NULL,
      purpose    TEXT NOT NULL CHECK(purpose IN ('register','login','reset_password','change_email')),
      used       INTEGER DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      date           TEXT NOT NULL,
      date_precision TEXT NOT NULL DEFAULT 'month',
      direction      TEXT NOT NULL DEFAULT 'past',
      category       TEXT NOT NULL DEFAULT 'personal',
      color          TEXT,
      note           TEXT DEFAULT '',
      has_photo      INTEGER DEFAULT 0,
      media_type     TEXT,
      url            TEXT DEFAULT '',
      recurrence     TEXT,
      recurrence_id  TEXT,
      mainTimelineVisibility TEXT DEFAULT 'inherit',
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id                      TEXT PRIMARY KEY,
      title                   TEXT NOT NULL,
      start                   TEXT NOT NULL,
      end                     TEXT,
      color                   TEXT,
      description             TEXT DEFAULT '',
      defaultMemberVisibility TEXT DEFAULT 'shown',
      parentChapterId         TEXT,
      milestoneIds            TEXT DEFAULT '[]',
      created_at              TEXT NOT NULL,
      updated_at              TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id             TEXT PRIMARY KEY,
      milestone_id   TEXT NOT NULL,
      kind           TEXT NOT NULL CHECK(kind IN ('photo','audio','video')),
      mime_type      TEXT NOT NULL,
      data           BLOB NOT NULL,
      created_at     TEXT NOT NULL
    );
  `);

  // 2. Migration: add user_id column to existing tables that lack it
  for (const table of ['milestones', 'chapters', 'media']) {
    if (hasTable(table) && !hasColumn(table, 'user_id')) {
      console.log(`[timora-db] Migrating: adding user_id column to ${table}`);
      db.run(`ALTER TABLE ${table} ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
    }
  }

  // 2b. Migration: create music_library table if missing
  if (!hasTable('music_library')) {
    console.log('[timora-db] Migrating: creating music_library table');
    db.run(`
      CREATE TABLE music_library (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL DEFAULT '',
        title       TEXT NOT NULL,
        artist      TEXT DEFAULT '',
        mime_type   TEXT NOT NULL,
        data        BLOB NOT NULL,
        duration    REAL DEFAULT 0,
        created_at  TEXT NOT NULL
      )
    `);
  }

  // 3. Migration: add email/email_verified to users if missing
  if (hasTable('users') && !hasColumn('users', 'email')) {
    console.log('[timora-db] Migrating: adding email column to users');
    db.run("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''");
    db.run('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
  }

  // 3. Create indexes (safe now — all columns exist)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(date);
    CREATE INDEX IF NOT EXISTS idx_milestones_recurrence_id ON milestones(recurrence_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
    CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON chapters(user_id);
    CREATE INDEX IF NOT EXISTS idx_media_milestone_id ON media(milestone_id);
  `);

  saveDb();
}

export async function getDb() {
  if (!db) {
    await ensureSql();
    loadOrCreate();
    initSchema();
  }
  return { db, save: saveDb };
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

// ── Query utilities ───────────────────────────────────────────────────────────

function safeParams(params = []) {
  return params.map(p => p === undefined ? null : p);
}

export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(safeParams(params));
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(safeParams(params));
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

export function run(sql, params = []) {
  const sp = safeParams(params);
  try {
    db.run(sql, sp);
    saveDb();
  } catch (err) {
    console.error('[db.run] Error:', err.message);
    console.error('[db.run] SQL:', sql.substring(0, 120));
    console.error('[db.run] Params:', sp.slice(0, 5));
    throw err;
  }
}
