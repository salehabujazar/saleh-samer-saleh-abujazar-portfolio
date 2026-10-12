// Credentials are entered interactively, never embedded in the source code.
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { db } from '../server/db/database.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../server/security/passwords.js';
let muted = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
const input = readline.createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
try {
  const username = (await input.question('Admin username: ')).trim();
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) throw new Error('Use 3–40 letters, numbers, dots, dashes or underscores.');
  if (db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username)) throw new Error('That username already exists. Choose a new username.');
  process.stdout.write('Password (at least 12 characters; typing is hidden): ');
  muted = true;
  const password = await input.question('');
  muted = false; process.stdout.write('\n');
  process.stdout.write('Confirm password: '); muted = true;
  const confirmation = await input.question('');
  muted = false; process.stdout.write('\n');
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 1024) throw new Error('Password must be 12–1024 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, await hashPassword(password));
  console.log('Admin created. Run npm start, then open http://localhost:3000/admin');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { muted = false; input.close(); db.close(); }
