// Dashboard: schema-driven settings forms plus small, explicit content editors.
const panel = document.querySelector('#panel');
const notice = document.querySelector('#notice');
const dialog = document.querySelector('#editor');
const entryForm = document.querySelector('#entry-form');
let token = '';
let state;
let media = [];
let currentPanel = 'home';
let panelDirty = false;
let editorDirty = false;
let editorKind;
let editingEntry;
let saving = false;
let panelRequest = 0;

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}
function button(text, action, className = 'plain-button') {
  const b = node('button', className, text); b.type = 'button';
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await action(); } catch (error) { announce(error.message, true); }
    finally { b.disabled = false; }
  }); return b;
}
function announce(text, error = false) { notice.textContent = text; notice.classList.toggle('error', error); }
async function api(path, method = 'GET', body) {
  const headers = { 'X-CSRF-Token': token };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (response.status === 401) {
    if (!panelDirty && !editorDirty) location.assign('/admin/login');
    throw new Error('Your session ended. Copy any unsaved text, then sign in again in another tab.');
  }
  if (!response.ok) throw new Error(data.error || 'The request failed.');
  return data;
}
function isBusy() { return saving; }
function canLeave() {
  if (isBusy()) { announce('Please wait for saving to finish.'); return false; }
  return !(panelDirty || editorDirty) || confirm('Discard your unsaved changes?');
}
window.addEventListener('beforeunload', event => {
  if (panelDirty || editorDirty || saving) { event.preventDefault(); event.returnValue = ''; }
});
panel.addEventListener('input', event => { if (event.target.closest('.settings-form')) panelDirty = true; });
entryForm.addEventListener('input', () => { editorDirty = true; });
function closeEditor() {
  if (isBusy()) return;
  if (editorDirty && !confirm('Discard changes to this entry?')) return;
  editorDirty = false; dialog.close();
}
dialog.addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
document.querySelector('#close-editor').addEventListener('click', closeEditor);
document.querySelector('#cancel-editor').addEventListener('click', closeEditor);
document.querySelector('#logout').addEventListener('click', async () => {
  if (!canLeave()) return;
  try { await api('/api/auth/logout', 'POST'); panelDirty = editorDirty = false; location.assign('/admin/login'); }
  catch (error) { announce(error.message, true); }
});

// One field factory keeps labels, input ids, help text and validation consistent.
function field(definition, value) {
  const wrapper = node('div', 'field' + (definition.type === 'textarea' || definition.type === 'media' ? ' wide' : ''));
  const id = 'field-' + definition.key.replaceAll('.', '-');
  const label = node('label', '', definition.label); label.htmlFor = id; wrapper.append(label);
  let input;
  if (definition.type === 'textarea') input = node('textarea');
  else if (definition.type === 'select' || definition.type === 'boolean') {
    input = node('select');
    const options = definition.type === 'boolean' ? [['no', 'No'], ['yes', 'Yes']] : definition.options.map(option => Array.isArray(option) ? option : [option, option]);
    for (const [key, title] of options) { const option = node('option', '', title); option.value = key; input.append(option); }
  } else { input = node('input'); input.type = definition.type || 'text'; }
  input.id = id; input.name = definition.key;
  input.value = value ?? '';
  if (definition.max) input.maxLength = definition.max;
  if (definition.required) input.required = true;
  wrapper.append(input);
  if (definition.help) { const help = node('p', 'help', definition.help); help.id = id + '-help'; input.setAttribute('aria-describedby', help.id); wrapper.append(help); }
  return wrapper;
}
function contrast(first, second) {
  const light = hex => {
    const rgb = hex.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const a = light(first), b = light(second); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
function settingsForm(sectionId) {
  const section = state.sections.find(section => section.id === sectionId);
  const form = node('form', 'settings-form');
  form.append(node('p', 'panel-intro', section.description));
  for (const group of section.groups) {
    const details = node('details', 'settings-group');
    if (section.groups.indexOf(group) === 0) details.open = true;
    details.append(node('summary', '', group.title));
    const body = node('div', 'group-body');
    if (group.description) body.append(node('p', 'help', group.description));
    const grid = node('div', 'form-grid'); group.fields.forEach(def => grid.append(field(def, state.values[def.key]))); body.append(grid);
    if (group.isTheme) {
      const message = node('p', 'contrast-note');
      const update = () => {
        const value = key => form.elements.namedItem('theme.' + key)?.value || state.values['theme.' + key];
        const pairs = [['Body / background', value('text'), value('background')], ['Body / cards', value('text'), value('surface')], ['Headings / background', value('heading'), value('background')], ['Headings / cards', value('heading'), value('surface')], ['Links / background', value('accent'), value('background')], ['Button text', '#ffffff', value('accent')]];
        message.textContent = pairs.map(([name, a, b]) => `${name}: ${contrast(a, b).toFixed(1)}:1${contrast(a, b) < 4.5 ? ' — low contrast' : ''}`).join(' · ');
      };
      grid.addEventListener('input', update); queueMicrotask(update); body.append(message);
    }
    details.append(body); form.append(details);
  }
  const bar = node('div', 'save-bar'); const save = node('button', 'button', 'Save changes'); save.type = 'submit'; bar.append(save, node('span', 'help', 'Saved changes appear on the public site.')); form.append(bar);
  form.addEventListener('submit', async event => {
    event.preventDefault(); save.disabled = true; saving = true;
    try {
      const result = await api('/api/admin/settings', 'PUT', { values: Object.fromEntries(new FormData(form)) });
      state.values = result.values; panelDirty = false; announce('Changes saved.');
    } catch (error) { announce(error.message, true); }
    finally { save.disabled = false; saving = false; }
  }); return form;
}
async function upload(file, path = '/api/admin/media') {
  if (!file) throw new Error('Choose a file first.');
  const form = new FormData(); form.append('file', file);
  return (await api(path, 'POST', form)).file;
}
function fileSlot(slot, title, accept) {
  const box = node('section', 'file-slot'); box.append(node('h3', '', title));
  const current = state.files[slot];
  const text = node('p', '', current ? current.originalName : 'No file uploaded.'); box.append(text);
  if (current) {
    const a = node('a', 'text-link', 'Open current file ↗'); a.href = current.url; a.target = '_blank'; a.rel = 'noopener'; box.append(a);
  }
  const actions = node('div', 'actions'); const input = node('input'); input.type = 'file'; input.accept = accept; input.setAttribute('aria-label', title + ' file');
  actions.append(input, button(current ? 'Replace file' : 'Upload file', async () => {
    saving = true;
    try {
      const file = await upload(input.files[0], '/api/admin/site-files/' + slot);
      state.files[slot] = file; media = (await api('/api/admin/media')).media;
      box.replaceWith(fileSlot(slot, title, accept)); announce(title + ' updated.');
    } finally { saving = false; }
  }));
  if (current) actions.append(button('Remove from site', async () => {
    if (!confirm('Remove this file from the site? It will remain in Media.')) return;
    const result = await api('/api/admin/site-files/' + slot, 'DELETE'); state.files = result.files;
    box.replaceWith(fileSlot(slot, title, accept)); announce(title + ' removed from the site.');
  }));
  box.append(actions, node('p', 'help', slot === 'cv' ? 'PDF, up to 20 MB. Replacing the file updates the viewer and download button.' : 'Images: JPEG, PNG, WebP or GIF, up to 5 MB. Favicon also accepts ICO, up to 1 MB.'));
  return box;
}
function mediaField(key, title, kind, value) {
  const wrapper = node('div', 'field wide'); const id = 'entry-' + key;
  const label = node('label', '', title); label.htmlFor = id; wrapper.append(label);
  const select = node('select'); select.id = id; select.name = key;
  const populate = selected => {
    select.replaceChildren(); const none = node('option', '', 'None'); none.value = ''; select.append(none);
    media.filter(item => item.kind === kind).forEach(item => { const option = node('option', '', item.originalName + ' (#' + item.id + ')'); option.value = item.id; select.append(option); }); select.value = selected || '';
  }; populate(value);
  const row = node('div', 'file-select-row'); row.append(select);
  const input = node('input'); input.type = 'file'; input.accept = kind === 'pdf' ? '.pdf' : '.jpg,.jpeg,.png,.webp,.gif'; input.setAttribute('aria-label', 'Upload ' + title.toLowerCase());
  row.append(input, button('Upload & select', async () => {
    saving = true;
    try {
      const file = await upload(input.files[0], '/api/admin/media?accept=' + kind);
      media.unshift(file); populate(file.id); editorDirty = true;
      document.querySelector('#editor-message').textContent = 'File uploaded. Save the entry to attach it.';
    } catch (error) { document.querySelector('#editor-message').textContent = error.message; }
    finally { saving = false; }
  }));
  wrapper.append(row, node('p', 'help', kind === 'pdf' ? 'First-page previews are generated automatically. Uploads remain private until used by published content.' : 'Use a cover image or landing-page screenshot. Leave empty for a styled placeholder.'));
  return wrapper;
}
const sharedFields = [
  { key: 'title', label: 'Title', required: true, max: 150 },
  { key: 'status', label: 'Visibility', type: 'select', options: [['draft', 'Draft — private'], ['published', 'Published — public']] },
];
const schemas = {
  projects: [...sharedFields,
    { key: 'type', label: 'Project type', type: 'select', options: ['github', 'website', 'other'] },
    { key: 'url', label: 'Destination URL', type: 'url', help: 'Use a full https:// address. Required for published projects.' },
    { key: 'description', label: 'Short description', type: 'textarea', max: 600 },
    { key: 'tags', label: 'Tags', help: 'Comma-separated; at most 8 tags.' },
    { key: 'date', label: 'Date (optional)', type: 'date' },
    { key: 'featured', label: 'Featured on Home', type: 'boolean' },
    { key: 'coverAlt', label: 'Cover image description', max: 200 }],
  research: [...sharedFields,
    { key: 'abstract', label: 'Abstract / description', type: 'textarea', max: 3000 },
    { key: 'authors', label: 'Authors', max: 300 },
    { key: 'docType', label: 'Document type', max: 40, help: 'For example: Essay, Policy brief, Research paper.' },
    { key: 'date', label: 'Date (optional)', type: 'date' },
    { key: 'tags', label: 'Topics', help: 'Comma-separated; at most 8 tags.' },
    { key: 'externalUrl', label: 'External publication URL (optional)', type: 'url' },
    { key: 'featured', label: 'Featured on Home', type: 'boolean' },
    { key: 'coverAlt', label: 'Cover image description', max: 200 }],
  'cv-entries': [...sharedFields,
    { key: 'section', label: 'Section', type: 'select', options: ['education', 'experience', 'volunteering', 'skills', 'languages'] },
    { key: 'organization', label: 'Organization', max: 150 },
    { key: 'location', label: 'Location', max: 100 },
    { key: 'period', label: 'Period', max: 60, help: 'For example: 2026–present.' },
    { key: 'description', label: 'Details', type: 'textarea', max: 1500 }],
};
function edit(kind, entry = {}) {
  if (saving) return;
  editorKind = kind; editingEntry = entry; editorDirty = false;
  document.querySelector('#editor-title').textContent = (entry.id ? 'Edit ' : 'Add ') + ({ projects: 'project', research: 'research', 'cv-entries': 'CV entry' }[kind]);
  document.querySelector('#editor-message').textContent = '';
  const fields = document.querySelector('#entry-fields'); fields.replaceChildren();
  for (const def of schemas[kind]) {
    let value = entry[def.key] ?? ({ status: 'draft', type: 'github', section: 'education', featured: false }[def.key] ?? '');
    if (Array.isArray(value)) value = value.join(', ');
    if (def.key === 'featured') value = value ? 'yes' : 'no';
    fields.append(field(def, value));
  }
  if (kind !== 'cv-entries') fields.append(mediaField('coverMediaId', 'Cover image', 'image', entry.cover?.id));
  if (kind === 'research') fields.append(mediaField('pdfMediaId', 'Research PDF', 'pdf', entry.pdf?.id));
  dialog.showModal(); fields.querySelector('input')?.focus();
}
entryForm.addEventListener('submit', async event => {
  event.preventDefault(); if (saving) return;
  const save = entryForm.querySelector('[type=submit]'); save.disabled = true; saving = true;
  try {
    const payload = Object.fromEntries(new FormData(entryForm));
    await api('/api/admin/' + editorKind + (editingEntry.id ? '/' + editingEntry.id : ''), editingEntry.id ? 'PUT' : 'POST', payload);
    editorDirty = false; dialog.close();
    // Refresh only the list so unsaved page-text edits remain in their form.
    await refreshList(editorKind); announce('Entry saved.');
  } catch (error) { document.querySelector('#editor-message').textContent = error.message; }
  finally { saving = false; save.disabled = false; }
});
async function refreshList(kind) {
  const container = document.querySelector('[data-list="' + kind + '"]'); if (!container) return;
  const data = await api('/api/admin/' + kind);
  container.replaceChildren();
  const groups = kind === 'cv-entries' ? Object.entries(data.entries) : [[null, data[kind]]];
  let count = 0;
  for (const [section, entries] of groups) {
    if (!entries.length) continue;
    count += entries.length;
    if (section) container.append(node('h3', '', section.charAt(0).toUpperCase() + section.slice(1)));
    entries.forEach((entry, index) => {
      const row = node('article', 'entry-row');
      const summary = node('div'); summary.append(node('h3', '', entry.title), node('span', 'badge ' + entry.status, entry.status + (entry.featured ? ' · featured' : '')));
      const actions = node('div', 'row-actions');
      for (const [direction, text] of [[-1, '↑'], [1, '↓']]) {
        const move = button(text, async () => {
          const ids = entries.map(e => e.id); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
          await api('/api/admin/' + kind + '/order', 'PUT', { ids, ...(section ? { section } : {}) });
          await refreshList(kind); announce('Display order updated.');
        }); move.disabled = index + direction < 0 || index + direction >= entries.length;
        move.setAttribute('aria-label', `Move ${entry.title} ${direction < 0 ? 'up' : 'down'}`); actions.append(move);
      }
      actions.append(button('Edit', () => edit(kind, entry)));
      const preview = node('a', 'plain-button', 'Preview ↗'); preview.target = '_blank'; preview.rel = 'noopener';
      preview.href = kind === 'research' ? '/research/' + entry.id : '/' + (kind === 'cv-entries' ? 'cv' : 'projects') + '?preview=1'; actions.append(preview);
      actions.append(button('Delete', async () => {
        if (!confirm(`Delete “${entry.title}”? Uploaded files remain in Media.`)) return;
        await api('/api/admin/' + kind + '/' + entry.id, 'DELETE'); await refreshList(kind); announce('Entry deleted.');
      })); row.append(summary, actions); container.append(row);
    });
  }
  if (!count) container.append(node('p', 'empty-admin', 'No entries yet. Add your first one above.'));
}
async function contentList(kind) {
  const wrapper = node('section');
  const toolbar = node('div', 'list-toolbar'); toolbar.append(node('h2', '', kind === 'cv-entries' ? 'Structured CV entries' : 'Your entries'), button('＋ Add entry', () => edit(kind), 'button')); wrapper.append(toolbar);
  if (kind === 'cv-entries') wrapper.append(node('p', 'help', 'These entries appear below the PDF. Editing them does not rewrite the uploaded PDF; upload a replacement to change that document.'));
  const list = node('div', 'entry-list'); list.dataset.list = kind; wrapper.append(list); panel.append(wrapper); await refreshList(kind);
}
async function mediaPanel() {
  panel.append(node('p', 'panel-intro', 'Manage uploaded files. Files are public only while used by published content or a site-wide file slot. Unused files and files used only by drafts stay private.'));
  for (const [slot, title, accept] of [['portrait', 'Portrait', '.jpg,.jpeg,.png,.webp,.gif'], ['cv', 'CV PDF', '.pdf'], ['favicon', 'Favicon', '.ico,.jpg,.jpeg,.png,.webp,.gif']]) panel.append(fileSlot(slot, title, accept));
  panel.append(node('h2', 'media-heading', 'All uploaded files'));
  const uploadBox = node('div', 'file-slot'); const input = node('input'); input.type = 'file'; input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.gif'; input.setAttribute('aria-label', 'New media file');
  uploadBox.append(input, button('Upload file', async () => { saving = true; try { await upload(input.files[0]); await showPanel('media', true); announce('File uploaded.'); } finally { saving = false; } })); panel.append(uploadBox);
  const list = node('div', 'entry-list'); panel.append(list);
  if (!media.length) list.append(node('p', 'empty-admin', 'No uploaded files yet.'));
  for (const file of media) {
    const row = node('article', 'entry-row media-item'); const content = node('div');
    if (file.kind === 'image') { const image = node('img', 'media-preview'); image.src = file.url; image.alt = ''; image.loading = 'lazy'; content.append(image); }
    content.append(node('h3', '', file.originalName), node('p', '', `${(file.sizeBytes / 1024).toFixed(0)} KB · ${file.usage?.some(place => place.isPublic) ? 'Public' : 'Private'}`), node('p', '', file.usage?.map(place => place.label).join('; ') || 'Not used yet'));
    const actions = node('div', 'row-actions'); const open = node('a', 'plain-button', 'Open ↗'); open.href = file.url; open.target = '_blank'; open.rel = 'noopener'; actions.append(open, button('Delete file', async () => {
      if (!confirm('Permanently delete ' + file.originalName + '?')) return;
      await api('/api/admin/media/' + file.id, 'DELETE'); await showPanel('media', true); announce('File deleted.');
    })); row.append(content, actions); list.append(row);
  }
}
const panels = [['home', 'Home'], ['site', 'Site settings'], ['cv', 'CV'], ['projects', 'Projects'], ['research', 'Research'], ['contact', 'Contact'], ['media', 'Media']];
async function showPanel(id, force = false) {
  if (!force && !canLeave()) return;
  const requestId = ++panelRequest;
  currentPanel = id; panelDirty = false; notice.textContent = '';
  document.querySelector('#panel-title').textContent = panels.find(([key]) => key === id)[1];
  document.querySelectorAll('#admin-nav button').forEach(b => { if (b.dataset.panel === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  panel.replaceChildren(node('p', '', 'Loading…'));
  try {
    const nextState = await api('/api/admin/settings');
    const nextMedia = (await api('/api/admin/media')).media;
    if (requestId !== panelRequest) return;
    state = nextState; media = nextMedia;
    panel.replaceChildren();
    if (id === 'media') return await mediaPanel();
    if (id === 'home') panel.append(fileSlot('portrait', 'Portrait', '.jpg,.jpeg,.png,.webp,.gif'));
    if (id === 'cv') { panel.append(fileSlot('cv', 'CV PDF', '.pdf')); await contentList('cv-entries'); }
    if (id === 'site') panel.append(fileSlot('favicon', 'Favicon', '.ico,.jpg,.jpeg,.png,.webp,.gif'));
    if (id === 'projects' || id === 'research') await contentList(id);
    if (requestId !== panelRequest) return;
    panel.append(settingsForm(id));
  } catch (error) { panel.replaceChildren(node('p', 'error', error.message)); }
}
async function start() {
  const session = await api('/api/auth/session'); if (!session.signedIn) return location.assign('/admin/login');
  token = session.csrfToken;
  document.querySelector('#admin-user').textContent = 'Signed in as ' + session.username;
  const nav = document.querySelector('#admin-nav');
  panels.forEach(([key, title]) => { const b = button(title, () => showPanel(key)); b.dataset.panel = key; nav.append(b); });
  await showPanel(currentPanel, true);
}
start().catch(error => announce(error.message, true));
