// Read-only JSON API used by the public pages to load lists of content.
// Only published entries are returned, except in preview mode (?preview=1)
// when the admin is signed in.
import { Router } from 'express';
import { getAllSettings, getMediaSlotId } from '../content/settings.js';
import { listProjects } from '../content/projects.js';
import { listResearch, getResearch } from '../content/research.js';
import { listCvEntriesBySection } from '../content/cv-entries.js';
import { getMediaInfo } from '../content/media.js';
import { isSignedIn } from '../security/auth.js';
import { parseIdParam } from '../security/validation.js';

export const publicApiRoutes = Router();

function wantsPreview(req) {
  return req.query.preview === '1' && isSignedIn(req);
}

// Responses can contain drafts in preview mode, so they must never be cached by browsers or proxies.
publicApiRoutes.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

publicApiRoutes.get('/settings', (req, res) => {
  const settings = getAllSettings();
  res.json({ values: Object.fromEntries(Object.entries(settings).filter(([key]) => !key.startsWith('_') && !key.startsWith('media.'))) });
});

publicApiRoutes.get('/home', (req, res) => {
  const preview = wantsPreview(req);
  res.json({
    preview,
    projects: listProjects({ includeDrafts: preview }).filter((project) => project.featured),
    research: listResearch({ includeDrafts: preview }).filter((entry) => entry.featured),
  });
});

publicApiRoutes.get('/projects', (req, res) => {
  const preview = wantsPreview(req);
  res.json({ preview, projects: listProjects({ includeDrafts: preview }) });
});

publicApiRoutes.get('/research', (req, res) => {
  const preview = wantsPreview(req);
  res.json({ preview, research: listResearch({ includeDrafts: preview }) });
});

publicApiRoutes.get('/research/:id', (req, res) => {
  const id = parseIdParam(req.params.id);
  const entry = id ? getResearch(id) : null;
  // Drafts are visible on their detail page whenever the admin is signed in.
  if (!entry || (entry.status !== 'published' && !isSignedIn(req))) {
    return res.status(404).json({ error: 'This research entry could not be found.' });
  }
  res.json({ preview: entry.status !== 'published', entry });
});

publicApiRoutes.get('/cv', (req, res) => {
  const preview = wantsPreview(req);
  const cv = getMediaInfo(getMediaSlotId(getAllSettings(), 'cv'));
  res.json({ preview, cv, entries: listCvEntriesBySection({ includeDrafts: preview }) });
});
