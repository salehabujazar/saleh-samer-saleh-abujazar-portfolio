// Opens the SQLite database (creating it on first run) and applies schema.sql.
// Every other backend module imports `db` from here.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadsDir, { recursive: true });

export const db = new Database(config.databaseFile);

// WAL mode allows reads while a write is happening and is the recommended mode for web apps.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const schema = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8');
db.exec(schema);

/**
 * Saves a new display order for rows in one of the orderable tables.
 * `ids` is the complete list of row ids in their new order.
 */
const ORDERABLE_TABLES = new Set(['projects', 'research', 'cv_entries']);

export function saveDisplayOrder(table, ids) {
  // Table names cannot be passed as SQL parameters, so only known names are accepted.
  if (!ORDERABLE_TABLES.has(table)) {
    throw new Error(`Table ${table} cannot be reordered.`);
  }
  const update = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
  const applyOrder = db.transaction((orderedIds) => {
    orderedIds.forEach((id, index) => update.run(index, id));
  });
  applyOrder(ids);
}
