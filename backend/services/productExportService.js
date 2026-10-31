const path = require('path');
const Product = require('../models/Product');
const Category = require('../models/Category');
const BrandMaster = require('../models/BrandMaster');
const TaxMaster = require('../models/TaxMaster');
const SizeMaster = require('../models/SizeMaster');
const UnitMaster = require('../models/UnitMaster');
const WeightMaster = require('../models/WeightMaster');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const productService = require('./productService');
const { buildExcelTemplate } = require('../utils/excelTemplateBuilder');
const { createZipBuffer } = require('../utils/zipExtractor');
const common = require('../utils/common');
const logger = require('../utils/logger');

/*
|--------------------------------------------------------------------------
| PRODUCT EXPORT (Products page > Download)
|--------------------------------------------------------------------------
| Writes the products the admin list shows (or the ticked ones) in the exact
| Bulk Update workbook format: the six sheets, filled, plus the Instructions
| sheet. Ids are turned back into the names/codes the upload reads (category
| path, brand, size, unit, tax code...), and the real Product/Variant/Size
| codes are filled in, so the file can be edited and uploaded through Bulk
| Update Products as it is.
|
| Images are downloaded from storage into main-images.zip and
| additional-images.zip, and their file names are written in
| MainImageFileName / AdditionalImageFileNames. An image that can't be
| downloaded leaves its file name out (Bulk Update then keeps the current
| image) and is listed on the Instructions sheet.
|
| The download is one zip: products.xlsx + the two image zips.
*/

// Used when the vendor's CompanyMaster has no maxProductsInDownloadInAdminPanel
// yet (saved before the field existed) - same as the model's default.
const DEFAULT_MAX_EXPORT_PRODUCTS = 1000;
const IMAGE_FETCH_CONCURRENCY = 6;
const IMAGE_FETCH_TIMEOUT_MS = 20000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAIN_IMAGES_ZIP_NAME = 'main-images.zip';
const ADDITIONAL_IMAGES_ZIP_NAME = 'additional-images.zip';
const EXCEL_FILE_NAME = 'products.xlsx';

const IMAGE_EXTENSIONS_BY_TYPE = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'image/svg+xml': '.svg'
};

// CompanyMaster.maxProductsInDownloadInAdminPanel -> the most products one
// download may hold: null = no limit, 0 = none, missing = the default.
const resolveMaxExportProducts = (companyMasterData) => {
    try {
        const value = companyMasterData ? companyMasterData.maxProductsInDownloadInAdminPanel : undefined;
        if (value === undefined) return DEFAULT_MAX_EXPORT_PRODUCTS;
        return value;
    } catch (err) {
        throw err;
    }
};

const idKey = (id) => {
    try {
        return id ? id.toString() : '';
    } catch (err) {
        throw err;
    }
};

// _id -> doc, for the ids referenced by the exported products.
const loadById = async (Model, ids, projection, extraFilter = {}) => {
    try {
        const uniqueIds = [...new Set(ids.filter(Boolean).map(idKey))];
        if (uniqueIds.length === 0) return new Map();
        const docs = await Model.find({ _id: { $in: uniqueIds }, ...extraFilter }, projection).lean();
        return new Map(docs.map((doc) => [idKey(doc._id), doc]));
    } catch (err) {
        throw err;
    }
};

// Every master record the exported products point at, loaded once.
const loadExportLookups = async (vendorId, products) => {
    try {
        const sizes = [];
        products.forEach((p) => (p.variants || []).forEach((v) => (v.sizes || []).forEach((s) => sizes.push(s))));

        const [categories, brands, taxes, sizeMasters, units, weights, countries, states, cities, recommended] = await Promise.all([
            Category.find({ vendorId, status: { $ne: 'D' } }, { categoryName: 1, parent_category_id: 1 }).lean(),
            loadById(BrandMaster, sizes.map((s) => s.brandId), { brandName: 1 }, { vendorId }),
            loadById(TaxMaster, products.flatMap((p) => p.taxIds || []), { code: 1 }),
            loadById(SizeMaster, sizes.map((s) => s.sizeId), { name: 1, measurements: 1 }),
            loadById(UnitMaster, sizes.flatMap((s) => (s.values || []).map((mv) => mv.unit)), { name: 1 }),
            loadById(WeightMaster, sizes.map((s) => s.weight?.unit), { weightName: 1 }),
            loadById(CountryMaster, sizes.flatMap((s) => s.excludeCountries || []), { country_name: 1 }),
            loadById(StateMaster, sizes.flatMap((s) => s.excludeStates || []), { state_name: 1 }),
            loadById(CityMaster, sizes.flatMap((s) => s.excludeCities || []), { city_name: 1 }),
            // Only active products can be recommended on upload, so only their codes are written.
            loadById(Product, products.flatMap((p) => p.recommendedProducts || []), { productCode: 1 }, { vendorId, status: 'A' })
        ]);

        return {
            categoriesById: new Map(categories.map((c) => [idKey(c._id), c])),
            brands, taxes, sizeMasters, units, weights, countries, states, cities, recommended
        };
    } catch (err) {
        throw err;
    }
};

// "Men > Shirts > Formal" for the product's deepest category, as CategoryPath expects.
const categoryPathOf = (product, categoriesById) => {
    try {
        const leafId = product.subCategory || product.mainCategory;
        if (!leafId) return '';
        const names = [];
        let current = categoriesById.get(idKey(leafId));
        while (current) {
            names.unshift(current.categoryName);
            current = current.parent_category_id ? categoriesById.get(idKey(current.parent_category_id)) : null;
        }
        return names.join(' > ');
    } catch (err) {
        throw err;
    }
};

const namesOf = (ids, lookup, field) => {
    try {
        return (ids || []).map((id) => lookup.get(idKey(id))?.[field]).filter(Boolean).join(', ');
    } catch (err) {
        throw err;
    }
};

const blankIfNull = (value) => {
    try {
        return value === null || value === undefined ? '' : value;
    } catch (err) {
        throw err;
    }
};

// "P1-AB12_V1_S3" -> safe as a file name inside a zip.
const safeFileBase = (text) => {
    try {
        return String(text).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    } catch (err) {
        throw err;
    }
};

// Picks a file name not used yet in that zip.
const claimFileName = (usedNames, base, extension) => {
    try {
        let name = `${base}${extension}`;
        let counter = 2;
        while (usedNames.has(name.toLowerCase())) {
            name = `${base}-${counter}${extension}`;
            counter += 1;
        }
        usedNames.add(name.toLowerCase());
        return name;
    } catch (err) {
        throw err;
    }
};

// From the response's content type, else the URL's own extension, else .jpg.
const extensionOf = (url, contentType) => {
    try {
        const fromType = IMAGE_EXTENSIONS_BY_TYPE[String(contentType || '').split(';')[0].trim().toLowerCase()];
        if (fromType) return fromType;
        const fromUrl = path.extname(String(url).split(/[?#]/)[0]).toLowerCase();
        return /^\.[a-z0-9]{2,5}$/.test(fromUrl) ? fromUrl : '.jpg';
    } catch (err) {
        throw err;
    }
};

// { ok: true, buffer, contentType } | { ok: false, reason }. A network error
// or timeout rejects the fetch; Promise.allSettled turns that into a reason.
const downloadImage = async (url) => {
    try {
        if (!/^https?:\/\//i.test(String(url || ''))) {
            return { ok: false, reason: 'not a web address' };
        }
        const [fetched] = await Promise.allSettled([fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) })]);
        if (fetched.status === 'rejected') {
            return { ok: false, reason: fetched.reason?.name === 'TimeoutError' ? 'timed out' : 'could not be downloaded' };
        }
        const response = fetched.value;
        if (!response.ok) {
            return { ok: false, reason: `storage answered ${response.status}` };
        }
        const [read] = await Promise.allSettled([response.arrayBuffer()]);
        if (read.status === 'rejected') {
            return { ok: false, reason: 'could not be downloaded' };
        }
        const buffer = Buffer.from(read.value);
        if (buffer.length === 0) return { ok: false, reason: 'empty file' };
        if (buffer.length > MAX_IMAGE_BYTES) return { ok: false, reason: 'file too large' };
        return { ok: true, buffer, contentType: response.headers.get('content-type') };
    } catch (err) {
        throw err;
    }
};

// Downloads every planned image, a few at a time. Each job gets `fileName`
// (null when it failed) and the bytes land in the matching zip's entries.
const downloadImages = async (jobs) => {
    try {
        const entries = { main: [], additional: [] };
        const usedNames = { main: new Set(), additional: new Set() };
        const failures = [];

        let next = 0;
        const worker = async () => {
            try {
                while (next < jobs.length) {
                    const job = jobs[next];
                    next += 1;
                    const result = await downloadImage(job.url);
                    if (!result.ok) {
                        job.fileName = null;
                        failures.push(`${job.label}: ${result.reason}`);
                        continue;
                    }
                    job.fileName = claimFileName(usedNames[job.zip], job.base, extensionOf(job.url, result.contentType));
                    entries[job.zip].push({ name: job.fileName, buffer: result.buffer });
                }
            } catch (err) {
                throw err;
            }
        };
        await Promise.all(Array.from({ length: Math.min(IMAGE_FETCH_CONCURRENCY, jobs.length) }, worker));

        return { entries, failures };
    } catch (err) {
        throw err;
    }
};

// The <prefix>Available / Duration / DurationType cells of one size policy.
const policyColumns = (size, prefix, policyField) => {
    try {
        const policy = size[policyField];
        return {
            [`${prefix}Available`]: !!policy?.isAvailable,
            [`${prefix}Duration`]: policy?.isAvailable ? blankIfNull(policy.duration) : '',
            [`${prefix}DurationType`]: policy?.isAvailable ? blankIfNull(policy.durationType) : ''
        };
    } catch (err) {
        throw err;
    }
};

// Products -> one row object (keyed by column key) per row of each sheet,
// plus the image downloads the Sizes rows wait on.
const buildSheetRows = (products, lookups) => {
    try {
        const rows = { productRows: [], variantRows: [], sizeRows: [], measurementValueRows: [], descriptionRows: [], bulkPricingRows: [] };
        const imageJobs = [];
        const sizeImageLinks = [];

        const addDescriptions = (level, refTempCode, entries) => {
            try {
                (entries || []).forEach((d) => rows.descriptionRows.push({ level, refTempCode, key: d.key, value: d.value }));
            } catch (err) {
                throw err;
            }
        };
        const addBulkPricing = (level, refTempCode, tiers) => {
            try {
                (tiers || []).forEach((t) => rows.bulkPricingRows.push({
                    level, refTempCode, minimumQuantity: t.minimumQuantity, maximumQuantity: t.maximumQuantity, price: t.price,
                    internationalPrice: t.internationalPrice
                }));
            } catch (err) {
                throw err;
            }
        };

        products.forEach((product, productIndex) => {
            const productTempCode = `P${productIndex + 1}`;
            rows.productRows.push({
                productTempCode,
                name: product.name,
                colors: (product.colors || []).join(', '),
                categoryPath: categoryPathOf(product, lookups.categoriesById),
                disclaimer: blankIfNull(product.disclaimer),
                searchKeywords: (product.searchKeywords || []).join(', '),
                recommendedProductCodes: namesOf(product.recommendedProducts, lookups.recommended, 'productCode'),
                taxCodes: namesOf(product.taxIds, lookups.taxes, 'code'),
                precedence: blankIfNull(product.precedence),
                productCode: product.productCode
            });
            addDescriptions('product', productTempCode, product.description);
            addBulkPricing('product', productTempCode, product.bulkPricing);

            (product.variants || []).forEach((variant, variantIndex) => {
                const variantTempCode = `${productTempCode}-V${variantIndex + 1}`;
                rows.variantRows.push({
                    variantTempCode,
                    productTempCode,
                    isDefaultVariant: !!variant.isDefaultVariant,
                    color: blankIfNull(variant.color),
                    displayName: blankIfNull(variant.displayName),
                    isDescriptionSameFromProductBasicDetails: !!variant.isDescriptionSameFromProductBasicDetails,
                    isDisclaimerSameFromProductBasicDetails: !!variant.isDisclaimerSameFromProductBasicDetails,
                    isBulkPricingSameFromProductBasicDetails: !!variant.isBulkPricingSameFromProductBasicDetails,
                    variantAdditionalDisclaimer: blankIfNull(variant.variantAdditionalDisclaimer),
                    variantCode: blankIfNull(variant.variantCode)
                });
                addDescriptions('variant', variantTempCode, variant.variantAdditionalDescription);
                addBulkPricing('variant', variantTempCode, variant.variantAdditionalBulkPricing);

                (variant.sizes || []).forEach((size, sizeIndex) => {
                    const sizeTempCode = `${variantTempCode}-S${sizeIndex + 1}`;
                    const sizeMaster = lookups.sizeMasters.get(idKey(size.sizeId));
                    const isCustomShipping = size.shipping?.type === 'CUSTOM';
                    const sizeRow = {
                        sizeTempCode,
                        variantTempCode,
                        isDefaultSize: !!size.isDefaultSize,
                        sizeType: size.sizeType,
                        sizeMasterName: sizeMaster?.name || '',
                        sizeName: size.sizeName,
                        labelValue: size.sizeType === 'LABEL' ? blankIfNull(size.labelValue) : '',
                        brand: lookups.brands.get(idKey(size.brandId))?.brandName || '',
                        price: blankIfNull(size.price),
                        cancelledPrice: blankIfNull(size.cancelledPrice),
                        internationalPrice: blankIfNull(size.internationalPrice),
                        internationalCancelledPrice: blankIfNull(size.internationalCancelledPrice),
                        stock: blankIfNull(size.stock),
                        weightValue: size.weight ? blankIfNull(size.weight.value) : '',
                        weightUnitName: size.weight ? lookups.weights.get(idKey(size.weight.unit))?.weightName || '' : '',
                        sku: blankIfNull(size.sku),
                        barcode: blankIfNull(size.barcode),
                        sizeCode: blankIfNull(size.sizeCode),
                        isDescriptionSameFromVariantsDetails: !!size.isDescriptionSameFromVariantsDetails,
                        isDisclaimerSameFromVariantsDetails: !!size.isDisclaimerSameFromVariantsDetails,
                        isBulkPricingSameFromVariantsDetails: !!size.isBulkPricingSameFromVariantsDetails,
                        sizeAdditionalDisclaimer: blankIfNull(size.sizeAdditionalDisclaimer),
                        excludeCountries: namesOf(size.excludeCountries, lookups.countries, 'country_name'),
                        excludeStates: namesOf(size.excludeStates, lookups.states, 'state_name'),
                        excludeCities: namesOf(size.excludeCities, lookups.cities, 'city_name'),
                        excludeZipCodes: (size.excludeZipCodes || []).join(', '),
                        precedence: blankIfNull(size.precedence),
                        ...policyColumns(size, 'warranty', 'warranty'),
                        ...policyColumns(size, 'return', 'return'),
                        ...policyColumns(size, 'exchange', 'exchange'),
                        shippingType: blankIfNull(size.shipping?.type),
                        shippingValue: isCustomShipping ? blankIfNull(size.shipping?.value) : '',
                        mainImageFileName: '',
                        additionalImageFileNames: '',
                        removeMainImage: '',
                        removeAdditionalImages: ''
                    };
                    rows.sizeRows.push(sizeRow);
                    addDescriptions('size', sizeTempCode, size.sizeAdditionalDescription);
                    addBulkPricing('size', sizeTempCode, size.sizeAdditionalBulkPricing);

                    (size.values || []).forEach((mv) => {
                        const measurement = (sizeMaster?.measurements || []).find((m) => idKey(m._id) === idKey(mv.measurementId));
                        rows.measurementValueRows.push({
                            sizeTempCode,
                            measurementLabel: measurement?.label || '',
                            unitName: lookups.units.get(idKey(mv.unit))?.name || '',
                            value: mv.value
                        });
                    });

                    const imageBase = safeFileBase([product.productCode, variant.variantCode || `V${variantIndex + 1}`, size.sizeCode || `S${sizeIndex + 1}`].join('_'));
                    const imageLabel = `${product.name} / ${size.sizeName}${size.sku ? ` (SKU ${size.sku})` : ''}`;
                    const link = { sizeRow, mainJob: null, additionalJobs: [] };
                    if (size.image?.url) {
                        link.mainJob = { url: size.image.url, zip: 'main', base: imageBase, label: `${imageLabel} main image` };
                        imageJobs.push(link.mainJob);
                    }
                    (size.additionalImages || []).forEach((image, imageIndex) => {
                        if (!image?.url) return;
                        const job = { url: image.url, zip: 'additional', base: `${imageBase}_${imageIndex + 1}`, label: `${imageLabel} additional image ${imageIndex + 1}` };
                        link.additionalJobs.push(job);
                        imageJobs.push(job);
                    });
                    sizeImageLinks.push(link);
                });
            });
        });

        return { rows, imageJobs, sizeImageLinks };
    } catch (err) {
        throw err;
    }
};

const exportDateStamp = () => {
    try {
        return new Date().toISOString().slice(0, 10);
    } catch (err) {
        throw err;
    }
};

const buildExportNotes = (productCount, failures) => {
    try {
        const notes = [
            ['Download', '', '', `${productCount} product(s) downloaded on ${exportDateStamp()}. This file is in the Bulk Update Products format: edit it and upload it there to change these products.`],
            ['Download', '', '', `Images: when uploading, choose ${MAIN_IMAGES_ZIP_NAME} as the main images zip and ${ADDITIONAL_IMAGES_ZIP_NAME} as the additional images zip. To keep a size's current images instead, clear its MainImageFileName / AdditionalImageFileNames cells.`]
        ];
        if (failures.length > 0) {
            notes.push(['Download', '', '', `${failures.length} image(s) could not be downloaded; their file names were left blank, so Bulk Update keeps the current image for them: ${failures.join('; ')}`]);
        }
        return notes;
    } catch (err) {
        throw err;
    }
};

// query: the admin list's query (q, sort, categoryId (decoded), minPrice, maxPrice,
// stockStatus, minStock, maxStock) or { ids } for ticked products.
// vendorData: { websiteMasterData, companyMasterData, companySettingsData }
// meta = { buffer, fileName } - a zip of products.xlsx + the image zips.
const buildProductExport = async (vendorId, query = {}, vendorData = {}) => {
    try {
        const maxCount = resolveMaxExportProducts(vendorData.companyMasterData);
        if (maxCount === 0) {
            return common.returnResult(false, 403, 'Downloading products is not enabled for your store. Please contact the website administrator.');
        }

        const found = await productService.findAdminProductIdsForExport(vendorId, query, vendorData, maxCount);
        if (!found.isSuccess) {
            return found;
        }
        const { ids } = found.meta;

        const docs = await Product.find({ _id: { $in: ids }, vendorId }).lean();
        const byId = new Map(docs.map((doc) => [idKey(doc._id), doc]));
        const products = ids.map((id) => byId.get(idKey(id))).filter(Boolean);

        const lookups = await loadExportLookups(vendorId, products);
        const { rows, imageJobs, sizeImageLinks } = buildSheetRows(products, lookups);

        const { entries, failures } = await downloadImages(imageJobs);
        sizeImageLinks.forEach(({ sizeRow, mainJob, additionalJobs }) => {
            sizeRow.mainImageFileName = mainJob?.fileName || '';
            sizeRow.additionalImageFileNames = additionalJobs.map((job) => job.fileName).filter(Boolean).join(', ');
        });

        const layout = productService.buildBulkWorkbookLayout('update');
        const excelBuffer = await buildExcelTemplate({
            sheets: [
                ...layout.sheets.map((sheet) => ({
                    name: sheet.name,
                    columns: sheet.columns.map((column) => ({ header: column.header, width: Math.max(18, column.header.length + 4) })),
                    rows: rows[sheet.key].map((row) => sheet.columns.map((column) => blankIfNull(row[column.key])))
                })),
                {
                    name: 'Instructions',
                    columns: layout.instructionColumns,
                    rows: [...buildExportNotes(products.length, failures), ...layout.instructionRows]
                }
            ]
        });

        const zipEntries = [{ name: EXCEL_FILE_NAME, buffer: excelBuffer }];
        if (entries.main.length > 0) zipEntries.push({ name: MAIN_IMAGES_ZIP_NAME, buffer: createZipBuffer(entries.main) });
        if (entries.additional.length > 0) zipEntries.push({ name: ADDITIONAL_IMAGES_ZIP_NAME, buffer: createZipBuffer(entries.additional) });
        // The downloaded image bytes are now inside the image zips - let them go
        // before the final zip is built, so a big (or unlimited) download does
        // not hold every image in memory several times over.
        entries.main.length = 0;
        entries.additional.length = 0;

        if (failures.length > 0) {
            logger.logInfo(1, 0, 'Product export: some images could not be downloaded', { vendorId, failedCount: failures.length });
        }

        return common.returnResult(true, 200, 'Products exported', {
            buffer: createZipBuffer(zipEntries),
            fileName: `products-${exportDateStamp()}.zip`,
            productCount: products.length,
            failedImageCount: failures.length
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    buildProductExport,
    DEFAULT_MAX_EXPORT_PRODUCTS
};
