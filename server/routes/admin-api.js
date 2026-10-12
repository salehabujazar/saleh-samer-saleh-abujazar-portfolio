// The dashboard API. Every route here requires a signed-in admin, and every
// change request must include the CSRF token (both enforced by router.use below).
import { Router } from 'express';
import { requireAdmin, requireCsrfToken } from '../security/auth.js';
import { parseIdParam, ValidationError } from '../security/validation.js';
import { acceptSingleUpload } from '../uploads/upload-handler.js';
import { settingsSections, mediaSlots } from '../content/settings-schema.js';
import { getAllSettings, saveSettings, setMediaSlot, getMediaSlotId } from '../content/settings.js';
import { saveUploadedFile, getMediaInfo, listMediaWithUsage, deleteMedia } from '../content/media.js';
import {
  listProjects, getProject, createProject, updateProject, deleteProject, reorderProjects,
} from '../content/projects.js';
import {
  listResearch, getResearch, createResearch, updateResearch, deleteResearch, reorderResearch,
} from '../content/research.js';
import {
  listCvEntriesBySection, createCvEntry, updateCvEntry, deleteCvEntry, reorderCvEntries,
} from '../content/cv-entries.js';

export const adminApiRoutes = Router();

adminApiRoutes.use(requireAdmin, requireCsrfToken, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/** Reads the numeric :id parameter or answers 404. */
function requireId(req, res) {
  const id = parseIdParam(req.params.id);
  if (!id) res.status(404).json({ error: 'Not found.' });
  return id;
}

function notFound(res, what) {
  return res.status(404).json({ error: `${what} could not be found. It may have been deleted.` });
}

// ----- Settings -----

function siteFiles() {
  const settings = getAllSettings();
  return Object.fromEntries(
    Object.keys(mediaSlots).map((slot) => [slot, getMediaInfo(getMediaSlotId(settings, slot))]),
  );
}

adminApiRoutes.get('/settings', (req, res) => {
  res.json({ sections: settingsSections, values: getAllSettings(), files: siteFiles() });
});

adminApiRoutes.put('/settings', (req, res) => {
  const values = saveSettings(req.body?.values);
  res.json({ values });
});

function requireSlot(req, res) {
  const slot = mediaSlots[req.params.slot];
  if (!slot) res.status(404).json({ error: 'Unknown file slot.' });
  return slot;
}

// Upload (or replace) the portrait, CV or favicon. The new file takes effect immediately.
adminApiRoutes.post('/site-files/:slot', (req, res, next) => {
  if (requireSlot(req, res)) next();
}, acceptSingleUpload, (req, res) => {
  const slot = mediaSlots[req.params.slot];
  const media = saveUploadedFile(req.file, slot.allowedKinds);
  setMediaSlot(req.params.slot, media.id);
  res.status(201).json({ file: media, files: siteFiles() });
});

// Use an existing file from the media library for a slot.
adminApiRoutes.put('/site-files/:slot', (req, res) => {
  const slot = requireSlot(req, res);
  if (!slot) return;
  const media = getMediaInfo(parseIdParam(req.body?.mediaId));
  if (!media || !slot.allowedKinds.includes(media.kind)) {
    throw new ValidationError(`Please choose a suitable file for the ${slot.label.toLowerCase()}.`);
  }
  setMediaSlot(req.params.slot, media.id);
  res.json({ file: media, files: siteFiles() });
});

// Detach the file from the slot. The file stays in the media library (now private).
adminApiRoutes.delete('/site-files/:slot', (req, res) => {
  if (!requireSlot(req, res)) return;
  setMediaSlot(req.params.slot, null);
  res.json({ files: siteFiles() });
});

// ----- Media library -----

adminApiRoutes.get('/media', (req, res) => {
  res.json({ media: listMediaWithUsage() });
});

adminApiRoutes.post('/media', acceptSingleUpload, (req, res) => {
  // ?accept=pdf or ?accept=image limits what a particular form field accepts.
  const allowed = { image: ['image'], pdf: ['pdf'] }[req.query.accept] ?? ['image', 'pdf'];
  res.status(201).json({ file: saveUploadedFile(req.file, allowed) });
});

adminApiRoutes.delete('/media/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  deleteMedia(id);
  res.json({ ok: true });
});

// ----- Projects -----

adminApiRoutes.get('/projects', (req, res) => {
  res.json({ projects: listProjects({ includeDrafts: true }) });
});

adminApiRoutes.post('/projects', (req, res) => {
  res.status(201).json({ project: createProject(req.body ?? {}) });
});

// Registered before "/projects/:id" so "order" is not mistaken for an id.
adminApiRoutes.put('/projects/order', (req, res) => {
  reorderProjects(req.body?.ids);
  res.json({ projects: listProjects({ includeDrafts: true }) });
});

adminApiRoutes.get('/projects/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  const project = getProject(id);
  return project ? res.json({ project }) : notFound(res, 'This project');
});

adminApiRoutes.put('/projects/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  const project = updateProject(id, req.body ?? {});
  return project ? res.json({ project }) : notFound(res, 'This project');
});

adminApiRoutes.delete('/projects/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  return deleteProject(id) ? res.json({ ok: true }) : notFound(res, 'This project');
});

// ----- Research -----

adminApiRoutes.get('/research', (req, res) => {
  res.json({ research: listResearch({ includeDrafts: true }) });
});

adminApiRoutes.post('/research', (req, res) => {
  res.status(201).json({ entry: createResearch(req.body ?? {}) });
});

adminApiRoutes.put('/research/order', (req, res) => {
  reorderResearch(req.body?.ids);
  res.json({ research: listResearch({ includeDrafts: true }) });
});

adminApiRoutes.get('/research/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  const entry = getResearch(id);
  return entry ? res.json({ entry }) : notFound(res, 'This research entry');
});

adminApiRoutes.put('/research/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  const entry = updateResearch(id, req.body ?? {});
  return entry ? res.json({ entry }) : notFound(res, 'This research entry');
});

adminApiRoutes.delete('/research/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  return deleteResearch(id) ? res.json({ ok: true }) : notFound(res, 'This research entry');
});

// ----- Structured CV entries -----

adminApiRoutes.get('/cv-entries', (req, res) => {
  res.json({ entries: listCvEntriesBySection({ includeDrafts: true }) });
});

adminApiRoutes.post('/cv-entries', (req, res) => {
  res.status(201).json({ entry: createCvEntry(req.body ?? {}) });
});

adminApiRoutes.put('/cv-entries/order', (req, res) => {
  reorderCvEntries(req.body?.section, req.body?.ids);
  res.json({ entries: listCvEntriesBySection({ includeDrafts: true }) });
});

adminApiRoutes.put('/cv-entries/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  const entry = updateCvEntry(id, req.body ?? {});
  return entry ? res.json({ entry }) : notFound(res, 'This CV entry');
});

adminApiRoutes.delete('/cv-entries/:id', (req, res) => {
  const id = requireId(req, res);
  if (!id) return;
  return deleteCvEntry(id) ? res.json({ ok: true }) : notFound(res, 'This CV entry');
});
