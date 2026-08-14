const multer = require('multer');

// Memory storage: excel files are processed entirely in-memory (see utils/excelParser.js)
// and are never written to disk. Once the request completes, the buffer is
// garbage-collected - there is nothing to explicitly delete.
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx only
];

const ALLOWED_EXTENSIONS = ['.xlsx'];

const fileFilter = (req, file, cb) => {
  const ext = require('path').extname(file.originalname || '').toLowerCase();
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeOk && extOk) {
    return cb(null, true);
  }
  return cb(new Error('Only .xlsx files are allowed'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB hard ceiling - blunt abuse-prevention limit only
  }
});

// This is a generic, reusable multer instance - NOT tied to Discount.
// Individual route files decide field names via .fields([...]) / .single(...)
// depending on how many excel files that module's flow needs at once.
module.exports = upload;