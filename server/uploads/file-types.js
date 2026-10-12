// Recognises uploaded files by their first bytes ("magic numbers") instead of
// trusting the file name or the type reported by the browser, both of which can be faked.

const IMAGE_LIMIT = 5 * 1024 * 1024;   // 5 MB
const ICON_LIMIT = 1 * 1024 * 1024;    // 1 MB
const PDF_LIMIT = 20 * 1024 * 1024;    // 20 MB

// The largest limit above; multer rejects anything bigger before it reaches our code.
export const MAX_UPLOAD_BYTES = PDF_LIMIT;

function ascii(buffer, start, end) {
  return buffer.subarray(start, end).toString('latin1');
}

const FILE_TYPES = [
  {
    mimeType: 'image/jpeg', extension: 'jpg', kind: 'image', maxBytes: IMAGE_LIMIT,
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mimeType: 'image/png', extension: 'png', kind: 'image', maxBytes: IMAGE_LIMIT,
    matches: (b) => ascii(b, 0, 8) === '\x89PNG\r\n\x1a\n',
  },
  {
    mimeType: 'image/webp', extension: 'webp', kind: 'image', maxBytes: IMAGE_LIMIT,
    matches: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP',
  },
  {
    mimeType: 'image/gif', extension: 'gif', kind: 'image', maxBytes: IMAGE_LIMIT,
    matches: (b) => ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a',
  },
  {
    mimeType: 'image/x-icon', extension: 'ico', kind: 'icon', maxBytes: ICON_LIMIT,
    matches: (b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0,
  },
  {
    // The PDF header may be preceded by a few junk bytes, so search the first kilobyte.
    mimeType: 'application/pdf', extension: 'pdf', kind: 'pdf', maxBytes: PDF_LIMIT,
    matches: (b) => ascii(b, 0, 1024).includes('%PDF-'),
  },
];

/** Returns the matching file type description, or null for unsupported files. */
export function detectFileType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return FILE_TYPES.find((type) => type.matches(buffer)) ?? null;
}

export const KIND_DESCRIPTIONS = {
  image: 'JPEG, PNG, WebP or GIF image (max 5 MB)',
  pdf: 'PDF document (max 20 MB)',
  icon: 'ICO icon (max 1 MB)',
};
