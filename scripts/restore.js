// Restore while the server is stopped. Require an explicit flag; preserve old data.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
const source = process.argv[2] && path.resolve(process.argv[2]);
if (!source || process.argv[3] !== '--confirm' || !fs.existsSync(path.join(source, 'site.db')) || !fs.existsSync(path.join(source, 'uploads'))) {
  console.error('Stop the server. Usage: npm run restore -- "backups/FOLDER" --confirm'); process.exit(1);
}
if (source === config.dataDir || source.startsWith(config.dataDir + path.sep)) throw new Error('Backup must be outside DATA_DIR.');
if (fs.existsSync(config.dataDir)) fs.renameSync(config.dataDir, `${config.dataDir}-before-restore-${Date.now()}`);
fs.mkdirSync(config.dataDir, { recursive: true });
fs.copyFileSync(path.join(source, 'site.db'), config.databaseFile);
fs.cpSync(path.join(source, 'uploads'), config.uploadsDir, { recursive: true });
console.log('Backup restored. Previous data kept in the adjacent before-restore folder.');
