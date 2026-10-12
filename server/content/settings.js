// Reading and saving site settings (all editable text, labels and theme colours).
import { db } from '../db/database.js';
import { allSettingFields, fieldsByKey, mediaSlots } from './settings-schema.js';
import {
  ValidationError, cleanText, cleanUrl, cleanEmail, cleanColor, cleanBoolean,
} from '../security/validation.js';

const selectAll = db.prepare('SELECT key, value FROM settings');
const upsert = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const insertIfMissing = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

/** Writes default values for any setting that does not exist yet. Existing edits are kept. */
export function ensureDefaultSettings() {
  const writeDefaults = db.transaction(() => {
    for (const field of allSettingFields) insertIfMissing.run(field.key, field.default);
    for (const slot of Object.values(mediaSlots)) insertIfMissing.run(slot.settingKey, '');
  });
  writeDefaults();
}

/** Returns every setting as a plain object: { 'nav.home': 'Home', ... }. */
export function getAllSettings() {
  const settings = {};
  for (const field of allSettingFields) settings[field.key] = field.default;
  for (const slot of Object.values(mediaSlots)) settings[slot.settingKey] = '';
  for (const row of selectAll.all()) settings[row.key] = row.value;
  return settings;
}

function cleanSettingValue(field, value) {
  const options = { field: field.key, label: field.label };
  switch (field.type) {
    case 'textarea':
      return cleanText(value, { ...options, max: field.max, multiline: true });
    case 'url':
      return cleanUrl(value, options);
    case 'email':
      return cleanEmail(value, options);
    case 'color':
      return cleanColor(value, options);
    case 'boolean':
      return cleanBoolean(value) ? 'yes' : 'no';
    default:
      return cleanText(value, { ...options, max: field.max });
  }
}

/** Validates and saves a set of changed settings. Unknown keys are rejected. */
export function saveSettings(changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new ValidationError('No settings were sent.');
  }

  const cleaned = [];
  for (const [key, value] of Object.entries(changes)) {
    const field = fieldsByKey.get(key);
    if (!field) throw new ValidationError(`Unknown setting: ${key}`);
    cleaned.push([key, cleanSettingValue(field, value)]);
  }

  // Save everything or nothing, so a validation error never leaves half-saved text.
  db.transaction(() => cleaned.forEach(([key, value]) => upsert.run(key, value)))();
  return getAllSettings();
}

/** Points a media slot (portrait, CV, favicon) at an uploaded file, or clears it with null. */
export function setMediaSlot(slotName, mediaId) {
  const slot = mediaSlots[slotName];
  if (!slot) throw new ValidationError('Unknown file slot.');
  upsert.run(slot.settingKey, mediaId ? String(mediaId) : '');
}

export function getMediaSlotId(settings, slotName) {
  const id = Number(settings[mediaSlots[slotName].settingKey]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
