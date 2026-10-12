// End-to-end HTTP checks use a temporary database; your portfolio data is untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'saleh-portfolio-test-'));
process.env.DATA_DIR = directory;
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const seed = spawnSync(process.execPath, ['scripts/seed.js'], { encoding: 'utf8', env: process.env });
assert.equal(seed.status, 0, seed.stderr);
const { app } = await import('../server/server.js');
const { db } = await import('../server/db/database.js');
const { hashPassword } = await import('../server/security/passwords.js');
const password = crypto.randomBytes(24).toString('hex');
db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('test-admin', await hashPassword(password));
let server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
let base = `http://127.0.0.1:${server.address().port}`;
let cookie = '';
let csrf = '';
async function request(route, { method = 'GET', body, anonymous = false, noCsrf = false } = {}) {
  const headers = {};
  if (!anonymous && cookie) headers.Cookie = cookie;
  if (!noCsrf && csrf) headers['X-CSRF-Token'] = csrf;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  if (!anonymous && response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, headers: response.headers };
}
function pdfFile() {
  // Minimal valid one-page PDF used only as an upload fixture.
  const content = 'BT /F1 22 Tf 72 720 Td (Sample test document) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let source = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(source)); source += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(source); source += 'xref\n0 6\n0000000000 65535 f \n' + offsets.slice(1).map(x => String(x).padStart(10, '0') + ' 00000 n \n').join('');
  source += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`; return source;
}
async function upload(route, content, name, mime) {
  const form = new FormData(); form.append('file', new Blob([content], { type: mime }), name); return request(route, { method: 'POST', body: form });
}
let projectId, researchId, uploaded, cvId;
test('Portfolio workflows', async t => {
  await t.test('Public pages, assets, and navigation render without unresolved placeholders', async () => {
    for (const route of ['/', '/cv', '/projects', '/research', '/contact', '/admin/login']) {
      const response = await request(route, { anonymous: true }); assert.equal(response.status, 200, route); assert.ok(response.data.includes('<!doctype html>')); assert.ok(!response.data.includes('{{'), route);
    }
    for (const route of ['/css/site.css', '/css/admin.css', '/js/public.js', '/js/admin.js', '/fonts/inter/inter-latin-wght-normal.woff2', '/fonts/fraunces/fraunces-latin-wght-normal.woff2', '/vendor/pdfjs/pdf.mjs', '/vendor/pdfjs/pdf.worker.mjs']) assert.equal((await request(route)).status, 200, route);
    assert.equal((await request('/missing')).status, 404);
    assert.equal((await request('/admin', { anonymous: true })).status, 302);
    assert.equal((await request('/api/admin/settings', { anonymous: true })).status, 401);
  });
  await t.test('Login, CSRF, and session cookie protections', async () => {
    const session = await request('/api/auth/session'); csrf = session.data.csrfToken;
    assert.match(session.headers.get('set-cookie'), /HttpOnly/i); assert.match(session.headers.get('set-cookie'), /SameSite=Lax/i);
    assert.equal((await request('/api/auth/login', { method: 'POST', noCsrf: true, body: { username: 'test-admin', password } })).status, 403);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'test-admin', password: 'incorrect' } })).status, 401);
    const login = await request('/api/auth/login', { method: 'POST', body: { username: 'test-admin', password } }); assert.equal(login.status, 200); csrf = login.data.csrfToken;
    assert.equal((await request('/admin')).status, 200);
    assert.equal((await request('/api/admin/settings', { method: 'PUT', noCsrf: true, body: { values: {} } })).status, 403);
  });
  await t.test('Settings persist, escape HTML, and reject invalid links', async () => {
    const response = await request('/api/admin/settings', { method: 'PUT', body: { values: { 'home.hero_name': '<script>alert(1)</script>', 'theme.accent': '#984c35' } } }); assert.equal(response.status, 200);
    const page = await request('/'); assert.ok(page.data.includes('&lt;script&gt;alert(1)&lt;/script&gt;')); assert.ok(!page.data.includes('<script>alert(1)</script>'));
    assert.ok((await request('/theme.css')).data.includes('#984c35'));
    assert.equal((await request('/api/admin/settings', { method: 'PUT', body: { values: { 'contact.github': 'javascript:alert(1)' } } })).status, 400);
  });
  await t.test('Project creation, editing, publishing, ordering and draft preview', async () => {
    const input = { title: 'Private test project', type: 'website', url: 'https://example.com', status: 'draft', tags: 'Test, Web' };
    const created = await request('/api/admin/projects', { method: 'POST', body: input }); assert.equal(created.status, 201); projectId = created.data.project.id;
    assert.ok(!(await request('/api/public/projects?preview=1', { anonymous: true })).data.projects.some(x => x.id === projectId));
    assert.ok((await request('/api/public/projects?preview=1')).data.projects.some(x => x.id === projectId));
    assert.equal((await request('/api/admin/projects/' + projectId, { method: 'PUT', body: { ...input, title: 'Published test project', status: 'published', featured: true } })).status, 200);
    assert.ok((await request('/api/public/projects', { anonymous: true })).data.projects.some(x => x.id === projectId));
    const ids = (await request('/api/admin/projects')).data.projects.map(x => x.id).reverse();
    assert.equal((await request('/api/admin/projects/order', { method: 'PUT', body: { ids } })).status, 200);
    assert.deepEqual((await request('/api/admin/projects')).data.projects.map(x => x.id), ids);
  });
  await t.test('Uploads reject unsupported files and protect unused files', async () => {
    assert.equal((await upload('/api/admin/media', '<html>not an image</html>', 'fake.png', 'image/png')).status, 400);
    assert.equal((await upload('/api/admin/media', Buffer.alloc(21 * 1024 * 1024), 'large.pdf', 'application/pdf')).status, 413);
    const response = await upload('/api/admin/media?accept=pdf', pdfFile(), 'test.pdf', 'application/pdf'); assert.equal(response.status, 201); uploaded = response.data.file;
    assert.equal((await request(uploaded.url, { anonymous: true })).status, 404); assert.equal((await request(uploaded.url)).status, 200);
  });
  await t.test('Research PDF publication, detail page, downloads and unpublishing', async () => {
    const input = { title: 'Test PDF research', abstract: 'Test abstract', status: 'draft', pdfMediaId: uploaded.id, featured: true };
    const created = await request('/api/admin/research', { method: 'POST', body: input }); assert.equal(created.status, 201); researchId = created.data.entry.id;
    assert.equal((await request('/research/' + researchId, { anonymous: true })).status, 404);
    assert.equal((await request('/research/' + researchId)).status, 200);
    await request('/api/admin/research/' + researchId, { method: 'PUT', body: { ...input, status: 'published' } });
    assert.equal((await request('/research/' + researchId, { anonymous: true })).status, 200);
    assert.equal((await request(uploaded.url, { anonymous: true })).status, 200);
    const download = await request(uploaded.downloadUrl, { anonymous: true }); assert.match(download.headers.get('content-disposition'), /attachment/); assert.match(download.headers.get('content-type'), /application\/pdf/);
    assert.equal((await request('/api/admin/media/' + uploaded.id, { method: 'DELETE' })).status, 400);
    await request('/api/admin/research/' + researchId, { method: 'PUT', body: input });
    assert.equal((await request(uploaded.url, { anonymous: true })).status, 404);
  });
  await t.test('CV replacement updates links and makes the previous file private', async () => {
    const first = await upload('/api/admin/site-files/cv', pdfFile(), 'cv-one.pdf', 'application/pdf'); assert.equal(first.status, 201);
    const second = await upload('/api/admin/site-files/cv', pdfFile(), 'cv-two.pdf', 'application/pdf'); cvId = second.data.file.id;
    assert.equal((await request(first.data.file.url, { anonymous: true })).status, 404);
    assert.equal((await request('/api/public/cv')).data.cv.id, cvId);
    assert.ok((await request('/cv')).data.includes(second.data.file.url));
    assert.equal((await request(second.data.file.downloadUrl, { anonymous: true })).status, 200);
  });
  await t.test('CV entries can be created, edited, reordered and deleted', async () => {
    const input = { section: 'skills', title: 'Test skill', description: 'Before', status: 'published' };
    const created = await request('/api/admin/cv-entries', { method: 'POST', body: input }); assert.equal(created.status, 201); const id = created.data.entry.id;
    assert.equal((await request('/api/admin/cv-entries/' + id, { method: 'PUT', body: { ...input, description: 'After' } })).data.entry.description, 'After');
    const ids = (await request('/api/admin/cv-entries')).data.entries.skills.map(x => x.id).reverse();
    assert.equal((await request('/api/admin/cv-entries/order', { method: 'PUT', body: { section: 'skills', ids } })).status, 200);
    assert.deepEqual((await request('/api/public/cv')).data.entries.skills.map(x => x.id), ids);
    assert.equal((await request('/api/admin/cv-entries/' + id, { method: 'DELETE' })).status, 200);
  });
  await t.test('Saved data can be reopened by a separate Node process', async () => {
    const check = spawnSync(process.execPath, ['--input-type=module', '-e', "import {db} from './server/db/database.js'; console.log(JSON.stringify({name:db.prepare(\"SELECT value FROM settings WHERE key='home.hero_name'\").get().value,cv:db.prepare(\"SELECT value FROM settings WHERE key='media.cv'\").get().value})); db.close();"], { env: process.env, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr); const stored = JSON.parse(check.stdout); assert.equal(stored.name, '<script>alert(1)</script>'); assert.equal(Number(stored.cv), cvId);
    const again = spawnSync(process.execPath, ['scripts/seed.js'], { env: process.env, encoding: 'utf8' }); assert.equal(again.status, 0); assert.ok(again.stdout.includes('already seeded'));
  });
  await t.test('Delete entries and media; logout removes access', async () => {
    assert.equal((await request('/api/admin/projects/' + projectId, { method: 'DELETE' })).status, 200);
    assert.equal((await request('/api/admin/research/' + researchId, { method: 'DELETE' })).status, 200);
    assert.equal((await request('/api/admin/media/' + uploaded.id, { method: 'DELETE' })).status, 200);
    assert.equal((await request(uploaded.url)).status, 404);
    assert.equal((await request('/api/auth/logout', { method: 'POST' })).status, 200);
    assert.equal((await request('/api/admin/settings')).status, 401);
  });
});
test.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
