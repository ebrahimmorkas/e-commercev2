// End-to-end bulk product upload + bulk product update against a real MongoDB
// (productService.bulkUploadProducts / bulkUpdateProducts), without images.
//
// Uses its own throwaway database - the MONGODB_URI database name with
// "-product-bulk-test" appended - and drops it afterwards. Skipped when
// MongoDB isn't reachable.
require('dotenv').config({ quiet: true });
process.env.IS_REDIS_SERVER_ON = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

const Product = require('../models/Product');
const SizeMaster = require('../models/SizeMaster');
const Category = require('../models/Category');
const BrandMaster = require('../models/BrandMaster');
const productService = require('../services/productService');

const id = () => new mongoose.Types.ObjectId();
const VENDOR = id();
const ADMIN = id();

const websiteMasterData = { isBrandFeatureOn: true };
const companySettingsData = {}; // product / variant / size codes auto-generated
let companyMasterData;
let menCategory, shirtsCategory;

const testDbUri = () => {
    const uri = new URL(process.env.MONGODB_URI);
    uri.pathname = `${uri.pathname.replace(/^\//, '') || 'test'}-product-bulk-test`;
    return uri.toString();
};

let connected = false;

test.before(async () => {
    try {
        await mongoose.connect(testDbUri(), { serverSelectionTimeoutMS: 3000 });
        connected = mongoose.connection.db.databaseName.endsWith('-product-bulk-test');
    } catch (err) {
        connected = false;
    }
    if (!connected) return;
    await mongoose.connection.db.dropDatabase();
    await Product.init();

    const shirtSize = await SizeMaster.create({ name: 'Shirt Size', type: 'LABEL', values: ['S', 'M', 'L'] });
    menCategory = await Category.create({ vendorId: VENDOR, categoryName: 'Men', parent_category_id: null });
    shirtsCategory = await Category.create({ vendorId: VENDOR, categoryName: 'Shirts', parent_category_id: menCategory._id });
    await BrandMaster.create({ vendorId: VENDOR, brandName: 'Acme' });

    companyMasterData = {
        allowedSizes: [shirtSize._id],
        allowedCountries: [],
        isCategoryFeatureOn: true,
        isCategoryNestingAllowed: true,
        isBrandFeatureOn: true
    };
});

test.after(async () => {
    if (connected) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
});

const skipUnlessDb = (t) => {
    if (!connected) t.skip('MongoDB not reachable');
    return !connected;
};

// Rows are { Heading: value } objects; headings come from the sample file so
// the test always uses the columns the upload really expects.
const buildWorkbook = async (mode, rowsBySheet) => {
    const sample = await productService.buildBulkProductSampleFile(mode);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(sample.meta.buffer);
    for (const [sheetName, rows] of Object.entries(rowsBySheet)) {
        const sheet = wb.getWorksheet(sheetName);
        const headings = sheet.getRow(1).values;
        for (const row of rows) {
            for (const heading of Object.keys(row)) assert.ok(headings.includes(heading), `${sheetName} has no "${heading}" column`);
            sheet.addRow(headings.map((heading) => (heading in row ? row[heading] : null)));
        }
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
};

const variantRow = (variantTempCode, productTempCode, extra = {}) => ({
    'VariantTempCode*': variantTempCode, 'ProductTempCode*': productTempCode, 'IsDefaultVariant*': true, Color: 'Red',
    'IsDescriptionSameFromProductBasicDetails*': true, 'IsDisclaimerSameFromProductBasicDetails*': true, 'IsBulkPricingSameFromProductBasicDetails*': true,
    ...extra
});

const sizeRow = (sizeTempCode, variantTempCode, labelValue, sku, extra = {}) => ({
    'SizeTempCode*': sizeTempCode, 'VariantTempCode*': variantTempCode, 'IsDefaultSize*': false, 'SizeType*': 'LABEL',
    'SizeMasterName*': 'shirt size', 'SizeName*': `Size ${labelValue}`, LabelValue: labelValue, 'Price*': 100, 'SKU*': sku,
    'IsDescriptionSameFromVariantsDetails*': true, 'IsDisclaimerSameFromVariantsDetails*': true, 'IsBulkPricingSameFromVariantsDetails*': true,
    'WarrantyAvailable*': false, 'ReturnAvailable*': false, 'ExchangeAvailable*': false, 'ShippingType*': 'COMPANY_SETTINGS',
    ...extra
});

const run = (fn, buffer) => fn(VENDOR, ADMIN, buffer, null, null, companyMasterData, websiteMasterData, companySettingsData);
const failures = (result) => result.meta.failedRecords.map((r) => `${r.data.name}: ${r.errors.join('; ')}`);
const findProduct = (name) => Product.findOne({ vendorId: VENDOR, name });

test('bulk upload: category is optional (none / main only / main > sub), numeric cells are read as text', async (t) => {
    if (skipUnlessDb(t)) return;

    const buffer = await buildWorkbook('upload', {
        Products: [
            // Numeric temp codes and a numeric SKU, the way Excel stores a cell typed as 1 / 1001.
            { 'ProductTempCode*': 1, 'Name*': 'Plain Tee', 'Colors*': 'Red', Disclaimer: 'Hand wash', SearchKeywords: 'tee, plain', Precedence: 3 },
            { 'ProductTempCode*': 'P2', 'Name*': 'Polo', 'Colors*': 'Red, Blue', CategoryPath: 'men' },
            { 'ProductTempCode*': 'P3', 'Name*': 'Formal Shirt', 'Colors*': 'Red', CategoryPath: 'Men > Shirts' },
            { 'ProductTempCode*': 'P4', 'Name*': 'Ghost', 'Colors*': 'Red', CategoryPath: 'Men > Nope' }
        ],
        Variants: [variantRow(10, 1), variantRow('V2', 'P2'), variantRow('V3', 'P3'), variantRow('V4', 'P4')],
        Sizes: [
            sizeRow(100, 10, 'S', 1001, { Brand: 'acme', Stock: 5 }),
            sizeRow('S2', 'V2', 'M', 'POLO-M'),
            sizeRow('S3', 'V3', 'L', 'FORMAL-L'),
            sizeRow('S4', 'V4', 'L', 'GHOST-L')
        ],
        Descriptions: [{ 'Level*': 'product', 'RefTempCode*': 1, 'Key*': 'Material', 'Value*': 'Cotton' }]
    });

    const result = await run(productService.bulkUploadProducts, buffer);
    assert.equal(result.isSuccess, true);
    assert.deepEqual(failures(result), ['Ghost: Category "Nope" not found under the given CategoryPath']);
    assert.equal(result.meta.successCount, 3);

    const tee = await findProduct('Plain Tee');
    assert.equal(tee.mainCategory, null);
    assert.equal(tee.subCategory, null);
    assert.equal(tee.variants[0].sizes[0].sku, '1001');
    assert.equal(tee.variants[0].sizes[0].stock, 5);
    assert.ok(tee.variants[0].sizes[0].brandId);
    assert.deepEqual(tee.description.map((d) => [d.key, d.value]), [['Material', 'Cotton']]);

    const polo = await findProduct('Polo');
    assert.equal(String(polo.mainCategory), String(menCategory._id));
    assert.equal(polo.subCategory, null);

    const formal = await findProduct('Formal Shirt');
    assert.equal(String(formal.mainCategory), String(menCategory._id));
    assert.equal(String(formal.subCategory), String(shirtsCategory._id));
});

test('bulk update: blank keeps, CLEAR empties, codes match existing variants/sizes', async (t) => {
    if (skipUnlessDb(t)) return;

    const teeBefore = await findProduct('Plain Tee');
    const teeVariant = teeBefore.variants[0];
    const teeSize = teeVariant.sizes[0];
    const formalBefore = await findProduct('Formal Shirt');

    const buffer = await buildWorkbook('update', {
        Products: [
            // Everything blank -> product-level values kept. Name matched case-insensitively.
            { 'ProductTempCode*': 'P1', 'Name*': 'plain tee' },
            // Category cleared, keywords and colors replaced.
            { 'ProductTempCode*': 'P3', 'Name*': 'Formal Shirt', 'Colors*': 'Red, Green', CategoryPath: 'clear', SearchKeywords: 'office' },
            { 'ProductTempCode*': 'P2', 'Name*': 'Polo', 'Colors*': 'CLEAR' },
            { 'ProductTempCode*': 'P9', 'Name*': 'Does Not Exist' }
        ],
        Variants: [
            variantRow('V1', 'P1', { VariantCode: teeVariant.variantCode.toLowerCase() }),
            variantRow('V3', 'P3', { VariantCode: formalBefore.variants[0].variantCode, Color: 'Green' }),
            variantRow('V2', 'P2'),
            variantRow('V9', 'P9')
        ],
        Sizes: [
            // Existing size (matched by code) repriced, plus a brand-new one.
            sizeRow('S1', 'V1', 'S', 1001, { SizeCode: teeSize.sizeCode, 'Price*': 150, RemoveMainImage: true }),
            sizeRow('S1b', 'V1', 'M', 'TEE-M'),
            // Formal Shirt: its only size is replaced by a new one (no SizeCode).
            sizeRow('S3', 'V3', 'M', 'FORMAL-M'),
            sizeRow('S2', 'V2', 'M', 'POLO-M'),
            sizeRow('S9', 'V9', 'M', 'NOPE-M')
        ]
    });

    const result = await run(productService.bulkUpdateProducts, buffer);
    assert.equal(result.isSuccess, true);
    assert.deepEqual(failures(result), [
        'Polo: Colors cannot be cleared - a product needs at least one color.',
        'Does Not Exist: No existing product found with name "Does Not Exist" - skipped.'
    ]);

    const tee = await findProduct('Plain Tee');
    assert.equal(tee.disclaimer, 'Hand wash');
    assert.deepEqual([...tee.searchKeywords], ['tee', 'plain']);
    assert.equal(tee.precedence, 3);
    assert.equal(tee.productCode, teeBefore.productCode);
    assert.equal(tee.slug, teeBefore.slug);
    assert.deepEqual(tee.description.map((d) => [d.key, d.value]), [['Material', 'Cotton']]);
    assert.equal(tee.variants.length, 1);
    assert.equal(String(tee.variants[0]._id), String(teeVariant._id));
    assert.equal(tee.variants[0].variantCode, teeVariant.variantCode);
    assert.equal(tee.variants[0].sizes.length, 2);
    assert.equal(String(tee.variants[0].sizes[0]._id), String(teeSize._id));
    assert.equal(tee.variants[0].sizes[0].sizeCode, teeSize.sizeCode);
    assert.equal(tee.variants[0].sizes[0].price, 150);
    assert.equal(tee.variants[0].sizes[1].sku, 'TEE-M');
    assert.ok(tee.variants[0].sizes[1].sizeCode);

    const formal = await findProduct('Formal Shirt');
    assert.equal(formal.mainCategory, null);
    assert.equal(formal.subCategory, null);
    assert.deepEqual([...formal.colors], ['Red', 'Green']);
    assert.deepEqual([...formal.searchKeywords], ['office']);
    assert.equal(formal.variants[0].color, 'Green');
    assert.deepEqual(formal.variants[0].sizes.map((s) => s.sku), ['FORMAL-M']);
    assert.notEqual(String(formal.variants[0].sizes[0]._id), String(formalBefore.variants[0].sizes[0]._id));

    // A failed row leaves its product untouched.
    const polo = await findProduct('Polo');
    assert.deepEqual([...polo.colors], ['Red', 'Blue']);
});
