// Research entries: database queries, validation and conversion to API objects.
import { db, saveDisplayOrder } from '../db/database.js';
import { getMediaInfo, assertMediaKind } from './media.js';
import {
  cleanText, cleanUrl, cleanDate, cleanTags, cleanChoice, cleanBoolean, cleanOptionalId,
  cleanOrderList, ValidationError,
} from '../security/validation.js';

const statements = {
  all: db.prepare('SELECT * FROM research ORDER BY sort_order, id'),
  published: db.prepare(`SELECT * FROM research WHERE status = 'published' ORDER BY sort_order, id`),
  byId: db.prepare('SELECT * FROM research WHERE id = ?'),
  ids: db.prepare('SELECT id FROM research'),
  lowestOrder: db.prepare('SELECT COALESCE(MIN(sort_order), 0) AS value FROM research'),
  insert: db.prepare(`
    INSERT INTO research (title, abstract, authors, published_date, tags, doc_type, pdf_media_id,
                          external_url, cover_media_id, cover_alt, is_featured, status, sort_order)
    VALUES (@title, @abstract, @authors, @published_date, @tags, @doc_type, @pdf_media_id,
            @external_url, @cover_media_id, @cover_alt, @is_featured, @status, @sort_order)
  `),
  update: db.prepare(`
    UPDATE research SET title = @title, abstract = @abstract, authors = @authors,
      published_date = @published_date, tags = @tags, doc_type = @doc_type,
      pdf_media_id = @pdf_media_id, external_url = @external_url, cover_media_id = @cover_media_id,
      cover_alt = @cover_alt, is_featured = @is_featured, status = @status,
      updated_at = datetime('now')
    WHERE id = @id
  `),
  remove: db.prepare('DELETE FROM research WHERE id = ?'),
};

function toResearch(row) {
  const pdf = getMediaInfo(row.pdf_media_id);
  return {
    id: row.id,
    title: row.title,
    abstract: row.abstract,
    authors: row.authors,
    date: row.published_date,
    tags: JSON.parse(row.tags),
    docType: row.doc_type,
    pdf,
    externalUrl: row.external_url,
    cover: getMediaInfo(row.cover_media_id),
    coverAlt: row.cover_alt,
    featured: Boolean(row.is_featured),
    status: row.status,
    // Entries with an uploaded PDF get their own page; external-only entries link straight out.
    detailUrl: `/research/${row.id}`,
  };
}

export function listResearch({ includeDrafts = false } = {}) {
  const rows = includeDrafts ? statements.all.all() : statements.published.all();
  return rows.map(toResearch);
}

export function getResearch(id) {
  const row = statements.byId.get(id);
  return row ? toResearch(row) : null;
}

function cleanResearchInput(input) {
  const status = cleanChoice(input.status, { field: 'status', label: 'Status', choices: ['draft', 'published'] });
  const pdfId = assertMediaKind(
    cleanOptionalId(input.pdfMediaId, { field: 'pdfMediaId', label: 'PDF' }), ['pdf'], 'The document',
  );
  const externalUrl = cleanUrl(input.externalUrl, { field: 'externalUrl', label: 'External publication URL' });

  if (status === 'published' && !pdfId && !externalUrl) {
    throw new ValidationError('To publish, upload a PDF or add an external publication URL (or save as a draft).', 'pdfMediaId');
  }

  const coverId = cleanOptionalId(input.coverMediaId, { field: 'coverMediaId', label: 'Cover image' });
  return {
    title: cleanText(input.title, { field: 'title', label: 'Title', max: 200, required: true }),
    abstract: cleanText(input.abstract, { field: 'abstract', label: 'Abstract', max: 3000, multiline: true }),
    authors: cleanText(input.authors, { field: 'authors', label: 'Authors', max: 300 }),
    published_date: cleanDate(input.date, { field: 'date', label: 'Date' }),
    tags: JSON.stringify(cleanTags(input.tags, { label: 'Topic tags' })),
    doc_type: cleanText(input.docType, { field: 'docType', label: 'Document type', max: 40 }),
    pdf_media_id: pdfId,
    external_url: externalUrl,
    cover_media_id: assertMediaKind(coverId, ['image'], 'The cover'),
    cover_alt: cleanText(input.coverAlt, { field: 'coverAlt', label: 'Cover alt text', max: 200 }),
    is_featured: cleanBoolean(input.featured) ? 1 : 0,
    status,
  };
}

export function createResearch(input) {
  const values = cleanResearchInput(input);
  values.sort_order = statements.lowestOrder.get().value - 1;
  const result = statements.insert.run(values);
  return getResearch(Number(result.lastInsertRowid));
}

export function updateResearch(id, input) {
  if (!statements.byId.get(id)) return null;
  statements.update.run({ ...cleanResearchInput(input), id });
  return getResearch(id);
}

export function deleteResearch(id) {
  return statements.remove.run(id).changes > 0;
}

export function reorderResearch(ids) {
  const existingIds = statements.ids.all().map((row) => row.id);
  saveDisplayOrder('research', cleanOrderList(ids, existingIds));
}
