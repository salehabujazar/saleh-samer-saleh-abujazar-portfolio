// Projects: database queries, validation and conversion to API objects.
import { db, saveDisplayOrder } from '../db/database.js';
import { getMediaInfo, assertMediaKind } from './media.js';
import {
  cleanText, cleanUrl, cleanDate, cleanTags, cleanChoice, cleanBoolean, cleanOptionalId,
  cleanOrderList, ValidationError,
} from '../security/validation.js';

export const PROJECT_TYPES = ['github', 'website', 'other'];

const statements = {
  all: db.prepare('SELECT * FROM projects ORDER BY sort_order, id'),
  published: db.prepare(`SELECT * FROM projects WHERE status = 'published' ORDER BY sort_order, id`),
  byId: db.prepare('SELECT * FROM projects WHERE id = ?'),
  ids: db.prepare('SELECT id FROM projects'),
  lowestOrder: db.prepare('SELECT COALESCE(MIN(sort_order), 0) AS value FROM projects'),
  insert: db.prepare(`
    INSERT INTO projects (title, description, project_type, url, cover_media_id, cover_alt,
                          tags, project_date, is_featured, status, sort_order)
    VALUES (@title, @description, @project_type, @url, @cover_media_id, @cover_alt,
            @tags, @project_date, @is_featured, @status, @sort_order)
  `),
  update: db.prepare(`
    UPDATE projects SET title = @title, description = @description, project_type = @project_type,
      url = @url, cover_media_id = @cover_media_id, cover_alt = @cover_alt, tags = @tags,
      project_date = @project_date, is_featured = @is_featured, status = @status,
      updated_at = datetime('now')
    WHERE id = @id
  `),
  remove: db.prepare('DELETE FROM projects WHERE id = ?'),
};

/** Converts a database row into the object sent to the browser. */
function toProject(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.project_type,
    url: row.url,
    cover: getMediaInfo(row.cover_media_id),
    coverAlt: row.cover_alt,
    tags: JSON.parse(row.tags),
    date: row.project_date,
    featured: Boolean(row.is_featured),
    status: row.status,
  };
}

export function listProjects({ includeDrafts = false } = {}) {
  const rows = includeDrafts ? statements.all.all() : statements.published.all();
  return rows.map(toProject);
}

export function getProject(id) {
  const row = statements.byId.get(id);
  return row ? toProject(row) : null;
}

/** Validates dashboard input and returns values ready for the database. */
function cleanProjectInput(input) {
  const projectType = cleanChoice(input.type, { field: 'type', label: 'Project type', choices: PROJECT_TYPES });
  const status = cleanChoice(input.status, { field: 'status', label: 'Status', choices: ['draft', 'published'] });
  const projectUrl = cleanUrl(input.url, { field: 'url', label: 'Destination URL', required: status === 'published' });

  if (projectType === 'github' && projectUrl && !/^https:\/\/(www\.)?github\.com\/[^/]+/i.test(projectUrl)) {
    throw new ValidationError('A GitHub project needs a github.com address, e.g. https://github.com/user/repository.', 'url');
  }

  const coverId = cleanOptionalId(input.coverMediaId, { field: 'coverMediaId', label: 'Cover image' });
  return {
    title: cleanText(input.title, { field: 'title', label: 'Title', max: 150, required: true }),
    description: cleanText(input.description, { field: 'description', label: 'Short description', max: 600, multiline: true }),
    project_type: projectType,
    url: projectUrl,
    cover_media_id: assertMediaKind(coverId, ['image'], 'The cover'),
    cover_alt: cleanText(input.coverAlt, { field: 'coverAlt', label: 'Cover alt text', max: 200 }),
    tags: JSON.stringify(cleanTags(input.tags)),
    project_date: cleanDate(input.date, { field: 'date', label: 'Date' }),
    is_featured: cleanBoolean(input.featured) ? 1 : 0,
    status,
  };
}

export function createProject(input) {
  const values = cleanProjectInput(input);
  // New projects go to the top of the list; they can be moved afterwards.
  values.sort_order = statements.lowestOrder.get().value - 1;
  const result = statements.insert.run(values);
  return getProject(Number(result.lastInsertRowid));
}

export function updateProject(id, input) {
  if (!statements.byId.get(id)) return null;
  statements.update.run({ ...cleanProjectInput(input), id });
  return getProject(id);
}

export function deleteProject(id) {
  return statements.remove.run(id).changes > 0;
}

export function reorderProjects(ids) {
  const existingIds = statements.ids.all().map((row) => row.id);
  saveDisplayOrder('projects', cleanOrderList(ids, existingIds));
}
