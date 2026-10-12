// Central place for configuration. Everything that differs between your laptop
// and a hosting provider comes from environment variables (see .env.example).
import path from 'node:path';
import crypto from 'node:crypto';

const projectRoot = path.resolve(import.meta.dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';

// DATA_DIR holds everything that must survive restarts and deployments:
// the SQLite database and the uploaded files. Point it at a persistent disk when hosting.
const dataDir = path.resolve(projectRoot, process.env.DATA_DIR || 'data');

function readSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (isProduction) {
    throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters in production.');
  }
  // Development convenience: a temporary secret means you are signed out when the server restarts.
  console.warn('[config] SESSION_SECRET is missing or too short. Using a temporary secret for development.');
  return crypto.randomBytes(32).toString('hex');
}

function readBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

export const config = {
  projectRoot,
  isProduction,
  port: Number(process.env.PORT) || 3000,
  dataDir,
  databaseFile: path.join(dataDir, 'site.db'),
  uploadsDir: path.join(dataDir, 'uploads'),
  viewsDir: path.join(projectRoot, 'views'),
  publicDir: path.join(projectRoot, 'public'),
  nodeModulesDir: path.join(projectRoot, 'node_modules'),
  sessionSecret: readSessionSecret(),
  // Cookies marked "secure" are only sent over HTTPS. On by default in production.
  secureCookies: readBoolean(process.env.SECURE_COOKIES, isProduction),
  // Set TRUST_PROXY=1 when running behind a reverse proxy (most hosting platforms)
  // so Express sees the real visitor IP (used by login rate limiting) and HTTPS status.
  trustProxy: process.env.TRUST_PROXY || false,
};
