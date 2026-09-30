const ExcelJS = require('exceljs');

/*
|--------------------------------------------------------------------------
| EXCEL SAMPLE FILES
|--------------------------------------------------------------------------
| Builds the downloadable sample (.xlsx) for an upload: only the sheet(s) the
| upload reads, each holding just its heading row - so the file uploads
| cleanly once rows are added, and an untouched sample is reported as
| "no rows" instead of matching made-up data.
*/

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };

/**
 * @param {Object} template
 * @param {Array<{ name: String, columns: Array<{ header: String, width?: Number }> }>} template.sheets
 * @returns {Promise<Buffer>}
 */
const buildExcelTemplate = async ({ sheets }) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.created = new Date();

        for (const sheet of sheets) {
            const worksheet = workbook.addWorksheet(sheet.name);
            worksheet.columns = sheet.columns.map((c) => ({ header: c.header, key: c.header, width: c.width || 32 }));
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.eachCell((cell) => { cell.fill = HEADER_FILL; });
            worksheet.views = [{ state: 'frozen', ySplit: 1 }];
        }

        return Buffer.from(await workbook.xlsx.writeBuffer());
    } catch (err) {
        throw err;
    }
};

module.exports = {
    buildExcelTemplate
};
