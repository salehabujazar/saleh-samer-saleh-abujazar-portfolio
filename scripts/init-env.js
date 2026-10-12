// Create the local configuration once, preserving any existing .env file.
import fs from 'node:fs';
import crypto from 'node:crypto';
if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', `PORT=3000\nNODE_ENV=development\nSESSION_SECRET=${crypto.randomBytes(32).toString('hex')}\nDATA_DIR=data\n`, { mode: 0o600, flag: 'wx' });
  console.log('Local configuration created.');
} else console.log('Existing configuration kept.');
