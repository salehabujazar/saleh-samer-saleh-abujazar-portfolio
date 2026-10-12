// Input cleaning and validation helpers shared by all content modules.
// Each helper either returns a cleaned value or throws a ValidationError with
// a message that is safe and helpful to show in the dashboard.

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.field = field;
  }
}

// Control characters (except tab and newline) are never useful in page text.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value, { field, label, max = 200, required = false, multiline = false }) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ValidationError(`${label} must be text.`, field);
  }

  let text = String(value).replace(/\r\n?/g, '\n').replace(CONTROL_CHARACTERS, '');
  if (multiline) {
    // Keep paragraphs, but never more than one empty line in a row.
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  } else {
    text = text.replace(/\s+/g, ' ');
  }
  text = text.trim();

  if (required && !text) {
    throw new ValidationError(`${label} is required.`, field);
  }
  if (text.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer (currently ${text.length}).`, field);
  }
  return text;
}

/** Accepts only absolute http(s) addresses, which blocks javascript: and data: links. */
export function cleanUrl(value, { field, label, required = false }) {
  const text = cleanText(value, { field, label, max: 2000, required });
  if (!text) return '';

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new ValidationError(`${label} must be a full web address, for example https://example.com.`, field);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ValidationError(`${label} must start with https:// or http://.`, field);
  }
  const hasValidHost = parsed.hostname.includes('.') || parsed.hostname === 'localhost';
  if (!hasValidHost) {
    throw new ValidationError(`${label} must include a valid domain name.`, field);
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError(`${label} must not contain a username or password.`, field);
  }
  return parsed.href;
}

const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

export function cleanEmail(value, { field, label, required = false }) {
  const text = cleanText(value, { field, label, max: 254, required });
  if (text && !EMAIL_PATTERN.test(text)) {
    throw new ValidationError(`${label} must be a valid email address.`, field);
  }
  return text;
}

export function cleanColor(value, { field, label }) {
  const text = cleanText(value, { field, label, max: 7, required: true }).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(text)) {
    throw new ValidationError(`${label} must be a colour in the format #RRGGBB.`, field);
  }
  return text;
}

/** Booleans are stored as "yes"/"no" in settings and as 1/0 in entry tables. */
export function cleanBoolean(value) {
  return value === true || value === 'yes' || value === 'true' || value === 1 || value === '1' || value === 'on';
}

/** Dates are optional and stored as YYYY-MM-DD strings. */
export function cleanDate(value, { field, label }) {
  const text = cleanText(value, { field, label, max: 10 });
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`)) || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text) {
    throw new ValidationError(`${label} must be a valid date.`, field);
  }
  return text;
}

export function cleanChoice(value, { field, label, choices }) {
  if (!choices.includes(value)) {
    throw new ValidationError(`${label} must be one of: ${choices.join(', ')}.`, field);
  }
  return value;
}

/** Tags may arrive as an array or a comma-separated string. Returns unique, trimmed tags. */
export function cleanTags(value, { field = 'tags', label = 'Tags', maxTags = 8, maxLength = 30 } = {}) {
  const rawTags = Array.isArray(value) ? value : String(value ?? '').split(',');
  const tags = [];
  for (const raw of rawTags) {
    const tag = cleanText(raw, { field, label: 'Each tag', max: maxLength });
    const alreadyAdded = tags.some((existing) => existing.toLowerCase() === tag.toLowerCase());
    if (tag && !alreadyAdded) tags.push(tag);
  }
  if (tags.length > maxTags) {
    throw new ValidationError(`${label}: use at most ${maxTags} tags.`, field);
  }
  return tags;
}

/** Positive integer ids, or null when empty. */
export function cleanOptionalId(value, { field, label }) {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`${label} is not valid.`, field);
  }
  return id;
}

export function parseIdParam(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Validates a full list of ids for reordering: must contain each existing id exactly once. */
export function cleanOrderList(value, existingIds) {
  if (!Array.isArray(value)) {
    throw new ValidationError('The new order must be a list of ids.');
  }
  const ids = value.map(Number);
  const unique = new Set(ids);
  const matches = ids.length === existingIds.length && unique.size === ids.length
    && existingIds.every((id) => unique.has(id));
  if (!matches) {
    throw new ValidationError('The list changed while you were editing. Please reload the page and try again.');
  }
  return ids;
}
