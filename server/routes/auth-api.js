// Sign in, sign out and session status for the dashboard.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database.js';
import { verifyPassword, getDummyHash } from '../security/passwords.js';
import { ensureCsrfToken, requireCsrfToken, getSignedInAdmin } from '../security/auth.js';
import { config } from '../config.js';

export const authApiRoutes = Router();

const findAdminByUsername = db.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?');

// At most 5 failed sign-in attempts per IP address every 15 minutes.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

authApiRoutes.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/** Session status. Also hands out the CSRF token the dashboard must send with changes. */
authApiRoutes.get('/session', (req, res) => {
  const admin = getSignedInAdmin(req);
  res.json({
    signedIn: Boolean(admin),
    username: admin?.username ?? null,
    csrfToken: ensureCsrfToken(req),
  });
});

authApiRoutes.post('/login', loginRateLimit, requireCsrfToken, async (req, res, next) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password || password.length > 1024) {
    return res.status(400).json({ error: 'Please enter your username and password.' });
  }

  const admin = findAdminByUsername.get(username);
  // Always run a password check, even for unknown usernames, so timing reveals nothing.
  const passwordMatches = await verifyPassword(password, admin ? admin.password_hash : await getDummyHash());
  if (!admin || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  // A fresh session id on sign-in prevents session fixation attacks.
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.adminId = admin.id;
    const csrfToken = ensureCsrfToken(req);
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      res.json({ ok: true, username: admin.username, csrfToken });
    });
  });
});

authApiRoutes.post('/logout', requireCsrfToken, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('portfolio.sid', { httpOnly: true, sameSite: 'lax', secure: config.secureCookies });
    res.json({ ok: true });
  });
});
