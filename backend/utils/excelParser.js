const ExcelJS = require('exceljs');

/**
 * Generic, reusable excel parser. NOT tied to any specific module (Discount, etc.)
 * Caller passes the column configuration it expects; this util only knows how to
 * read a workbook buffer, verify headers, and hand back plain row objects.
 *
 * Operates entirely on an in-memory buffer (from multer memoryStorage) -
 * nothing is ever written to disk, so there is nothing to clean up after use.
 *
 * @param {Buffer} fileBuffer - raw excel file buffer (from req.file.buffer / req.files.xxx[0].buffer)
 * @param {Array<{ key: string, header: string, required?: boolean }>} columnsConfig
 *        - key: property name to use in the returned row object
 *        - header: exact column header text expected in row 1 (matched case-insensitively, trimmed)
 *        - required: if false, column is optional and missing header won't throw (default true)
 * @param {Object} [options]
 * @param {Number} [options.headerRowNumber=1] - which row number contains headers
 * @param {Number} [options.sheetIndex=0] - which worksheet to read (0-based)
 *
 * @returns {Promise<{ rows: Array<Object>, rowCount: Number, headers: Array<String> }>}
 */
const parseExcelBuffer = async (fileBuffer, columnsConfig, options = {}) => {
  try {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new Error('A valid file buffer is required to parse the excel file');
    }

    if (!Array.isArray(columnsConfig) || columnsConfig.length === 0) {
      throw new Error('columnsConfig must be a non-empty array describing expected columns');
    }

    const headerRowNumber = options.headerRowNumber || 1;
    const sheetIndex = options.sheetIndex || 0;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    const worksheet = workbook.worksheets[sheetIndex];
    if (!worksheet) {
      throw new Error(`Worksheet at index ${sheetIndex} was not found in the uploaded excel file`);
    }

    const headerRow = worksheet.getRow(headerRowNumber);
    const headerMap = {}; // normalized header text -> column index

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const normalizedHeader = String(extractCellText(cell.value) || '').trim().toLowerCase();
      if (normalizedHeader) {
        headerMap[normalizedHeader] = colNumber;
      }
    });

    const missingHeaders = [];
    columnsConfig.forEach((col) => {
      const isRequired = col.required !== false;
      const normalizedExpected = String(col.header).trim().toLowerCase();
      if (isRequired && !(normalizedExpected in headerMap)) {
        missingHeaders.push(col.header);
      }
    });

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required column(s) in excel file: ${missingHeaders.join(', ')}`);
    }

    const rows = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;

      const rowData = {};
      let isRowBlank = true;

      columnsConfig.forEach((col) => {
        const normalizedExpected = String(col.header).trim().toLowerCase();
        const colIndex = headerMap[normalizedExpected];
        const rawValue = colIndex ? extractCellText(row.getCell(colIndex).value) : null;

        const cleanedValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

        if (cleanedValue !== null && cleanedValue !== undefined && String(cleanedValue).trim() !== '') {
          isRowBlank = false;
        }

        rowData[col.key] = cleanedValue === undefined ? null : cleanedValue;
      });

      if (!isRowBlank) {
        rowData.__rowNumber = rowNumber;
        rows.push(rowData);
      }
    });

    return {
      rows,
      rowCount: rows.length,
      headers: Object.keys(headerMap)
    };
  } catch (err) {
    throw err;
  }
};

/**
 * exceljs can return primitives, rich-text objects ({ richText: [...] }),
 * hyperlink objects ({ text, hyperlink }), or formula-result objects ({ result }).
 * Normalize all of these down to a plain string/primitive.
 */
const extractCellText = (cellValue) => {
  if (cellValue === null || cellValue === undefined) return null;

  if (typeof cellValue === 'object') {
    if (Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((part) => part.text).join('');
    }
    if ('text' in cellValue) return cellValue.text;
    if ('result' in cellValue) return cellValue.result;
    if (cellValue instanceof Date) return cellValue;
    return cellValue;
  }

  return cellValue;
};

module.exports = {
  parseExcelBuffer
};