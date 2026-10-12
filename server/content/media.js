// Uploaded files: saving, listing, usage tracking, visibility and deletion.
//
// Visibility rule: a file is public only while it is used by published content
// (a published project/research entry, or the site-wide portrait, CV or favicon).
// Everything else - files on drafts or unused files - is only visible to the signed-in admin.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { config } from '../config.js';
import { mediaSlots } from './settings-schema.js';
import { detectFileType, KIND_DESCRIPTIONS } from '../uploads/file-types.js';
import { ValidationError } from '../security/validation.js';

const statements = {
  byId: db.prepare('SELECT * FROM media WHERE id = ?'),
  byStoredName: db.prepare('SELECT * FROM media WHERE stored_name = ?'),
  all: db.prepare('SELECT * FROM media ORDER BY created_at DESC, id DESC'),
  insert: db.prepare(`
    INSERT INTO media (stored_name, original_name, mime_type, size_bytes, kind)
    VALUES (?, ?, ?, ?, ?)
  `),
  remove: db.prepare('DELETE FROM media WHERE id = ?'),
  slotSettings: db.prepare(`SELECT key FROM settings WHERE key LIKE 'media.%' AND value = ?`),
  projectCovers: db.prepare('SELECT title, status FROM projects WHERE cover_media_id = ?'),
  researchCovers: db.prepare('SELECT title, status FROM research WHERE cover_media_id = ?'),
  researchPdfs: db.prepare('SELECT title, status FROM research WHERE pdf_media_id = ?'),
};

/** SQLite stores "2026-10-12 18:07:00" in UTC; convert it to ISO 8601 for browsers. */
export function sqliteTimeToIso(value) {
  return value ? `${value.replace(' ', 'T')}Z` : null;
}

/** The public-facing description of a media row. Internal paths are never exposed. */
export function toMediaInfo(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: `/media/${row.stored_name}`,
    downloadUrl: `/media/${row.stored_name}?download=1`,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    kind: row.kind,
    createdAt: sqliteTimeToIso(row.created_at),
  };
}

export function getMediaRow(id) {
  return id ? statements.byId.get(id) ?? null : null;
}

export function getMediaInfo(id) {
  return toMediaInfo(getMediaRow(id));
}

export function getMediaRowByStoredName(storedName) {
  return statements.byStoredName.get(storedName) ?? null;
}

/** Keeps only safe characters for the download file name and forces the real extension. */
function safeOriginalName(name, extension) {
  const base = path.basename(String(name || 'file'))
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9 ._()-]+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 100) || 'file';
  return `${base}.${extension}`;
}

/**
 * Validates an uploaded file and stores it under a random name.
 * `allowedKinds` limits what is accepted for a given place, e.g. ['pdf'] for the CV.
 */
export function saveUploadedFile(file, allowedKinds) {
  const fileType = detectFileType(file.buffer);
  if (!fileType || !allowedKinds.includes(fileType.kind)) {
    const accepted = allowedKinds.map((kind) => KIND_DESCRIPTIONS[kind]).join(' or ');
    throw new ValidationError(`This file type is not supported here. Please upload a ${accepted}.`, 'file');
  }
  if (file.size > fileType.maxBytes) {
    throw new ValidationError(`The file is too large. Please upload a ${KIND_DESCRIPTIONS[fileType.kind]}.`, 'file');
  }

  // The server chooses the file name, so uploads can never overwrite other files
  // or be saved with a dangerous extension such as .html or .js.
  const storedName = `${crypto.randomBytes(16).toString('hex')}.${fileType.extension}`;
  const filePath = path.join(config.uploadsDir, storedName);
  fs.writeFileSync(filePath, file.buffer, { flag: 'wx' });

  try {
    const result = statements.insert.run(
      storedName,
      safeOriginalName(file.originalname, fileType.extension),
      fileType.mimeType,
      file.size,
      fileType.kind,
    );
    return getMediaInfo(Number(result.lastInsertRowid));
  } catch (error) {
    fs.rmSync(filePath, { force: true });
    throw error;
  }
}

/** Lists everywhere a file is used, and whether that place is publicly visible. */
export function findMediaUsage(mediaId) {
  const usage = [];
  for (const row of statements.slotSettings.all(String(mediaId))) {
    const slot = Object.values(mediaSlots).find((candidate) => candidate.settingKey === row.key);
    if (slot) usage.push({ label: `Site ${slot.label.toLowerCase()}`, isPublic: true });
  }
  const addEntries = (rows, prefix) => {
    for (const row of rows) {
      usage.push({ label: `${prefix}: ${row.title}${row.status === 'draft' ? ' (draft)' : ''}`, isPublic: row.status === 'published' });
    }
  };
  addEntries(statements.projectCovers.all(mediaId), 'Project cover');
  addEntries(statements.researchCovers.all(mediaId), 'Research cover');
  addEntries(statements.researchPdfs.all(mediaId), 'Research PDF');
  return usage;
}

export function isMediaPublic(mediaId) {
  return findMediaUsage(mediaId).some((place) => place.isPublic);
}

export function listMediaWithUsage() {
  return statements.all.all().map((row) => ({
    ...toMediaInfo(row),
    usage: findMediaUsage(row.id),
  }));
}

/** Deletes an unused file. Files still in use must be detached first, so pages never break. */
export function deleteMedia(mediaId) {
  const row = getMediaRow(mediaId);
  if (!row) throw new ValidationError('That file no longer exists.');

  const usage = findMediaUsage(mediaId);
  if (usage.length > 0) {
    throw new ValidationError(`This file is still in use (${usage.map((u) => u.label).join('; ')}). Remove it there first.`);
  }
  statements.remove.run(mediaId);
  fs.rmSync(path.join(config.uploadsDir, row.stored_name), { force: true });
}

/** Ensures an id refers to an existing file of an allowed kind (used when saving entries). */
export function assertMediaKind(mediaId, allowedKinds, label) {
  if (mediaId === null) return null;
  const row = getMediaRow(mediaId);
  if (!row || !allowedKinds.includes(row.kind)) {
    throw new ValidationError(`${label} must be an uploaded ${allowedKinds.join(' or ')} file.`);
  }
  return mediaId;
}
