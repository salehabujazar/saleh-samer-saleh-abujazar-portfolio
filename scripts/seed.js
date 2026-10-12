// Creates demo entries once. Running this again never replaces your edits.
import { db } from '../server/db/database.js';
import { ensureDefaultSettings, saveSettings } from '../server/content/settings.js';
import { createProject } from '../server/content/projects.js';
import { createResearch } from '../server/content/research.js';
import { createCvEntry } from '../server/content/cv-entries.js';
ensureDefaultSettings();
const seeded = db.prepare("SELECT value FROM settings WHERE key = '_demo_seeded'").get();
if (!seeded) {
  db.transaction(() => {
    saveSettings({ 'contact.email': '', 'contact.linkedin': '', 'contact.github': '' });
    if (!db.prepare('SELECT id FROM projects LIMIT 1').get()) {
      for (const [title, description, type, url, tags] of [
        ['Sample · Open-source toolkit', 'A placeholder for a future repository: small, practical tools with clear documentation.', 'github', 'https://github.com/your-username/your-repository', ['JavaScript', 'Open source']],
        ['Sample · Student budget planner', 'A demonstration project card for a simple monthly budget and expense tracker.', 'website', 'https://example.com', ['Web', 'Everyday tools']],
        ['Sample · Civic reading room', 'A demonstration of how a research or civic technology website could appear here.', 'website', 'https://example.com', ['Civic tech', 'Design']],
      ]) createProject({ title, description, type, url, tags, status: 'published', featured: true });
    }
    if (!db.prepare('SELECT id FROM research LIMIT 1').get()) {
      for (const [title, docType, tags] of [
        ['Sample · Digital rights in public life', 'Essay', ['Human rights', 'Technology']],
        ['Sample · Technology and democratic participation', 'Policy brief', ['Politics', 'Civic tech']],
        ['Sample · Accountability by design', 'Reading notes', ['Software', 'Society']],
      ]) createResearch({ title, abstract: 'Demonstration entry only, not a real publication. Replace this text and upload your own PDF from the dashboard. The current link leads to example.com.', docType, tags, externalUrl: 'https://example.com', status: 'published', featured: true });
    }
    if (!db.prepare('SELECT id FROM cv_entries LIMIT 1').get()) {
      createCvEntry({ section: 'education', title: 'Bachelor’s in Computer Engineering', organization: 'OsloMet', location: 'Oslo, Norway', period: '2026–present', description: 'Current undergraduate studies.', status: 'published' });
      createCvEntry({ section: 'skills', title: 'Sample · Add your technical skills', description: 'Replace this sample with the languages and tools you use.', status: 'published' });
      createCvEntry({ section: 'volunteering', title: 'Sample · Add an activism or volunteering role', description: 'Add the organization, dates and your contribution.', status: 'published' });
    }
    db.prepare("INSERT INTO settings (key, value) VALUES ('_demo_seeded', 'yes')").run();
  })();
  console.log('Sample content added. Replace it through the dashboard.');
} else console.log('Demo content was already seeded. Your changes were kept.');
db.close();
