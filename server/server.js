// Application entry point. Run with npm start; no build step is needed.
import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { db } from './db/database.js';
import { SqliteSessionStore } from './db/session-store.js';
import { ensureDefaultSettings } from './content/settings.js';
import { getMediaRowByStoredName, isMediaPublic } from './content/media.js';
import { isSignedIn } from './security/auth.js';
import { pageRoutes, renderNotFoundPage } from './routes/pages.js';
import { authApiRoutes } from './routes/auth-api.js';
import { adminApiRoutes } from './routes/admin-api.js';
import { publicApiRoutes } from './routes/public-api.js';

ensureDefaultSettings();
export const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', config.trustProxy === '1' ? 1 : config.trustProxy);
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'blob:'], fontSrc: ["'self'"],
    connectSrc: ["'self'"], workerSrc: ["'self'", 'blob:'],
    objectSrc: ["'self'"], frameSrc: ["'self'"],
    upgradeInsecureRequests: config.isProduction ? [] : null,
  } },
  strictTransportSecurity: config.isProduction ? undefined : false,
}));
app.use(express.json({ limit: '150kb' }));
app.use(session({
  name: 'portfolio.sid', secret: config.sessionSecret,
  store: new SqliteSessionStore(db), resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, maxAge: 8 * 60 * 60 * 1000 },
}));

// Expose only selected vendor assets, never the whole node_modules directory.
app.use('/fonts/inter', express.static(path.join(config.nodeModulesDir, '@fontsource-variable/inter/files')));
app.use('/fonts/fraunces', express.static(path.join(config.nodeModulesDir, '@fontsource-variable/fraunces/files')));
app.use('/vendor/pdfjs', express.static(path.join(config.nodeModulesDir, 'pdfjs-dist/build')));
app.use('/vendor/pdfjs-cmaps', express.static(path.join(config.nodeModulesDir, 'pdfjs-dist/cmaps')));
app.use('/vendor/pdfjs-fonts', express.static(path.join(config.nodeModulesDir, 'pdfjs-dist/standard_fonts')));
app.use('/vendor/pdfjs-wasm', express.static(path.join(config.nodeModulesDir, 'pdfjs-dist/wasm')));
app.use(express.static(config.publicDir, { index: false }));

// Uploads are intentionally NOT served by express.static: check visibility first.
app.get('/media/:name', (req, res, next) => {
  const file = getMediaRowByStoredName(req.params.name);
  if (!file || (!isMediaPublic(file.id) && !isSignedIn(req))) return res.sendStatus(404);
  res.set('Cache-Control', 'private, no-store');
  res.type(file.mime_type);
  if (req.query.download === '1') res.attachment(file.original_name);
  res.sendFile(path.join(config.uploadsDir, file.stored_name), error => { if (error) next(error); });
});
app.use('/api/auth', authApiRoutes);
app.use('/api/admin', adminApiRoutes);
app.use('/api/public', publicApiRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use(pageRoutes);
app.use(renderNotFoundPage);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : error.message, field: error.field });
});

// Importing app in tests does not open a port.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = app.listen(config.port, '127.0.0.1', () => {
    console.log(`Portfolio: http://localhost:${config.port}\nDashboard: http://localhost:${config.port}/admin`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
