// Authentication and CSRF helpers used by the routes.
import crypto from 'node:crypto';
import { db } from '../db/database.js';

const findAdminById = db.prepare('SELECT id, username FROM admin_users WHERE id = ?');

/** Returns the signed-in admin ({ id, username }) or null. */
export function getSignedInAdmin(req) {
  const adminId = req.session?.adminId;
  if (!adminId) return null;
  // Re-check the database so a deleted account loses access immediately.
  return findAdminById.get(adminId) ?? null;
}

export function isSignedIn(req) {
  return getSignedInAdmin(req) !== null;
}

/** For JSON API routes: respond 401 when not signed in. */
export function requireAdmin(req, res, next) {
  const admin = getSignedInAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
  }
  req.admin = admin;
  next();
}

/** For dashboard HTML pages: redirect to the login page when not signed in. */
export function requireAdminPage(req, res, next) {
  if (!isSignedIn(req)) {
    return res.redirect('/admin/login');
  }
  next();
}

/**
 * CSRF protection (synchronizer token pattern): each session gets a random token.
 * The dashboard sends it back in the X-CSRF-Token header with every change request.
 * Other websites cannot read the token, so they cannot forge requests.
 */
export function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const sentToken = Buffer.from(String(req.get('x-csrf-token') || ''));
  const expectedToken = Buffer.from(String(req.session?.csrfToken || ''));
  const valid = expectedToken.length > 0
    && sentToken.length === expectedToken.length
    && crypto.timingSafeEqual(sentToken, expectedToken);

  if (!valid) {
    return res.status(403).json({ error: 'Security check failed. Please refresh the page and try again.' });
  }
  next();
}
