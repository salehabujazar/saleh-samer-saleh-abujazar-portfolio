// Optional structured CV entries (education, experience, ...).
// These are shown on the CV page below the PDF. They never change the PDF file.
import { db, saveDisplayOrder } from '../db/database.js';
import { cleanText, cleanChoice, cleanOrderList } from '../security/validation.js';

export const CV_SECTIONS = ['education', 'experience', 'volunteering', 'skills', 'languages'];

const statements = {
  all: db.prepare('SELECT * FROM cv_entries ORDER BY sort_order, id'),
  published: db.prepare(`SELECT * FROM cv_entries WHERE status = 'published' ORDER BY sort_order, id`),
  byId: db.prepare('SELECT * FROM cv_entries WHERE id = ?'),
  idsInSection: db.prepare('SELECT id FROM cv_entries WHERE section = ?'),
  highestOrder: db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM cv_entries WHERE section = ?'),
  insert: db.prepare(`
    INSERT INTO cv_entries (section, title, organization, location, period, description, status, sort_order)
    VALUES (@section, @title, @organization, @location, @period, @description, @status, @sort_order)
  `),
  update: db.prepare(`
    UPDATE cv_entries SET section = @section, title = @title, organization = @organization,
      location = @location, period = @period, description = @description, status = @status,
      updated_at = datetime('now')
    WHERE id = @id
  `),
  remove: db.prepare('DELETE FROM cv_entries WHERE id = ?'),
};

function toEntry(row) {
  return {
    id: row.id,
    section: row.section,
    title: row.title,
    organization: row.organization,
    location: row.location,
    period: row.period,
    description: row.description,
    status: row.status,
  };
}

/** Returns entries grouped by section: { education: [...], experience: [...], ... } */
export function listCvEntriesBySection({ includeDrafts = false } = {}) {
  const grouped = Object.fromEntries(CV_SECTIONS.map((section) => [section, []]));
  const rows = includeDrafts ? statements.all.all() : statements.published.all();
  for (const row of rows) grouped[row.section].push(toEntry(row));
  return grouped;
}

function cleanEntryInput(input) {
  return {
    section: cleanChoice(input.section, { field: 'section', label: 'Section', choices: CV_SECTIONS }),
    title: cleanText(input.title, { field: 'title', label: 'Title', max: 150, required: true }),
    organization: cleanText(input.organization, { field: 'organization', label: 'Organisation', max: 150 }),
    location: cleanText(input.location, { field: 'location', label: 'Location', max: 100 }),
    period: cleanText(input.period, { field: 'period', label: 'Period', max: 60 }),
    description: cleanText(input.description, { field: 'description', label: 'Details', max: 1500, multiline: true }),
    status: cleanChoice(input.status, { field: 'status', label: 'Visibility', choices: ['draft', 'published'] }),
  };
}

export function createCvEntry(input) {
  const values = cleanEntryInput(input);
  // New CV entries are added at the end of their section.
  values.sort_order = statements.highestOrder.get(values.section).value + 1;
  const result = statements.insert.run(values);
  return toEntry(statements.byId.get(Number(result.lastInsertRowid)));
}

export function updateCvEntry(id, input) {
  const existing = statements.byId.get(id);
  if (!existing) return null;
  const values = cleanEntryInput(input);
  statements.update.run({ ...values, id });
  if (values.section !== existing.section) {
    // Moved to another section: place it at the end there.
    db.prepare('UPDATE cv_entries SET sort_order = ? WHERE id = ?')
      .run(statements.highestOrder.get(values.section).value + 1, id);
  }
  return toEntry(statements.byId.get(id));
}

export function deleteCvEntry(id) {
  return statements.remove.run(id).changes > 0;
}

export function reorderCvEntries(section, ids) {
  cleanChoice(section, { field: 'section', label: 'Section', choices: CV_SECTIONS });
  const existingIds = statements.idsInSection.all(section).map((row) => row.id);
  saveDisplayOrder('cv_entries', cleanOrderList(ids, existingIds));
}
