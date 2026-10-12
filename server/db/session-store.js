// A small session store that keeps login sessions in the SQLite database,
// so signed-in sessions survive server restarts and nothing is kept only in memory.
import session from 'express-session';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

export class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.statements = {
      get: db.prepare('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?'),
      set: db.prepare(`
        INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
      `),
      touch: db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?'),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      removeExpired: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    };

    // Periodically delete expired sessions. unref() lets the process exit normally.
    const timer = setInterval(() => this.statements.removeExpired.run(Date.now()), CLEANUP_INTERVAL_MS);
    timer.unref();
  }

  get(sid, callback) {
    try {
      const row = this.statements.get.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionData, callback) {
    try {
      this.statements.set.run(sid, JSON.stringify(sessionData), expiryTime(sessionData));
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, sessionData, callback) {
    try {
      this.statements.touch.run(expiryTime(sessionData), sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid, callback) {
    try {
      this.statements.destroy.run(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }
}

function expiryTime(sessionData) {
  const expires = sessionData?.cookie?.expires;
  return expires ? new Date(expires).getTime() : Date.now() + ONE_DAY_MS;
}
