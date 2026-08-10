const multer = require('multer');

// Memory storage: excel files are processed entirely in-memory (see utils/excelParser.js)
// and are never written to disk. Once the request completes, the buffer is
// garbage-collected - there is nothing to explicitly delete.
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel' // .xls
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  return cb(new Error('Only .xlsx or .xls files are allowed'), false);
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