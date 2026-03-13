/**
 * lib/storage/db.ts
 * SQLite singleton via better-sqlite3.
 * Runs only on the server (Next.js API routes / server components).
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH ?? "./database/agileallview.db";
const SCHEMA_PATH = path.join(process.cwd(), "database", "schema.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure directory exists
  const dir = path.dirname(path.resolve(DB_PATH));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(path.resolve(DB_PATH));
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Run schema on first open
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  _db.exec(schema);

  // Best-effort schema upgrades for existing DBs
  ensureColumn(_db, "work_items", "dor_checklist", "TEXT");
  ensureColumn(_db, "work_items", "dod_checklist", "TEXT");

  return _db;
}

function ensureColumn(db: Database.Database, table: string, column: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
