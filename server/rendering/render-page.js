// A deliberately tiny template system for the public HTML pages.
//
// View files in /views are plain HTML with three kinds of placeholders:
//   {{some.key}}                 -> the escaped text of a setting (safe against script injection)
//   {{paragraphs:some.key}}      -> multi-line text turned into escaped <p> paragraphs
//   {{hide-if-empty:some.key}}   -> outputs the "hidden" attribute when the value is empty
//   {{hide-if-set:some.key}}     -> outputs the "hidden" attribute when the value is NOT empty
// and one kind of include:
//   <!-- include: header -->     -> inserts views/partials/header.html
//
// Lists (projects, research, CV entries) are filled in by the browser from the JSON API.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { getAllSettings, getMediaSlotId } from '../content/settings.js';
import { getMediaInfo } from '../content/media.js';

const viewCache = new Map();

function readView(relativePath) {
  // In development views are re-read on every request so edits show immediately.
  if (config.isProduction && viewCache.has(relativePath)) return viewCache.get(relativePath);
  const html = fs.readFileSync(path.join(config.viewsDir, relativePath), 'utf8');
  if (config.isProduction) viewCache.set(relativePath, html);
  return html;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function toParagraphs(value) {
  return String(value ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatLongDate(isoDate) {
  return isoDate ? dateFormatter.format(new Date(isoDate)) : '';
}

function insertPartials(html) {
  return html.replace(/<!--\s*include:\s*([\w-]+)\s*-->/g, (_, name) => readView(`partials/${name}.html`));
}

/** Adds aria-current="page" to the navigation link of the current page. */
function markCurrentPage(html, pageId) {
  return html.replaceAll(`data-nav="${pageId}"`, `data-nav="${pageId}" aria-current="page"`);
}

const PLACEHOLDER = /\{\{\s*(?:(paragraphs|hide-if-empty|hide-if-set):)?\s*([\w.-]+)\s*\}\}/g;

function fillPlaceholders(html, values) {
  return html.replace(PLACEHOLDER, (match, modifier, key) => {
    if (!(key in values)) {
      if (!config.isProduction) console.warn(`[render] Unknown placeholder: ${key}`);
      return '';
    }
    const value = values[key];
    if (modifier === 'paragraphs') return toParagraphs(value);
    if (modifier === 'hide-if-empty') return value ? '' : 'hidden';
    if (modifier === 'hide-if-set') return value ? 'hidden' : '';
    return escapeHtml(value);
  });
}

/** Values calculated from settings and uploaded files, available as {{computed.*}}. */
function computeValues(settings) {
  const portrait = getMediaInfo(getMediaSlotId(settings, 'portrait'));
  const cv = getMediaInfo(getMediaSlotId(settings, 'cv'));
  const favicon = getMediaInfo(getMediaSlotId(settings, 'favicon'));
  const themeText = Object.keys(settings).filter((key) => key.startsWith('theme.')).map((key) => settings[key]).join();

  return {
    'computed.year': String(new Date().getFullYear()),
    'computed.favicon_url': favicon ? favicon.url : '/images/favicon.svg',
    'computed.favicon_type': favicon ? favicon.mimeType : 'image/svg+xml',
    'computed.portrait_url': portrait ? portrait.url : '',
    'computed.cv_url': cv ? cv.url : '',
    'computed.cv_download_url': cv ? cv.downloadUrl : '',
    'computed.cv_updated_iso': cv ? cv.createdAt.slice(0, 10) : '',
    'computed.cv_updated_text': cv ? formatLongDate(cv.createdAt) : '',
    'computed.cv_show_updated': cv && settings['cv.show_updated'] === 'yes' ? 'yes' : '',
    'computed.cv_show_structured': settings['cv.show_structured'] === 'yes' ? 'yes' : '',
    'computed.email_href': settings['contact.email'] ? `mailto:${settings['contact.email']}` : '',
    // Changes whenever the colours change, so browsers fetch the new theme.css.
    'computed.theme_version': crypto.createHash('sha1').update(themeText).digest('hex').slice(0, 10),
  };
}

/**
 * Renders a view file into a complete HTML page.
 * `title` and `description` are plain text; `values` adds page-specific placeholders.
 */
export function renderPage({ view, pageId, title = '', description = '', values = {} }) {
  const settings = getAllSettings();
  const siteTitle = settings['site.title'];
  const templateValues = {
    ...settings,
    ...computeValues(settings),
    'page.id': pageId,
    'page.title': title ? `${title} · ${siteTitle}` : siteTitle,
    'page.description': description,
    ...values,
  };

  let html = readView(view);
  html = insertPartials(html);
  html = markCurrentPage(html, pageId);
  return fillPlaceholders(html, templateValues);
}

/** The theme colours as CSS custom properties, served at /theme.css. */
export function renderThemeCss() {
  const settings = getAllSettings();
  const safeColor = (key, fallback) => (/^#[0-9a-f]{6}$/i.test(settings[key]) ? settings[key] : fallback);
  return `/* Generated from the dashboard theme settings. */
:root {
  --color-bg: ${safeColor('theme.background', '#faf6ee')};
  --color-surface: ${safeColor('theme.surface', '#f1e8d8')};
  --color-text: ${safeColor('theme.text', '#2b2a26')};
  --color-heading: ${safeColor('theme.heading', '#3f4a2e')};
  --color-accent: ${safeColor('theme.accent', '#a3502f')};
}
`;
}
