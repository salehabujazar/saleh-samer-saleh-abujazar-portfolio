# Saleh’s portfolio

A complete editable portfolio built with plain HTML, CSS and vanilla JavaScript, plus a Node.js/Express backend and SQLite database. There is no frontend build step.

## Start on Windows

1. Install Node.js 22.13 or newer if needed. Check your installed version with `node --version`.
2. Extract this ZIP. Open the extracted `saleh-portfolio` folder that contains `package.json`.
3. Open PowerShell in that folder and run these commands one at a time:

```powershell
npm install
npm run setup
npm start
```

If PowerShell says it cannot run `npm.ps1`, use `npm.cmd` instead of `npm` in each command. No execution-policy change is necessary.

Setup creates a random session secret in `.env`, seeds demonstration entries, and asks you to choose an administrator username and password. Use at least 12 characters for the password. Password typing is hidden, including when you paste it. Setup does not overwrite existing content or credentials. If a username already exists, create a different username using `npm run create-admin`.

Open:

- Public site: http://localhost:3000
- Dashboard: http://localhost:3000/admin

Keep the terminal open while using the site. Press Ctrl+C to stop. Later, you only need `npm start`. The app needs its server: do not double-click the HTML files or open them with Live Server.

If Node is not recognized after installing it, reopen PowerShell. If port 3000 is already occupied, edit PORT in `.env`, restart, and use that port in the URL.

## Manage content

- **Home:** edit the introduction, portrait, About text, interests, and section headings.
- **Site settings:** edit navigation, footer, search descriptions, shared labels, and five theme colors. Contrast indicators flag combinations below 4.5:1; choose accessible colors.
- **CV:** upload or replace the PDF, edit surrounding text, and manage the optional structured entries below it. Structured entries do not alter the uploaded PDF.
- **Projects:** add GitHub, website, or other links; upload a cover/screenshot; set tags and featured status. GitHub cards have a built-in mark; websites without screenshots show their domain. Automatic website screenshots are intentionally not included.
- **Research:** upload a PDF or link to a publication, add a description and metadata, and optionally choose a cover. PDF.js renders the first page on cards. Corrupt, encrypted or unsupported PDFs retain a document placeholder; visitors can still open/download the document.
- **Contact:** enter your real email and social links. Empty contact methods stay hidden.
- **Media:** upload, inspect and delete unused files; manage the portrait, CV and favicon.

Click **Save changes** for page text. In entry editors, click **Upload & select**, then **Save entry**. An uploaded file becomes attached only when the entry is saved. Drafts and their otherwise-unused files stay private. Files reused on published entries or in a site-wide slot are public, even if they are also referenced by a draft.

New entries start as drafts. Select **Published — public** and save when ready. Use the ↑ / ↓ buttons to reorder entries. Mark entries as featured to put them on Home. Preview links display drafts only while you are signed in.

The demo entries are explicitly labeled Sample and their links are placeholders. Replace or delete them. No CV PDF is supplied: upload your real one. Contact addresses and social links start blank.

## Files and how they connect

```text
views/                 Plain HTML page templates
  partials/            Shared head, navigation and footer
  admin/               Login and dashboard HTML
public/
  css/site.css         Public layout and responsive styles
  css/admin.css        Dashboard layout and forms
  js/public.js         Content lists, tag filters and PDF thumbnails
  js/admin.js          Dashboard forms and content editors
  js/login.js          Sign-in form
  images/favicon.svg   Default local icon
server/
  server.js            Connects Express, sessions, routes and assets
  config.js            Environment settings and storage paths
  db/                  SQLite tables and persistent session store
  content/             Queries and validation for each content type
  routes/              Public pages, read API, admin API and login
  rendering/           Escapes text and fills HTML placeholders
  security/            Password hashing, CSRF and input validation
  uploads/             File-size and content-type checks
scripts/               Setup, account creation, seeding, backup, restore
tests/                 HTTP integration tests using temporary data
```

Templates use escaped placeholders such as `{{home.hero_name}}`. `server/content/settings-schema.js` defines editable settings; the dashboard builds its forms from that schema. List pages load JSON from `/api/public`. Dashboard edits use protected `/api/admin` endpoints. SQLite saves the content, and uploaded files live on disk. `/media` checks each file’s current visibility before serving it.

Runtime data is created inside `data/`. Your SQLite database is `data/site.db`; uploaded files are in `data/uploads/`. These files, `.env`, backups and `node_modules` must stay out of Git. The ZIP includes source and a lockfile, not machine-specific dependencies or administrator credentials.

To add a new editable paragraph in code, add a field to `settings-schema.js`, reference its key in the appropriate HTML template, and restart the server. For normal content editing, use the dashboard instead.

## Back up and restore

Stop the server before backup so the database and uploads are consistent, then run:

```powershell
npm run backup
```

This creates a dated folder under `backups/` containing `site.db` and `uploads/`. Keep both together and copy the backup somewhere safe. Also keep a separate private copy of `.env`; the backup does not include secrets.

To restore, stop the server and run:

```powershell
npm run restore -- "backups/YOUR-BACKUP-FOLDER" --confirm
```

Restore preserves your previous data in an adjacent `data-before-restore-...` folder. Restart the server after restoring. Backups contain account password hashes and may contain private drafts, so keep them private.

## Verification

Run `npm test`. The included suite uses temporary data and checks public routes/assets, authentication, CSRF, editing and HTML escaping, project publication and reordering, invalid uploads, draft file privacy, PDF downloads, research publication, CV replacement, structured CV operations, database persistence across processes, deletion and logout.

All 10 workflow checks passed in the development environment (11 test-runner results including the parent suite). All source JavaScript passed syntax checking.

Automated browser control was unavailable in the build environment. The responsive CSS, keyboard behavior, dashboard interactions and PDF canvas rendering have not been visually verified in an actual browser. On your laptop, check the five pages at desktop and phone widths, open the menu with a keyboard, upload a real PDF, and save one dashboard edit. The HTTP/backend behavior is tested; pixel-level layout and browser-specific PDF behavior still require this local check.

## Hosting later

This is not deployed. It runs locally by default, listening on 127.0.0.1.

Hosting requires a Node.js server with persistent disk storage for both SQLite and uploaded files. A static host alone cannot run the dashboard. A typical deployment runs Node behind an HTTPS reverse proxy on the same server. Keep the app’s loopback listener and let the proxy forward traffic to it.

Set `NODE_ENV=production`, a strong random `SESSION_SECRET`, and an absolute `DATA_DIR` pointing to persistent disk. Secure cookies are enabled in production. Set `TRUST_PROXY=1` only when exactly one trusted reverse proxy sits in front of the app. Run one application instance against its local SQLite database, use a process manager, and maintain backups. Do not expose `.env`, the database, or the uploads directory directly through your web server.

The site uses self-hosted fonts and PDF.js assets, so no font service, analytics, screenshot provider, or paid API is required. Dependency downloads require internet access during `npm install`.
