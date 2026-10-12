// Receives one uploaded file per request using multer.
// Files are kept in memory first so we can inspect their contents before
// anything is written to disk (see media.js -> saveUploadedFile).
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from './file-types.js';

const receiveSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
}).single('file');

/** Express middleware: parses the "file" field and turns multer errors into friendly messages. */
export function acceptSingleUpload(req, res, next) {
  receiveSingleFile(req, res, (error) => {
    if (!error) {
      if (!req.file) {
        return res.status(400).json({ error: 'Please choose a file to upload.' });
      }
      return next();
    }
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `The file is too large. The maximum size is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
        : 'The upload could not be processed. Please upload one file at a time.';
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
    }
    next(error);
  });
}
