// Every excel upload answers a problem with the file itself (unreadable,
// sheet/column missing, no rows) with a 400 message - never a thrown error,
// which would reach the admin as the server error page. Each case below
// fails on the file before any database access, so no connection is needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

const { safeParseExcelSheet, parseExcelBuffer } = require('../utils/excelParser');
const groupService = require('../services/groupService');
const categoryService = require('../services/categoryService');
const productService = require('../services/productService');
const freeCashService = require('../services/freeCashService');
const discountService = require('../services/discountService');

const VENDOR = new mongoose.Types.ObjectId();
const USER = new mongoose.Types.ObjectId();
const NOT_EXCEL = Buffer.from('this is not an excel file');

const workbook = async (sheets) => {
    const wb = new ExcelJS.Workbook();
    for (const [name, rows] of Object.entries(sheets)) {
        const sheet = wb.addWorksheet(name);
        rows.forEach((row) => sheet.addRow(row));
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
};

const EMAIL_COLUMNS = [{ key: 'email', header: 'Email', required: true }];

test('safeParseExcelSheet: messages for each file problem', async () => {
    assert.deepEqual(await safeParseExcelSheet(NOT_EXCEL, EMAIL_COLUMNS, { sheetName: 'Users' }), {
        ok: false, message: 'The uploaded file could not be read. Please upload an Excel (.xlsx) file.'
    });
    const noSheet = await safeParseExcelSheet(await workbook({ Sheet1: [['Email']] }), EMAIL_COLUMNS, { sheetName: 'Users' });
    assert.equal(noSheet.message, 'The excel file needs a sheet named "Users".');
    const noHeading = await safeParseExcelSheet(await workbook({ Users: [['a@b.test']] }), EMAIL_COLUMNS, { sheetName: 'Users' });
    assert.equal(noHeading.message, 'The "Users" sheet is missing the column "Email". Its first row must be the column heading(s): "Email".');
    const ok = await safeParseExcelSheet(await workbook({ Users: [['EMAIL'], ['a@b.test']] }), EMAIL_COLUMNS, { sheetName: 'Users' });
    assert.equal(ok.ok, true);
    assert.equal(ok.rows.length, 1);
});

test('a real fault (not a file problem) is still thrown', async () => {
    await assert.rejects(() => safeParseExcelSheet(NOT_EXCEL, []), /columnsConfig must be a non-empty array/);
    const noHeading = await workbook({ Users: [['x']] });
    await assert.rejects(() => parseExcelBuffer(noHeading, EMAIL_COLUMNS, { sheetName: 'Users' }),
        (err) => err.isExcelInputError === true && err.missingColumns[0] === 'Email');
});

test('groups: excel member upload', async () => {
    const companyMaster = { allowedGroupTypes: [], isNestingCategoryAllowedInGroup: true, numberOfMembersPerGroup: 50 };
    const create = (buffer) => groupService.createGroup(VENDOR, USER, { groupType: 'USER', groupName: 'VIP' }, { excelFile: [{ buffer }] }, companyMaster);

    const noHeading = await create(await workbook({ Users: [['a@b.test']] }));
    assert.equal(noHeading.statusCode, 400);
    assert.match(noHeading.message, /"Users" sheet is missing the column "Email"/);
    assert.equal((await create(NOT_EXCEL)).statusCode, 400);
    assert.equal((await create(await workbook({ Sheet1: [['Email']] }))).message, 'The excel file needs a sheet named "Users".');
    assert.equal((await create(await workbook({ Users: [['Email']] }))).message, 'Excel file contains no data rows.');
});

test('free cash: excel user upload', async () => {
    const { resolveGiveFreeCashToTargets } = freeCashService._internal;
    const resolve = (buffer) => resolveGiveFreeCashToTargets(VENDOR, { giveFreeCashTo: 'SPECIFIC_USERS' }, { excelFile: [{ buffer }] });

    const noHeading = await resolve(await workbook({ Users: [['a@b.test']] }));
    assert.equal(noHeading.valid, false);
    assert.match(noHeading.message, /"Users" sheet is missing the column "Email"/);
    assert.equal((await resolve(NOT_EXCEL)).valid, false);
    assert.match((await resolve(await workbook({ Users: [['Email']] }))).message, /"Users" sheet has no rows/);
});

test('categories: bulk upload', async () => {
    const result = await categoryService.bulkUploadCategories(VENDOR, USER, NOT_EXCEL, null, {}, {});
    assert.equal(result.statusCode, 400);
    assert.match(result.message, /could not be read/);
    const missing = await categoryService.bulkUploadCategories(VENDOR, USER, await workbook({ Sheet1: [['wrong']] }), null, {}, {});
    assert.equal(missing.statusCode, 400);
    assert.match(missing.message, /missing the column/);
});

test('products: bulk upload and bulk update', async () => {
    for (const fn of [productService.bulkUploadProducts, productService.bulkUpdateProducts]) {
        const unreadable = await fn(VENDOR, USER, NOT_EXCEL, null, null, {}, {}, {});
        assert.equal(unreadable.statusCode, 400);
        const noVariants = await fn(VENDOR, USER, await workbook({ Products: [['Name']] }), null, null, {}, {}, {});
        assert.equal(noVariants.statusCode, 400);
        assert.match(noVariants.message, /missing the column|needs a sheet named/);
    }
});

test('discount sample file: only the sheets the option reads, and it round-trips', async () => {
    const readSheets = async (buffer) => {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        return wb.worksheets.map((ws) => [ws.name, ws.getRow(1).values.filter(Boolean)]);
    };

    const both = await discountService.buildTargetingSampleFile('SPECIFIC_PRODUCTS_SPECIFIC_USERS');
    assert.equal(both.isSuccess, true);
    assert.equal(both.meta.fileName, 'discount-sample-products-users.xlsx');
    const sheets = await readSheets(both.meta.buffer);
    // Only the sheets to fill in - no instructions sheet - and the first one opens first.
    assert.deepEqual(sheets.map(([name]) => name), ['Products', 'Users']);
    assert.deepEqual(sheets[0][1], ['Product Name']);
    assert.deepEqual(sheets[1][1], ['Email']);

    const products = await discountService.buildTargetingSampleFile('SPECIFIC_PRODUCTS_ALL_USERS');
    assert.deepEqual((await readSheets(products.meta.buffer)).map(([name]) => name), ['Products']);
    const categoryUsers = await discountService.buildTargetingSampleFile('SPECIFIC_CATEGORIES_SPECIFIC_USERS');
    assert.deepEqual((await readSheets(categoryUsers.meta.buffer)).map(([name]) => name), ['Categories', 'Users']);
    const groupUsers = await discountService.buildTargetingSampleFile('PRODUCT_GROUP_SPECIFIC_USERS');
    assert.deepEqual((await readSheets(groupUsers.meta.buffer)).map(([name]) => name), ['Users']);

    // Options without an excel file have no sample.
    for (const option of ['ALL_PRODUCTS_ALL_USERS', 'USER_GROUP', 'PRODUCT_GROUP_ALL_USERS', 'NOPE']) {
        assert.equal((await discountService.buildTargetingSampleFile(option)).statusCode, 400, option);
    }

    // The untouched sample parses (headings right) and reads as "no rows".
    const parsed = await safeParseExcelSheet(both.meta.buffer, [{ key: 'productName', header: 'Product Name' }], { sheetName: 'Products' });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.rows.length, 0);
});

test('product bulk sample: both modes build a workbook the uploads accept as "no rows"', async () => {
    const SHEETS = ['Products', 'Variants', 'Sizes', 'MeasurementValues', 'Descriptions', 'BulkPricing', 'Instructions'];
    const load = async (buffer) => {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        return wb;
    };
    const headings = (wb, sheetName) => wb.getWorksheet(sheetName).getRow(1).values.filter(Boolean);

    const upload = await productService.buildBulkProductSampleFile('upload');
    assert.equal(upload.isSuccess, true);
    assert.equal(upload.meta.fileName, 'product-bulk-upload-sample.xlsx');
    const uploadWb = await load(upload.meta.buffer);
    assert.deepEqual(uploadWb.worksheets.map((ws) => ws.name), SHEETS);
    // The image-removal columns only mean something to an update.
    assert.equal(headings(uploadWb, 'Sizes').includes('RemoveMainImage'), false);

    const update = await productService.buildBulkProductSampleFile('update');
    assert.equal(update.meta.fileName, 'product-bulk-update-sample.xlsx');
    const updateWb = await load(update.meta.buffer);
    assert.equal(headings(updateWb, 'Sizes').includes('RemoveMainImage'), true);
    assert.equal(headings(updateWb, 'Sizes').includes('RemoveAdditionalImages'), true);

    // Every column of every sheet is explained, and the six data sheets hold headings only.
    const explained = uploadWb.getWorksheet('Instructions').getColumn(2).values.filter(Boolean);
    for (const sheetName of SHEETS.slice(0, 6)) {
        assert.equal(uploadWb.getWorksheet(sheetName).actualRowCount, 1, sheetName);
        for (const heading of headings(uploadWb, sheetName)) assert.ok(explained.includes(heading), `${sheetName}.${heading}`);
    }

    // Untouched, each sample gets past the sheet/column checks and stops at "no rows" (before any DB access).
    for (const [run, sample] of [[productService.bulkUploadProducts, upload], [productService.bulkUpdateProducts, update]]) {
        const result = await run(VENDOR, USER, sample.meta.buffer, null, null, {}, {}, {});
        assert.equal(result.statusCode, 400);
        assert.equal(result.message, 'Products sheet contains no data rows');
    }
});
