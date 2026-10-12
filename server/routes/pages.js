// Routes that return HTML pages: the five public pages, research detail pages,
// the dashboard pages and a few small helper files (theme.css, robots.txt).
import path from 'node:path';
import { Router } from 'express';
import { config } from '../config.js';
import { getAllSettings, getMediaSlotId } from '../content/settings.js';
import { getMediaInfo } from '../content/media.js';
import { getResearch } from '../content/research.js';
import { isSignedIn, requireAdminPage } from '../security/auth.js';
import { parseIdParam } from '../security/validation.js';
import { renderPage, renderThemeCss } from '../rendering/render-page.js';

export const pageRoutes = Router();

// Each public page: its view file, nav label key (used in the <title>) and description key.
const PUBLIC_PAGES = [
  { path: '/', pageId: 'home', view: 'home.html', titleKey: null, descriptionKey: 'meta.home_description' },
  { path: '/cv', pageId: 'cv', view: 'cv.html', titleKey: 'nav.cv', descriptionKey: 'meta.cv_description' },
  { path: '/research', pageId: 'research', view: 'research.html', titleKey: 'nav.research', descriptionKey: 'meta.research_description' },
  { path: '/projects', pageId: 'projects', view: 'projects.html', titleKey: 'nav.projects', descriptionKey: 'meta.projects_description' },
  { path: '/contact', pageId: 'contact', view: 'contact.html', titleKey: 'nav.contact', descriptionKey: 'meta.contact_description' },
];

function sendHtml(res, html, status = 200) {
  // HTML is always regenerated so dashboard edits appear on the next page load.
  res.status(status).set('Cache-Control', 'no-store').type('html').send(html);
}

for (const page of PUBLIC_PAGES) {
  pageRoutes.get(page.path, (req, res) => {
    const settings = getAllSettings();
    sendHtml(res, renderPage({
      view: page.view,
      pageId: page.pageId,
      title: page.titleKey ? settings[page.titleKey] : '',
      description: settings[page.descriptionKey],
    }));
  });
}

// Research detail pages. Drafts return 404 unless the admin is signed in (preview).
pageRoutes.get('/research/:id', (req, res, next) => {
  const id = parseIdParam(req.params.id);
  const entry = id ? getResearch(id) : null;
  const visible = entry && (entry.status === 'published' || isSignedIn(req));
  if (!visible) return next(); // falls through to the 404 handler

  sendHtml(res, renderPage({
    view: 'research-detail.html',
    pageId: 'research',
    title: entry.title,
    description: entry.abstract.slice(0, 160),
    values: { 'entry.id': String(entry.id), 'entry.title': entry.title },
  }));
});

// Generated stylesheet with the theme colours chosen in the dashboard.
pageRoutes.get('/theme.css', (req, res) => {
  res.set('Cache-Control', 'no-store').type('css').send(renderThemeCss());
});

pageRoutes.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /admin\nDisallow: /api/\n');
});

// Browsers ask for /favicon.ico automatically; send them to the configured icon.
pageRoutes.get('/favicon.ico', (req, res) => {
  const favicon = getMediaInfo(getMediaSlotId(getAllSettings(), 'favicon'));
  res.redirect(302, favicon ? favicon.url : '/images/favicon.svg');
});

// ----- Dashboard pages (not linked from the public navigation) -----

pageRoutes.get('/admin/login', (req, res) => {
  if (isSignedIn(req)) return res.redirect('/admin');
  res.set('Cache-Control', 'no-store').sendFile(path.join(config.viewsDir, 'admin', 'login.html'));
});

pageRoutes.get('/admin', requireAdminPage, (req, res) => {
  res.set('Cache-Control', 'no-store').sendFile(path.join(config.viewsDir, 'admin', 'dashboard.html'));
});

/** Final handler for unknown pages: a friendly, editable 404 page. */
export function renderNotFoundPage(req, res) {
  const settings = getAllSettings();
  sendHtml(res, renderPage({
    view: 'not-found.html',
    pageId: 'not-found',
    title: settings['notfound.heading'],
  }), 404);
}
