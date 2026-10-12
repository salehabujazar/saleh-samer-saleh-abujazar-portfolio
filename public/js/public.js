// Public-page interactions. User text is inserted with textContent, never raw HTML.
const page = document.body.dataset.page;
const menu = document.querySelector('.menu-button');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  document.querySelector('#navigation').classList.toggle('is-open', open);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { menu.click(); menu.focus(); }
});
const status = document.querySelector('#content-status');
let settings = {};
const label = key => settings[key] || '';
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load content.');
  return response.json();
}
function externalLink(url, text, className = '') {
  const a = element('a', className, text); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.append(element('span', 'sr-only', label('labels.new_tab'))); return a;
}
function showTags(tags) {
  const list = element('div', 'tags');
  tags.forEach(tag => list.append(element('span', 'tag', tag))); return list;
}
function domain(url) { try { return new URL(url).hostname; } catch { return ''; } }
function date(value) { return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : ''; }

// The tiny GitHub mark is a static icon, not markup supplied by a user.
function githubMark() {
  const span = element('span', 'card-icon'); span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.12.68-3.78-1.32-3.78-1.32-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.62 1.22 3.26.94.1-.73.39-1.22.71-1.5-2.49-.29-5.11-1.25-5.11-5.55 0-1.23.44-2.23 1.16-3.02-.12-.28-.51-1.43.11-2.98 0 0 .94-.3 3.08 1.15a10.65 10.65 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.31-2.62 5.25-5.12 5.53.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z"/></svg>';
  return span;
}
let pdfLibrary;
async function pdfThumbnail(url, container) {
  try {
    pdfLibrary ??= import('/vendor/pdfjs/pdf.mjs');
    const pdfjs = await pdfLibrary;
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
    const task = pdfjs.getDocument({ url, isEvalSupported: false, cMapUrl: '/vendor/pdfjs-cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs-fonts/', wasmUrl: '/vendor/pdfjs-wasm/' });
    try {
      const document = await task.promise;
      const firstPage = await document.getPage(1);
      const original = firstPage.getViewport({ scale: 1 });
      const viewport = firstPage.getViewport({ scale: Math.min(2, 600 / original.width) });
      const canvas = element('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
      canvas.setAttribute('aria-hidden', 'true');
      await firstPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      container.replaceChildren(canvas);
    } finally { await task.destroy(); }
  } catch { /* Keep the styled document placeholder if the PDF is corrupt or encrypted. */ }
}
function visual(entry, research) {
  const box = element('div', 'card-visual');
  const fallback = () => {
    box.replaceChildren(entry.type === 'github' ? githubMark() : element('span', 'card-icon', research ? '¶' : '↗'));
    box.append(element('span', 'card-domain', research ? (entry.docType || 'PDF') : domain(entry.url)));
  };
  fallback();
  if (entry.cover) {
    const img = element('img'); img.src = entry.cover.url; img.alt = entry.coverAlt || ''; img.loading = 'lazy';
    img.addEventListener('error', fallback, { once: true }); box.replaceChildren(img);
  } else if (research && entry.pdf) pdfThumbnail(entry.pdf.url, box);
  return box;
}
function card(entry, research = false) {
  const article = element('article', 'card');
  const url = research ? (entry.pdf ? entry.detailUrl : entry.externalUrl || entry.detailUrl) : entry.url;
  const a = url && !url.startsWith('/') ? externalLink(url, '', 'card-link') : element(url ? 'a' : 'div', 'card-link');
  if (url) a.href = url;
  a.append(visual(entry, research));
  const type = research ? entry.docType : label(`projects.type_${entry.type}`);
  a.append(element('p', 'card-type', [type, date(entry.date), entry.status === 'draft' ? label('labels.draft_badge') : ''].filter(Boolean).join(' · ')));
  a.append(element('h3', '', entry.title));
  a.append(element('p', 'description', research ? entry.abstract : entry.description));
  if (research) a.append(element('p', 'text-link', label(entry.pdf ? 'research.read_label' : 'research.external_label') + ' ↗'));
  article.append(a, showTags(entry.tags)); return article;
}
function renderGrid(id, entries, research = false) {
  document.querySelector(id)?.replaceChildren(...entries.map(entry => card(entry, research)));
}
function filters(entries, research) {
  const container = document.querySelector('#filters'); if (!container) return;
  const all = label(research ? 'research.filter_all' : 'projects.filter_all');
  for (const tag of [null, ...new Set(entries.flatMap(entry => entry.tags))]) {
    const button = element('button', '', tag ?? all); button.type = 'button'; button.setAttribute('aria-pressed', String(tag === null));
    button.addEventListener('click', () => {
      container.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      renderGrid(research ? '#research-grid' : '#project-grid', tag === null ? entries : entries.filter(entry => entry.tags.includes(tag)), research);
    }); container.append(button);
  }
}
function documentViewer(pdf) {
  const fragment = document.createDocumentFragment();
  const actions = element('div', 'actions document-toolbar');
  actions.append(externalLink(pdf.url, label('research.open_button') + ' ↗', 'button'));
  const download = element('a', 'text-link', label('research.download_button') + ' ↓'); download.href = pdf.downloadUrl; download.download = '';
  actions.append(download);
  const object = element('object', 'pdf-viewer'); object.data = pdf.url; object.type = 'application/pdf'; object.setAttribute('aria-label', label('research.viewer_title'));
  object.append(element('p', '', label('research.fallback_text')), externalLink(pdf.url, label('research.open_button')));
  fragment.append(actions, object, element('p', 'mobile-pdf-fallback', label('research.fallback_text'))); return fragment;
}
async function start() {
  settings = (await get('/api/public/settings')).values;
  const preview = new URLSearchParams(location.search).get('preview') === '1' ? '?preview=1' : '';
  let result;
  if (page === 'home') {
    result = await get('/api/public/home' + preview);
    renderGrid('#project-grid', result.projects); renderGrid('#research-grid', result.research, true);
    document.querySelector('#featured-projects').hidden = !result.projects.length;
    document.querySelector('#featured-research').hidden = !result.research.length;
  } else if (page === 'projects' || (page === 'research' && !document.querySelector('[data-entry-id]'))) {
    result = await get('/api/public/' + page + preview);
    const entries = result[page]; const research = page === 'research';
    renderGrid(research ? '#research-grid' : '#project-grid', entries, research); filters(entries, research);
    if (!entries.length && status) { status.textContent = label(page + '.empty_text'); }
  } else if (page === 'cv') {
    result = await get('/api/public/cv' + preview);
    const container = document.querySelector('#cv-entries');
    for (const [section, entries] of Object.entries(result.entries)) {
      if (!entries.length) continue;
      const group = element('section', 'cv-section'); group.append(element('h3', '', label(`cv.${section}_heading`)));
      const items = element('div');
      for (const entry of entries) {
        const item = element('article', 'cv-entry');
        item.append(element('h4', '', entry.title), element('p', 'muted', [entry.organization, entry.location, entry.period, entry.status === 'draft' ? label('labels.draft_badge') : ''].filter(Boolean).join(' · ')), element('p', '', entry.description)); items.append(item);
      } group.append(items); container.append(group);
    }
  } else if (document.querySelector('[data-entry-id]')) {
    const id = document.querySelector('[data-entry-id]').dataset.entryId;
    result = await get('/api/public/research/' + id);
    const entry = result.entry; const container = document.querySelector('#research-detail');
    const meta = element('div', 'detail-meta');
    for (const [key, value] of [['authors', entry.authors], ['date', date(entry.date)], ['type', entry.docType]]) {
      if (value) { const p = element('div'); p.append(element('strong', '', label(`research.${key}_label`)), element('span', '', value)); meta.append(p); }
    }
    container.append(meta, showTags(entry.tags), element('p', 'research-abstract', entry.abstract));
    if (entry.pdf) container.append(documentViewer(entry.pdf));
    if (entry.externalUrl) container.append(externalLink(entry.externalUrl, label('research.external_button') + ' ↗', 'text-link'));
  } else if (page === 'contact') {
    const links = [['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['bluesky', 'Bluesky'], ['x', 'X'], ['instagram', 'Instagram'], ['website', 'Website']].filter(([key]) => settings['contact.' + key]);
    if (links.length) {
      const container = document.querySelector('#social-links'); container.append(element('p', 'eyebrow', label('contact.social_heading')));
      const list = element('div', 'social-list'); links.forEach(([key, title]) => list.append(externalLink(settings['contact.' + key], label('contact.' + key + '_label') + ' ↗', 'text-link'))); container.append(list);
    }
  }
  if (result?.preview) document.querySelector('#preview-banner').hidden = false;
  if (status && status.textContent !== label(page + '.empty_text')) status.textContent = '';
}
start().catch(() => {
  if (status) { status.textContent = label('labels.load_error') || 'This content could not be loaded. Please refresh the page.'; status.classList.add('error'); }
});
