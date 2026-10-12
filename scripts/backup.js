// Stop the server first so the database and uploaded files form one consistent backup.
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db/database.js';
import { config } from '../server/config.js';
const destination = path.resolve('backups', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(destination, { recursive: true });
await db.backup(path.join(destination, 'site.db'));
fs.cpSync(config.uploadsDir, path.join(destination, 'uploads'), { recursive: true });
db.close();
console.log(`Backup created: ${destination}`);
